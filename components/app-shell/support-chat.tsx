"use client";

/**
 * In-portal support chat — the "Need help?" bubble in the bottom-right corner
 * of every signed-in page.
 *
 * Uses the same backend as the website chat (see support.service.ts):
 *   POST /api/support/chat               start a conversation (pings the Telegram support group)
 *   POST /api/support/chat/{sessionId}   follow-up message
 *   GET  /api/support/chat/{sessionId}   the conversation, including the team's replies
 *
 * The team replies from Telegram; those replies arrive here by polling.
 *
 * Differences from the website widget:
 *   - no name / email form: the signed-in user's details are sent automatically,
 *     together with their organisation and the page they started on, so the
 *     team knows who is asking and from where;
 *   - the conversation is remembered per user, so it survives a refresh;
 *   - a dot on the bubble shows when the team has replied while it was closed;
 *   - CH-654: a picture can be sent too - paste it into the box while typing,
 *     or pick one with the picture button (PNG, JPG, GIF, WEBP, up to 2 MB).
 *     The team's photo replies from Telegram show here the same way.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { ImagePlus, Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError, friendlyErrorMessage } from "@/lib/api/errors";
import {
  SUPPORT_PICTURE_MAX_BYTES,
  SUPPORT_PICTURE_TYPES,
  supportPictureSrc,
  supportService,
  type ChatMessage,
} from "@/lib/api/services/support.service";
import { uiLocaleTag } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/** How often to check for replies while the chat is open. */
const OPEN_POLL_MS = 4_000;
/** How often to check for replies while it's closed (drives the unread dot). */
const CLOSED_POLL_MS = 60_000;
/** The backend's `name` column is 200 characters. */
const NAME_MAX = 200;

/** Dark grey with white, matching the portal's dark surfaces: used for the
 *  send button and the header icon. */
const DARK = "border border-white/10 bg-zinc-800 text-white hover:bg-zinc-700";

/** The round chat button: the portal's blue, with the same soft glow as the
 *  active sidebar item, and a white icon. */
const BUBBLE = "bg-accent text-accent-foreground hover:bg-[color:var(--accent-hover)]";
const BUBBLE_GLOW = "shadow-[0_4px_16px_var(--vortyx-glow)]";

/* ─── Per-user storage ───────────────────────────────────────────────── */

