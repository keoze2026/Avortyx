/**
 * Support chat service — public contact / chat surface.
 *
 *   POST /api/support/chat                  start a session     → { sessionId, message }
 *   POST /api/support/chat/{sessionId}      visitor follow-up   → { message }
 *   GET  /api/support/chat/{sessionId}      poll for replies    → { messages: [...] }
 *   POST /api/support/chat/{sessionId}/image  a picture (CH-654) → { id, imageUrl }
 *
 * On the visitor's side the admin team monitors incoming sessions via
 * Telegram and replies via Telegram or email. Replies land in the
 * visitor's Gmail. The two follow-up endpoints power a future in-app
 * "view your conversation" experience — they are not used by the
 * marketing contact form, but the service exports them now so they're
 * ready when the chat-history UI is built.
 *
 * All three endpoints are anonymous (no `Authorization` header) and
 * rate-limited by IP server-side.
 */

import { API_BASE_URL } from "@/lib/api/env";
import { http } from "@/lib/api/http";

/** CH-654: a picture in the chat - PNG, JPG, GIF or WEBP, up to 2 MB (the
 *  server checks the same, from the file's own bytes). */
export const SUPPORT_PICTURE_MAX_BYTES = 2 * 1024 * 1024;
export const SUPPORT_PICTURE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Where an <img> loads a chat picture from: the server's address for a sent
 *  one, or the local preview of one still being sent. */
export function supportPictureSrc(url: string): string {
  return /^(blob:|data:|https?:)/.test(url) ? url : `${API_BASE_URL}${url}`;
}

/* ─── Inputs ─────────────────────────────────────────────────────────── */

export interface StartChatInput {
  name: string;
  email: string;
  message: string;
  /**
   * Which team member the visitor picked from the in-app widget.
   * Backend uses this to route the Telegram ping to the right operator.
   * Optional — when omitted the backend round-robins / sends to whoever is on duty.
   */
  agentId?: string;
}

export interface SendMessageInput {
  message: string;
}

/* ─── Outputs (frontend-shaped) ──────────────────────────────────────── */

export type ChatSender = "visitor" | "agent";

export interface ChatMessage {
  /** Stable id assigned by the backend. */
  id?: string;
  sender: ChatSender;
  body: string;
  /** CH-654: the message's picture, if it has one (see supportPictureSrc). */
  imageUrl?: string;
  /** ms-epoch timestamp normalized from the wire ISO string. */
  createdAt: number;
}

export interface StartChatResult {
  /** Persist this in localStorage so the session can be resumed later. */
  sessionId: string;
  /** Server's acknowledgement / echo. Optional in case the backend omits it. */
  message?: string;
  /** CH-669: a greeting only, from someone whose greetings are blocked - kept,
   *  not sent to the team; `message` asks what they need help with. */
  blocked?: boolean;
}

/** CH-669: what a follow-up message came back with. */
export interface SendMessageResult {
  blocked: boolean;
  message?: string;
}

export interface SessionTranscript {
  sessionId: string;
  messages: ChatMessage[];
}

/* ─── Wire shapes (snake_case) ───────────────────────────────────────── */

interface StartChatWire {
  /** `session_id` arrives camelCased thanks to the http layer's snake→camel pass. */
  sessionId: string;
  message?: string;
  blocked?: boolean;
}

/**
 * CH-669: this browser's own random id, kept in the browser, sent with each
 * chat message so the backend knows the same person in a new chat (the chat
 * code changes with every new chat). Not personal data; "" when storage is
 * blocked.
 */