function storageKey(userId: string, what: "session" | "seen"): string {
  return `avortyx.portal.support.${userId}.${what}`;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage disabled — the chat still works, it just won't survive a refresh */
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Telegram renders the ping as HTML, so <, > and & in a name can make the
 *  ping fail to send. Names don't need them; strip them out. */
function safeForTelegram(text: string): string {
  return text.replace(/[<>&]/g, " ").replace(/\s+/g, " ").trim();
}

/** The backend answers a rate-limited follow-up with 404 + "Too many
 *  messages", the same status as "session not found". Tell them apart. */
function isRateLimited(e: unknown): boolean {
  return e instanceof ApiError && /too many/i.test(e.message);
}

function isSessionGone(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404 && !isRateLimited(e);
}

function agentCount(messages: ChatMessage[]): number {
  return messages.filter((m) => m.sender === "agent").length;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(uiLocaleTag(), { hour: "numeric", minute: "2-digit" });
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function SupportChat() {
  const { t } = useTranslation();
  // Falls back to the English text when a key isn't in the translation files,
  // so the widget never shows a raw key.
  const tr = React.useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v === key ? fallback : v;
    },
    [t],
  );

  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [seenAgentCount, setSeenAgentCount] = React.useState(0);
  // CH-654: the picture waiting to be sent, with its local preview.
  const [picture, setPicture] = React.useState<{ file: File; preview: string } | null>(null);

  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const userId = user?.id ?? null;

  // Restore this user's conversation after a refresh or a re-login.
  React.useEffect(() => {
    if (!userId) return;
    setSessionId(readStored(storageKey(userId, "session")));
    setSeenAgentCount(Number(readStored(storageKey(userId, "seen")) ?? 0) || 0);
    setMessages([]);
  }, [userId]);

  const forgetSession = React.useCallback(() => {
    if (!userId) return;
    writeStored(storageKey(userId, "session"), null);
    writeStored(storageKey(userId, "seen"), null);
    setSessionId(null);
    setMessages([]);
    setSeenAgentCount(0);
  }, [userId]);

  const markSeen = React.useCallback(
    (list: ChatMessage[]) => {
      if (!userId) return;
      const n = agentCount(list);
      setSeenAgentCount(n);
      writeStored(storageKey(userId, "seen"), String(n));
    },
    [userId],
  );

  const loadTranscript = React.useCallback(
    async (id: string) => {
      try {
        const transcript = await supportService.fetchSession(id);
        setMessages(transcript.messages);
        return transcript.messages;
      } catch (e) {
        // The conversation was removed on the backend — start fresh next time.
        if (isSessionGone(e)) forgetSession();
        return null;
      }
    },
    [forgetSession],
  );

  // Check for replies: often while open, rarely while closed, never while the
  // tab is hidden or there's no conversation yet.
  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (document.visibilityState !== "hidden") {
        const list = await loadTranscript(sessionId);
        if (!cancelled && list && open) markSeen(list);
      }
      if (!cancelled) timer = window.setTimeout(tick, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, open, loadTranscript, markSeen]);

  // Keep the newest message in view, and put the cursor in the box on open.
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages.length]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // CH-654: one picture at a time; checked here as the server checks it.
  const pickPicture = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!SUPPORT_PICTURE_TYPES.includes(file.type)) {
        toast.error(tr("supportChat.pictureType", "Only PNG, JPG, GIF or WEBP pictures can be sent."));
        return;
      }
      if (file.size > SUPPORT_PICTURE_MAX_BYTES) {
        toast.error(tr("supportChat.pictureTooBig", "The picture is larger than 2 MB."));
        return;
      }
      setPicture((old) => {
        if (old) URL.revokeObjectURL(old.preview);
        return { file, preview: URL.createObjectURL(file) };
      });
      inputRef.current?.focus();
    },
    [tr],
  );

  const dropPicture = React.useCallback(() => {
    setPicture((old) => {
      if (old) URL.revokeObjectURL(old.preview);
      return null;
    });
  }, []);

  if (!user) return null;

  const firstName = (user.name || "").trim().split(/\s+/)[0] || "";
  const unread = agentCount(messages) > seenAgentCount;
  const waitingForTeam = messages.length > 0 && agentCount(messages) === 0;

  /** What the team sees as the sender in Telegram: who, which organisation,
   *  and which page the conversation started on. */
  const identity = safeForTelegram(
    [user.name || user.email, user.organization, pathname ? `page ${pathname}` : ""]
      .filter(Boolean)
      .join(" · "),
  ).slice(0, NAME_MAX);

  async function startConversation(text: string): Promise<string> {
    const result = await supportService.startChat({
      name: identity,
      email: user!.email,
      message: text,
    });
    writeStored(storageKey(user!.id, "session"), result.sessionId);
    setSessionId(result.sessionId);
    return result.sessionId;
  }

  async function send() {
    const text = draft.trim();
    const pic = picture;
    if ((!text && !pic) || sending) return;
    setSending(true);

    // Show it straight away; the transcript reload below replaces it.
    const optimistic: ChatMessage = {
      sender: "visitor",
      body: text,
      imageUrl: pic?.preview,
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    setPicture(null);

    try {
      let id = sessionId;
      if (pic) {
        // CH-654: a chat cannot start with a picture alone, so a new one opens
        // with the text (or "Picture"), and the picture follows it.
        const opening = text || tr("supportChat.pictureOnly", "📷 Picture");
        if (!id) {
          id = await startConversation(opening);
          await supportService.sendPicture(id, pic.file);
        } else {
          try {
            await supportService.sendPicture(id, pic.file, text);
          } catch (e) {
            if (!isSessionGone(e)) throw e;
            id = await startConversation(opening);
            await supportService.sendPicture(id, pic.file);
          }
        }
      } else if (!id) {
        id = await startConversation(text);
      } else {
        try {
          await supportService.sendMessage(id, { message: text });
        } catch (e) {
          if (!isSessionGone(e)) throw e;
          // The old conversation no longer exists: open a new one with this message.
          id = await startConversation(text);
        }
      }
      const list = await loadTranscript(id);
      if (list) markSeen(list);
      if (pic) URL.revokeObjectURL(pic.preview);
    } catch (e) {
      // Take the optimistic bubble back out and give the text (and picture) back.
      setMessages((m) => m.filter((x) => x !== optimistic));
      setDraft(text);
      if (pic) setPicture(pic);
      toast.error(
        isRateLimited(e)
          ? tr("supportChat.tooFast", "You're sending messages too quickly. Please wait a moment.")
          : friendlyErrorMessage(e, tr("supportChat.sendFailed", "Couldn't send your message. Please try again.")),
      );
    } finally {
      setSending(false);
    }
  }

  /** CH-654: a picture pasted into the box (a screenshot, a copied image)
   *  is attached instead of being lost; pasted text works as before. */
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = Array.from(e.clipboardData?.items ?? []).find(
      (i) => i.kind === "file" && i.type.startsWith("image/"),
    );
    if (!item) return;
    e.preventDefault();
    pickPicture(item.getAsFile());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  function toggle() {
    setOpen((was) => {
      if (!was) markSeen(messages);
      return !was;
    });
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={tr("supportChat.title", "Support")}
          className="fixed right-4 bottom-20 z-40 flex h-[min(520px,calc(100svh-7rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl sm:right-6"
        >
          {/* Accent hairline, as along the top of the topbar */}
          <div aria-hidden className="h-px w-full bg-white/10" />

          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-800 text-white shadow-sm">
                <MessageCircle className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold">{tr("supportChat.title", "Support")}</p>
                <p className="text-[13px] text-foreground/70">
                  {tr("supportChat.subtitle", "Our team replies here. You can close this and come back.")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {sessionId && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={forgetSession}
                  title={tr("supportChat.newConversation", "Start a new conversation")}
                  aria-label={tr("supportChat.newConversation", "Start a new conversation")}
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label={tr("supportChat.close", "Close")}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="rounded-lg bg-muted px-3 py-2 text-[15px] leading-relaxed">
                {firstName
                  ? `${tr("supportChat.greetingNamed", "Hi")} ${firstName}, ${tr("supportChat.greetingAsk", "how can we help?")}`
                  : tr("supportChat.greeting", "Hi, how can we help?")}
              </div>
            ) : (
              messages.map((m, i) => {
                const mine = m.sender === "visitor";
                return (
                  <div key={m.id ?? `local-${i}`} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    {!mine && (
                      <span className="mb-0.5 text-xs font-medium text-foreground/70">
                        {tr("supportChat.teamName", "Avortyx Support")}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                        mine ? "bg-zinc-700 text-white" : "bg-accent text-accent-foreground",
                        m.imageUrl && "p-1.5",
                      )}
                    >
                      {m.imageUrl && (
                        <a href={supportPictureSrc(m.imageUrl)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={supportPictureSrc(m.imageUrl)}
                            alt={tr("supportChat.picture", "Picture")}
                            loading="lazy"
                            className="block max-h-56 max-w-full rounded-md object-contain"
                          />
                        </a>
                      )}
                      {m.body && <div className={cn(m.imageUrl && "px-1.5 pt-1.5 pb-0.5")}>{m.body}</div>}
                    </div>
                    <span className="mt-0.5 text-xs text-foreground/60">{formatTime(m.createdAt)}</span>
                  </div>
                );
              })
            )}
            {waitingForTeam && (
              <p className="text-center text-[13px] text-foreground/70">
                {tr("supportChat.sent", "Sent to our support team. Their reply will appear here.")}
              </p>
            )}
          </div>

          {/* CH-654: the picture waiting to be sent */}
          {picture && (
            <div className="flex items-center gap-2 border-t px-3 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picture.preview} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="truncate">{picture.file.name || tr("supportChat.picture", "Picture")}</p>
                <p className="text-foreground/60">{(picture.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={dropPicture}
                disabled={sending}
                aria-label={tr("supportChat.removePicture", "Remove picture")}
                title={tr("supportChat.removePicture", "Remove picture")}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {/* Composer */}
          <div className="flex items-end gap-2 border-t p-3">
            <input
              ref={fileRef}
              type="file"
              accept={SUPPORT_PICTURE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                pickPicture(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              aria-label={tr("supportChat.attachPicture", "Attach a picture (up to 2 MB)")}
              title={tr("supportChat.attachPicture", "Attach a picture (up to 2 MB)")}
            >
              <ImagePlus className="size-4" />
            </Button>
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={2}
              maxLength={4000}
              placeholder={tr("supportChat.placeholder", "Type your question…")}
              className="max-h-32 min-h-10 resize-none text-[15px]"
              disabled={sending}
            />
            <Button
              size="icon"
              className={DARK}
              onClick={() => void send()}
              disabled={sending || (!draft.trim() && !picture)}
              aria-label={tr("supportChat.send", "Send")}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* The bubble */}
      <Button
        onClick={toggle}
        size="icon-lg"
        className={cn(
          "fixed right-4 bottom-4 z-40 size-12 rounded-full sm:right-6 sm:bottom-6",
          BUBBLE,
          BUBBLE_GLOW,
        )}
        aria-label={open ? tr("supportChat.close", "Close") : tr("supportChat.open", "Need help? Chat with support")}
        title={open ? undefined : tr("supportChat.open", "Need help? Chat with support")}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        {!open && unread && (
          <span className="absolute top-0 right-0 size-3 rounded-full border-2 border-background bg-destructive" />
        )}
      </Button>
    </>
  );
}