const BROWSER_KEY = "avx_chat_browser";
function browserId(): string {
  try {
    let id = window.localStorage.getItem(BROWSER_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(BROWSER_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

interface ChatMessageWire {
  id?: string | number;
  /** Backends vary: "agent" | "operator" | "team" | "support" | "admin" | "staff" | "visitor" | "user" | "customer". */
  sender?: string;
  /** Same field surfaces under several names — we try all of them. */
  body?: string;
  message?: string;
  text?: string;
  content?: string;
  /** CH-654: `image_url` on the wire. */
  imageUrl?: string | null;
  createdAt?: string | number;
  timestamp?: string | number;
  sentAt?: string | number;
}

/** The transcript wire shape — accept several common backend conventions
 *  so we don't silently render an empty conversation when the backend
 *  picks a slightly different field name. */
interface SessionTranscriptWire {
  sessionId?: string;
  messages?: ChatMessageWire[];
  /** Some APIs wrap the list as `history`, `items`, `data`, or `chat`. */
  history?: ChatMessageWire[];
  items?: ChatMessageWire[];
  data?: ChatMessageWire[] | { messages?: ChatMessageWire[] };
  chat?: ChatMessageWire[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function toTs(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : Date.now();
  }
  return Date.now();
}

/**
 * Treat any sender that isn't clearly the visitor side as the agent side.
 * Backends use many words for the operator: "agent" | "operator" | "team"
 * | "support" | "admin" | "staff" | "telegram" | "bot". Whitelisting only
 * "agent" would silently drop those.
 */
const VISITOR_SENDERS = new Set(["visitor", "user", "customer", "client", "guest", "me"]);
function normalizeSender(raw: string | undefined): ChatSender {
  if (!raw) return "agent"; // missing sender → safer to show than hide
  return VISITOR_SENDERS.has(raw.toLowerCase()) ? "visitor" : "agent";
}

function wireToMessage(w: ChatMessageWire): ChatMessage {
  return {
    id: w.id !== undefined ? String(w.id) : undefined,
    sender: normalizeSender(w.sender),
    body: w.body ?? w.message ?? w.text ?? w.content ?? "",
    imageUrl: w.imageUrl ?? undefined,
    createdAt: toTs(w.createdAt ?? w.timestamp ?? w.sentAt),
  };
}

/** Pick the messages array regardless of which wrapper the backend used. */
function extractMessages(wire: SessionTranscriptWire | ChatMessageWire[]): ChatMessageWire[] {
  if (Array.isArray(wire)) return wire;
  if (Array.isArray(wire.messages)) return wire.messages;
  if (Array.isArray(wire.history)) return wire.history;
  if (Array.isArray(wire.items)) return wire.items;
  if (Array.isArray(wire.chat)) return wire.chat;
  if (Array.isArray(wire.data)) return wire.data;
  if (wire.data && typeof wire.data === "object" && Array.isArray(wire.data.messages)) {
    return wire.data.messages;
  }
  return [];
}

/* ─── Service ────────────────────────────────────────────────────────── */

export const supportService = {
  /**
   * Start a new support session. Used by the marketing contact form.
   * The admin team gets an instant Telegram ping with the visitor's details
   * and replies asynchronously via Telegram or email — replies land in the
   * visitor's Gmail, not via this API.
   */
  async startChat(input: StartChatInput): Promise<StartChatResult> {
    const wire = await http.post<StartChatWire>("/api/support/chat", {
      body: { ...input, browserId: browserId() },
      anonymous: true,
    });
    return { sessionId: wire.sessionId, message: wire.message, blocked: wire.blocked === true };
  },

  /**
   * Visitor follow-up message on an existing session.
   * Not used yet — reserved for the future in-app chat history view.
   */
  async sendMessage(sessionId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const wire = await http.post<{ message?: string; blocked?: boolean } | undefined>(
      `/api/support/chat/${encodeURIComponent(sessionId)}`,
      { body: { ...input, browserId: browserId() }, anonymous: true },
    );
    return { blocked: wire?.blocked === true, message: wire?.message };
  },

  /**
   * CH-654: send a picture (pasted or picked) to an existing session, with
   * an optional line of text. The support team gets it in Telegram.
   */
  async sendPicture(sessionId: string, picture: Blob, message = ""): Promise<void> {
    const form = new FormData();
    const name = picture instanceof File && picture.name ? picture.name : "picture";
    form.append("image", picture, name);
    if (message) form.append("message", message);
    await http.post(`/api/support/chat/${encodeURIComponent(sessionId)}/image`, {
      body: form,
      anonymous: true,
    });
  },

  /**
   * Poll for the full transcript of a session (both visitor + agent messages).
   * Not used yet — reserved for the future in-app chat history view.
   *
   * Call every few seconds while a session is open; stop polling once the
   * page is hidden or after a back-off if no new messages arrive.
   */
  async fetchSession(sessionId: string): Promise<SessionTranscript> {
    const wire = await http.get<SessionTranscriptWire | ChatMessageWire[]>(
      `/api/support/chat/${encodeURIComponent(sessionId)}`,
      { anonymous: true },
    );
    const rawMessages = extractMessages(wire);

    // One-time diagnostic when the conversation looks empty but the
    // payload wasn't. Helps spot field-name mismatches between FE / BE
    // without having to ship a custom debug build. Dev-only.
    if (
      process.env.NODE_ENV !== "production" &&
      rawMessages.length === 0 &&
      !Array.isArray(wire) &&
      Object.keys(wire ?? {}).length > 1
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[supportService.fetchSession] no messages extracted — backend response shape:",
        wire,
      );
    }

    return {
      sessionId: (Array.isArray(wire) ? undefined : wire.sessionId) ?? sessionId,
      messages: rawMessages.map(wireToMessage),
    };
  },
};
