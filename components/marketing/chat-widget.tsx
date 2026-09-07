"use client";

/**
 * Marketing-site chat widget.
 *
 * Pattern:
 *   • Floating FAB bottom-right. Click to expand the panel.
 *   • The AI assistant ("Avortyx AI") handles the opening exchange via the
 *     Anthropic-proxy /api/chat endpoint.
 *   • After the AI replies, a "Talk to a person" escalation row offers the
 *     visitor 3 live team members or a direct path to Sales / Support.
 *   • When the visitor escalates, the panel switches into "live agent" mode —
 *     the header shows the agent's avatar, the next bubbles read as the
 *     agent's, and the operator console gets a real-time push notification
 *     ("Live chat request from a website visitor — handed to Maya").
 *   • Quick-reply chips sit above the composer for one-click intents
 *     (Pricing / Book a demo / Docs).
 *
 * Visual: a dark, gradient-accented floating panel. This is a deliberate
 * exception to the flat, restrained marketing sections — the widget is an
 * overlay on a light page, so it carries the gradient + glow the page
 * sections intentionally don't. Colours come from the `--m-*` tokens defined
 * on `.marketing-shell`, which wraps this widget; every accent-derived value
 * resolves through a var so the green/blue switcher still applies.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Headphones,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/http";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { supportService, type ChatMessage } from "@/lib/api/services/support.service";
import { pushNotification } from "@/lib/store/push-notifications-store";
import {
  getGuestIdentity,
  getStoredSessionId,
  storeSessionId,
} from "@/lib/support-guest-identity";

/* Poll interval for fetching agent replies (ms). 3s is the sweet spot
   between "feels live" and "doesn't hammer the backend". */
const AGENT_POLL_MS = 3000;

type Sender = "user" | "ai" | "agent" | "system";

interface Message {
  sender: Sender;
  content: string;
  /** Only set on agent messages. */
  agentId?: string;
  /** ms since epoch — drives the timestamp under each bubble. */
  at: number;
}

interface TeamMember {
  id: string;
  /** Two-letter initials — fallback only, used when the avatar image fails. */
  initials: string;
  /** Public-path portrait. When set, renders as <img> instead of initials. */
  avatar?: string;
  nameKey: string;
  roleKey: string;
  /** Tone class powering the avatar background + status dot. */
  tone: "accent" | "success" | "warning";
}

const TEAM: TeamMember[] = [
  {
    id: "maya",
    initials: "MR",
    avatar: "/avatars/83bde38df094aca69d1d004cafe2f7a2-1768088403848.webp",
    nameKey: "marketingUI.chat.team.maya.name",
    roleKey: "marketingUI.chat.team.maya.role",
    tone: "accent",
  },
  {
    id: "jordan",
    initials: "JK",
    avatar: "/avatars/c810599af876418d92d1781cb23e9cefydNGi.webp",
    nameKey: "marketingUI.chat.team.jordan.name",
    roleKey: "marketingUI.chat.team.jordan.role",
    tone: "success",
  },
  {
    id: "sofia",
    initials: "LP",
    avatar: "/avatars/e691af3ba1427582bb1b2cdf8a9d1f98-1770277350458.webp",
    nameKey: "marketingUI.chat.team.sofia.name",
    roleKey: "marketingUI.chat.team.sofia.role",
    tone: "warning",
  },
];

/* Initials-fallback treatment per tone. Deliberately quiet — these only
   surface when a portrait fails to decode. Dark-panel variants. */
const TONE_BG: Record<TeamMember["tone"], React.CSSProperties> = {
  accent: {
    background: "var(--m-accent-tint-d)",
    color: "var(--m-accent-d)",
    border: "1px solid var(--m-accent-line-d)",
  },
  success: {
    background: "var(--m-bg-dark-3)",
    color: "var(--m-fg-d2)",
    border: "1px solid var(--m-line-d)",
  },
  warning: {
    background: "var(--m-bg-dark-3)",
    color: "var(--m-fg-d2)",
    border: "1px solid var(--m-line-d)",
  },
};

const QUICK_REPLIES = [
  { id: "pricing", labelKey: "marketingUI.chat.quick.pricing" },
  { id: "demo", labelKey: "marketingUI.chat.quick.demo" },
  { id: "docs", labelKey: "marketingUI.chat.quick.docs" },
];

/* Quiet, standard easing — no spring, no overshoot. */
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

export function ChatWidget() {
  const { t } = useTranslation();
  const greeting = React.useMemo<Message>(
    () => ({
      sender: "ai",
      content: t("marketingUI.chat.greeting"),
      at: Date.now(),
    }),
    [t],
  );
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([greeting]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  /** When set, the visitor is now talking to that team member. */
  const [activeAgent, setActiveAgent] = React.useState<TeamMember | null>(null);
  const [showEscalation, setShowEscalation] = React.useState(false);
  /** Backend session id for the active human-agent conversation. */
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  /** Dedupe key set for agent messages we've already inserted into local state
   *  (poller fires every few seconds and gets the full transcript each time). */
  const seenAgentKeys = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending, showEscalation]);

  /** Surface the "Talk to a human" CTA the moment the AI sends its first
   *  follow-up reply — i.e. once there's a real exchange in flight. */
  const seenAiResponses = React.useMemo(
    () => messages.filter((m) => m.sender === "ai").length,
    [messages],
  );
  React.useEffect(() => {
    if (seenAiResponses >= 2 && !activeAgent) {
      setShowEscalation(true);
    }
  }, [seenAiResponses, activeAgent]);

  /* Poll the support transcript for agent replies. Runs only when the
     widget is open AND a session exists. Agent messages from the backend
     are dedup'd against `seenAgentKeys` so we never insert the same one
     twice. We deliberately do NOT mirror visitor messages from the
     backend — those already live in local state, and round-tripping them
     would cause flicker. Polling stops as soon as the panel closes or
     the agent is dismissed. */
  React.useEffect(() => {
    if (!open || !activeAgent || !sessionId) return;
    let cancelled = false;
    let consecutiveFailures = 0;

    const tick = async () => {
      try {
        const transcript = await supportService.fetchSession(sessionId);
        if (cancelled) return;
        consecutiveFailures = 0;
        const fresh = transcript.messages
          .filter((m) => m.sender === "agent")
          .filter((m) => {
            const key = agentMessageKey(m);
            if (seenAgentKeys.current.has(key)) return false;
            seenAgentKeys.current.add(key);
            return true;
          });
        if (fresh.length > 0) {
          setMessages((prev) => [
            ...prev,
            ...fresh.map<Message>((m) => ({
              sender: "agent",
              agentId: activeAgent.id,
              content: m.body,
              at: m.createdAt,
            })),
          ]);
        }
      } catch {
        // Silent for transient failures so we don't toast every 3 seconds.
        // After several in a row we assume the session is gone or the
        // backend is down; surface one toast then back off.
        consecutiveFailures += 1;
        if (consecutiveFailures === 5) {
          toast.error(t("marketingUI.chat.pollLost"));
        }
      }
    };

    // Run once immediately so the visitor sees agent replies the moment
    // they pop the panel open, then on the regular cadence.
    void tick();
    const id = window.setInterval(tick, AGENT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, activeAgent, sessionId, t]);

  const send = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || pending) return;

    const next: Message[] = [
      ...messages,
      { sender: "user", content: trimmed, at: Date.now() },
    ];
    setMessages(next);
    setInput("");
    setPending(true);

    // When a human agent is active, route through the real support API.
    // First message of a session → POST /api/support/chat (creates the
    // session + Telegrams the operator). Subsequent messages → POST
    // /api/support/chat/{sessionId}. Polling (in a separate effect)
    // picks up the operator's replies.
    if (activeAgent) {
      try {
        if (!sessionId) {
          const guest = getGuestIdentity();
          const result = await supportService.startChat({
            name: guest.name,
            email: guest.email,
            message: trimmed,
            agentId: activeAgent.id,
          });
          setSessionId(result.sessionId);
          storeSessionId(activeAgent.id, result.sessionId);
        } else {
          await supportService.sendMessage(sessionId, { message: trimmed });
        }
      } catch (err) {
        const friendly =
          err instanceof ApiError && err.status === 429
            ? t("marketingUI.chat.rateLimited")
            : friendlyErrorMessage(err, t("marketingUI.chat.sendFailed"));
        toast.error(friendly);
        // Roll back the optimistic user bubble so the visitor knows it
        // didn't go through and can retry.
        setMessages((m) => m.slice(0, -1));
        setInput(trimmed);
      } finally {
        setPending(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply =
        data.reply?.trim() ||
        (data.error
          ? `${t("marketingUI.chat.errorPrefix")}${data.error}`
          : t("marketingUI.chat.modelUnreachable"));
      setMessages((m) => [
        ...m,
        { sender: "ai", content: reply, at: Date.now() },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          sender: "ai",
          content: t("marketingUI.chat.networkError"),
          at: Date.now(),
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  /** Hand off to a team member. Switches the panel into "agent" mode and
   *  resumes any stored session for that agent. The agent's first reply
   *  comes from the real backend (via Telegram), not from the frontend —
   *  so we no longer inject a fake intro message here. */
  const handoff = (member: TeamMember, intent: "sales" | "support" | "direct") => {
    setActiveAgent(member);
    setShowEscalation(false);
    // Reset agent-message dedupe set + restore any stored session id so a
    // page refresh continues the same Telegram thread.
    seenAgentKeys.current = new Set();
    const stored = getStoredSessionId(member.id);
    setSessionId(stored);
    setMessages((m) => [
      ...m,
      {
        sender: "system",
        content: t("marketingUI.chat.handoffSystem")
          .replace("{name}", t(member.nameKey))
          .replace("{role}", t(member.roleKey)),
        at: Date.now(),
      },
    ]);
    // Real-time alert to the operator surface (in-app push banner). This
    // is intentionally a local notification — the *real* Telegram ping is
    // sent server-side when the visitor's first message hits POST /api/support/chat.
    pushNotification({
      severity: "info",
      icon: "spark",
      title: t("marketingUI.chat.notify.title"),
      body: t("marketingUI.chat.notify.body")
        .replace("{name}", t(member.nameKey))
        .replace("{intent}", t(`marketingUI.chat.intents.${intent}`)),
      source: t("marketingUI.chat.notify.source"),
      action: t("marketingUI.chat.notify.action"),
    });
    toast.success(
      t("marketingUI.chat.handoffToast").replace("{name}", t(member.nameKey)),
    );
  };

  const sendDisabled = pending || !input.trim();

  return (
    <>
      {/* Presentational-only stylesheet: hover/focus/placeholder states and
          the typing-dot keyframes. Kept here so every colour still resolves
          from the --m-* tokens.

          Anything with a hover/focus/disabled state has its *resting* paint
          declared here too, not inline — an inline style beats a class rule,
          so a hover that only lives in CSS can never override an inline
          background/border/colour. */}
      <style jsx global>{`
        .cw-focus:focus-visible {
          outline: 2px solid var(--m-accent-line-d);
          outline-offset: 2px;
        }
        /* FAB — reads as a lit object sitting on the light page. */
        .cw-fab {
          background: var(--m-grad-bright);
          box-shadow: var(--m-glow-lift);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .cw-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 0 0 1px var(--m-accent-line-d),
            0 14px 42px var(--m-accent-glow-d), 0 24px 64px rgba(0, 0, 0, 0.38);
        }
        .cw-icon-btn {
          background: transparent;
          color: var(--m-fg-d3);
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .cw-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--m-fg-d);
        }
        .cw-chip {
          border: 1px solid var(--m-line-d2);
          background: rgba(255, 255, 255, 0.04);
          color: var(--m-fg-d2);
          transition: background-color 0.15s ease, border-color 0.15s ease,
            color 0.15s ease;
        }
        .cw-chip:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.07);
          border-color: var(--m-accent-line-d);
          color: var(--m-fg-d);
        }
        .cw-chip:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cw-field {
          border: 1px solid var(--m-line-d2);
          border-radius: var(--m-r);
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .cw-field:focus-within {
          border-color: var(--m-accent-line-d);
          box-shadow: var(--m-glow-soft);
        }
        .cw-input::placeholder {
          color: var(--m-fg-d3);
        }
        .cw-send {
          background: var(--m-grad-bright);
          color: #fff;
          box-shadow: 0 2px 10px var(--m-accent-glow-d);
          transition: box-shadow 0.16s ease, background 0.16s ease;
        }
        .cw-send:not(:disabled):hover {
          box-shadow: 0 3px 18px var(--m-accent-glow-d);
        }
        .cw-send:disabled {
          background: rgba(255, 255, 255, 0.08);
          color: var(--m-fg-d3);
          box-shadow: none;
          cursor: not-allowed;
        }
        .cw-cta {
          flex: 1;
        }
        /* Beats .m-btn-ghost-dark:hover from globals.css on specificity so the
           panel's own hover tint wins regardless of stylesheet order. */
        .m-btn.cw-cta:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: var(--m-line-d2);
        }
        @keyframes chat-dot-pulse {
          0%,
          80%,
          100% {
            opacity: 0.25;
          }
          40% {
            opacity: 1;
          }
        }
        /* Static dots at rest; only animate when motion is welcome. */
        @media (prefers-reduced-motion: no-preference) {
          .cw-dot {
            animation: chat-dot-pulse 1.2s ease-in-out infinite;
          }
        }
        @keyframes cw-spin {
          to {
            transform: rotate(360deg);
          }
        }
        /* Local spinner instead of Tailwind's animate-spin utility, which
           globals.css does not reduced-motion gate. */
        @media (prefers-reduced-motion: no-preference) {
          .cw-spin {
            animation: cw-spin 0.9s linear infinite;
          }
        }
        .cw-panel {
          width: 380px;
        }
        @media (max-width: 440px) {
          .cw-panel {
            width: calc(100vw - 32px);
          }
        }
      `}</style>

      {/* Floating action button */}
      <button
        type="button"
        aria-label={open ? t("marketingUI.chat.closeLabel") : t("marketingUI.chat.openLabel")}
        onClick={() => setOpen((v) => !v)}
        className="cw-fab cw-focus"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 50,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 54,
          width: 54,
          borderRadius: 999,
          border: "none",
          padding: 0,
          color: "#fff",
          cursor: "pointer",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 20, opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE }}
              style={{ display: "inline-flex" }}
            >
              <X size={20} strokeWidth={1.75} />
            </motion.span>
          ) : (
            <motion.span
              key="msg"
              initial={{ rotate: 20, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -20, opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE }}
              style={{ display: "inline-flex" }}
            >
              <MessageCircle size={20} strokeWidth={1.75} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.995 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="cw-panel"
            style={{
              position: "fixed",
              bottom: 84,
              right: 20,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxWidth: "calc(100vw - 32px)",
              height: "min(560px, calc(100vh - 124px))",
              background: "var(--m-panel-dark)",
              border: "1px solid var(--m-line-d2)",
              borderRadius: "var(--m-r-lg)",
              boxShadow: "var(--m-glow-lift)",
              color: "var(--m-fg-d)",
              fontFamily: "var(--m-sans)",
            }}
            role="dialog"
            aria-label={t("marketingUI.chat.dialogLabel")}
          >
            {/* Accent wash pinned to the panel's top edge — makes the header
                area glow faintly without a second surface colour. Sits behind
                every content layer. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 200,
                zIndex: 0,
                pointerEvents: "none",
                background: "var(--m-panel-wash)",
              }}
            />
            {/* 1px gradient top edge */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                zIndex: 2,
                pointerEvents: "none",
                background: "var(--m-grad-bright)",
              }}
            />

            {/* Header — swaps between AI and active-agent identity */}
            <Header
              activeAgent={activeAgent}
              onClose={() => setOpen(false)}
            />

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                position: "relative",
                zIndex: 1,
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 16,
                background: "transparent",
              }}
            >
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  agent={
                    m.sender === "agent"
                      ? TEAM.find((tm) => tm.id === m.agentId) ?? null
                      : null
                  }
                />
              ))}
              {/* While `pending` is true we're awaiting a network response.
                  In AI mode that genuinely means the model is composing —
                  the typing dots next to the AI avatar reads correctly.
                  In human-agent mode it just means our POST is in flight;
                  the operator hasn't even seen the message yet, so showing
                  agent-side typing dots falsely implies "Milena is typing".
                  Render a user-side "Sending…" status there instead. */}
              {pending && (
                activeAgent
                  ? <SendingStatus />
                  : <TypingIndicator activeAgent={null} />
              )}
              {showEscalation && !activeAgent && (
                <EscalationCard onPick={handoff} />
              )}
            </div>

            {/* Quick replies — one-click suggestions above the composer */}
            {!activeAgent && (
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: "10px 16px",
                  background: "transparent",
                  borderTop: "1px solid var(--m-line-d)",
                }}
              >
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => void send(t(q.labelKey))}
                    disabled={pending}
                    className="cw-chip cw-focus"
                    /* Border/background/colour live in `.cw-chip` so the
                       hover state isn't out-specificity'd by an inline rule. */
                    style={{
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      lineHeight: 1.2,
                      padding: "6px 12px",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    {t(q.labelKey)}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                borderTop: "1px solid var(--m-line-d)",
                background: "transparent",
                padding: 12,
              }}
            >
              <div
                className="cw-field"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  padding: "5px 5px 5px 11px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={t("marketingUI.chat.placeholder")}
                  rows={1}
                  className="cw-input"
                  style={{
                    flex: 1,
                    resize: "none",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    padding: "6px 0",
                    maxHeight: 112,
                    minHeight: 22,
                    fontFamily: "inherit",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--m-fg-d)",
                  }}
                  disabled={pending}
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sendDisabled}
                  aria-label={t("marketingUI.chat.sendLabel")}
                  className="cw-send cw-focus"
                  /* Enabled/disabled paint lives in `.cw-send` + `.cw-send:disabled`
                     — same reason as the chips: inline would beat the hover rule. */
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    height: 32,
                    width: 32,
                    padding: 0,
                    border: "none",
                    borderRadius: "var(--m-r-sm)",
                    cursor: "pointer",
                  }}
                >
                  <Send size={15} strokeWidth={1.75} />
                </button>
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "0 2px",
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: "var(--m-fg-d3)",
                }}
              >
                <span>{t("marketingUI.chat.disclaimer")}</span>
                <TeamOnlineHint />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Header — AI or live-agent identity                                  */
/* ─────────────────────────────────────────────────────────────────── */

function Header({
  activeAgent,
  onClose,
}: {
  activeAgent: TeamMember | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--m-line-d)",
        /* Transparent so the panel's accent wash reads through. */
        background: "transparent",
      }}
    >
      {activeAgent ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <AgentAvatar member={activeAgent} size="md" pulse />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.006em",
                color: "var(--m-fg-d)",
                lineHeight: 1.3,
              }}
            >
              {t(activeAgent.nameKey)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                lineHeight: 1.4,
                color: "var(--m-fg-d3)",
              }}
            >
              <StatusDot live />
              <span>
                {t(activeAgent.roleKey)} · {t("marketingUI.chat.replyingNow")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 32,
              width: 32,
              flexShrink: 0,
              borderRadius: 999,
              background: "var(--m-accent-tint-d)",
              border: "1px solid var(--m-accent-line-d)",
              color: "var(--m-accent-d)",
            }}
          >
            <Sparkles size={16} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.006em",
                color: "var(--m-fg-d)",
                lineHeight: 1.3,
              }}
            >
              {t("marketingUI.chat.title")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                lineHeight: 1.4,
                color: "var(--m-fg-d3)",
              }}
            >
              <StatusDot />
              <span>{t("marketingUI.chat.status")}</span>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={t("marketingUI.chat.closeButton")}
        onClick={onClose}
        className="cw-icon-btn cw-focus"
        /* Colour + background come from `.cw-icon-btn` so the hover wins. */
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          height: 28,
          width: 28,
          padding: 0,
          border: "none",
          borderRadius: "var(--m-r-sm)",
          cursor: "pointer",
        }}
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** 6px accent status dot. `live` adds the design-system halo pulse. */
function StatusDot({ live }: { live?: boolean }) {
  return (
    <span
      aria-hidden
      className={live ? "m-pulse" : undefined}
      style={{
        display: "inline-block",
        flexShrink: 0,
        height: 6,
        width: 6,
        borderRadius: 999,
        background: "var(--m-accent-d)",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Escalation card — appears after the AI's first follow-up reply      */
/* ─────────────────────────────────────────────────────────────────── */

function EscalationCard({
  onPick,
}: {
  onPick: (member: TeamMember, intent: "sales" | "support" | "direct") => void;
}) {
  const { t } = useTranslation();
  const [maya, jordan, sofia] = TEAM;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      style={{
        border: "1px solid var(--m-line-d)",
        borderRadius: "var(--m-r)",
        background: "var(--m-bg-dark-2)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span className="m-label" style={{ color: "var(--m-accent-d)" }}>
          {t("marketingUI.chat.escalation.heading")}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--m-fg-d3)",
            whiteSpace: "nowrap",
          }}
        >
          <StatusDot live />
          {t("marketingUI.chat.escalation.online").replace("{count}", String(TEAM.length))}
        </span>
      </div>

      {/* Avatar row + small clickable handoff per member */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          {TEAM.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m, "direct")}
              title={t(m.nameKey)}
              aria-label={t(m.nameKey)}
              className="cw-focus"
              style={{
                display: "inline-flex",
                padding: 0,
                background: "transparent",
                border: "2px solid var(--m-panel-dark)",
                borderRadius: 999,
                marginLeft: i === 0 ? 0 : -6,
                position: "relative",
                zIndex: i,
                cursor: "pointer",
              }}
            >
              <AgentAvatar member={m} size="sm" />
            </button>
          ))}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            color: "var(--m-fg-d2)",
          }}
        >
          {t("marketingUI.chat.escalation.prompt")}
        </p>
      </div>

      {/* Sales / Support split-CTA */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onPick(maya, "sales")}
          className="m-btn m-btn-ghost-dark cw-cta cw-focus"
          style={{ fontSize: 13, padding: "8px 12px", gap: 6 }}
        >
          <Headphones size={15} strokeWidth={1.75} style={{ color: "var(--m-fg-d3)" }} />
          {t("marketingUI.chat.escalation.sales")}
        </button>
        <button
          type="button"
          onClick={() => onPick(jordan ?? sofia, "support")}
          className="m-btn m-btn-ghost-dark cw-cta cw-focus"
          style={{ fontSize: 13, padding: "8px 12px", gap: 6 }}
        >
          <LifeBuoy size={15} strokeWidth={1.75} style={{ color: "var(--m-fg-d3)" }} />
          {t("marketingUI.chat.escalation.support")}
        </button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Message bubble — AI / user / system / agent variants                */
/* ─────────────────────────────────────────────────────────────────── */

function MessageBubble({
  message,
  agent,
}: {
  message: Message;
  agent: TeamMember | null;
}) {
  const { t } = useTranslation();
  if (message.sender === "system") {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--m-fg-d3)",
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.sender === "user";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      {!isUser && (
        <>
          {agent ? (
            <AgentAvatar member={agent} size="sm" />
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 26,
                width: 26,
                flexShrink: 0,
                borderRadius: 999,
                background: "var(--m-accent-tint-d)",
                border: "1px solid var(--m-accent-line-d)",
                color: "var(--m-accent-d)",
              }}
            >
              <Sparkles size={14} strokeWidth={1.75} />
            </span>
          )}
        </>
      )}
      <div style={{ maxWidth: "82%", minWidth: 0 }}>
        <div
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            fontSize: 14,
            lineHeight: 1.55,
            padding: "9px 12px",
            borderRadius: "var(--m-r)",
            ...(isUser
              ? {
                  borderBottomRightRadius: "var(--m-r-xs)",
                  background: "var(--m-grad-accent)",
                  color: "#fff",
                  boxShadow: "0 2px 12px var(--m-accent-glow-d)",
                }
              : {
                  borderBottomLeftRadius: "var(--m-r-xs)",
                  background: "var(--m-bg-dark-2)",
                  border: "1px solid var(--m-line-d)",
                  color: "var(--m-fg-d)",
                }),
          }}
        >
          {message.content}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--m-fg-d3)",
            textAlign: isUser ? "right" : "left",
          }}
        >
          {isUser
            ? t("marketingUI.chat.you")
            : agent
              ? t(agent.nameKey)
              : t("marketingUI.chat.aiSender")}{" "}
          · {formatTime(message.at)}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Typing indicator — three pulsing dots                               */
/* ─────────────────────────────────────────────────────────────────── */

function TypingIndicator({ activeAgent }: { activeAgent: TeamMember | null }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      {activeAgent ? (
        <AgentAvatar member={activeAgent} size="sm" />
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 26,
            width: 26,
            flexShrink: 0,
            borderRadius: 999,
            background: "var(--m-accent-tint-d)",
            border: "1px solid var(--m-accent-line-d)",
            color: "var(--m-accent-d)",
          }}
        >
          <Sparkles size={14} strokeWidth={1.75} />
        </span>
      )}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "11px 12px",
          borderRadius: "var(--m-r)",
          borderBottomLeftRadius: "var(--m-r-xs)",
          background: "var(--m-bg-dark-2)",
          border: "1px solid var(--m-line-d)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="cw-dot"
            style={{
              display: "inline-block",
              height: 5,
              width: 5,
              borderRadius: 999,
              background: "var(--m-fg-d3)",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Sending status — user-side, while the POST is in flight             */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Right-aligned "Sending…" chip shown beneath the user's just-sent message
 * while the network request is in flight. Replaces the agent-typing bubble
 * in human-agent mode, where typing dots over an agent avatar wrongly
 * implied the agent was already composing a reply — when in reality the
 * message hasn't even reached the operator's Telegram yet.
 *
 * Visually deliberate: no avatar, no left-side bubble, no animated dots.
 * Just a small pill with a spinner that clearly reads as "your message is
 * being delivered," not "someone is replying."
 */
function SendingStatus() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <span
        role="status"
        aria-live="polite"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 999,
          border: "1px solid var(--m-line-d)",
          background: "rgba(255,255,255,0.04)",
          fontSize: 11,
          lineHeight: 1.3,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--m-fg-d3)",
        }}
      >
        <Loader2 size={14} strokeWidth={1.75} className="cw-spin" />
        {t("marketingUI.chat.sending")}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Team online hint at the bottom of the panel                         */
/* ─────────────────────────────────────────────────────────────────── */

function TeamOnlineHint() {
  const { t } = useTranslation();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {TEAM.map((m, i) =>
          m.avatar ? (
            <img
              key={m.id}
              src={m.avatar}
              alt=""
              title={t(m.nameKey)}
              loading="lazy"
              style={{
                height: 15,
                width: 15,
                borderRadius: 999,
                objectFit: "cover",
                border: "1px solid var(--m-panel-dark)",
                marginLeft: i === 0 ? 0 : -4,
              }}
            />
          ) : (
            <span
              key={m.id}
              title={t(m.nameKey)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 15,
                width: 15,
                borderRadius: 999,
                fontSize: 7,
                fontWeight: 600,
                marginLeft: i === 0 ? 0 : -4,
                ...TONE_BG[m.tone],
              }}
            >
              {m.initials.slice(0, 1)}
            </span>
          ),
        )}
      </span>
      <span>
        {t("marketingUI.chat.teamOnline").replace("{count}", String(TEAM.length))}
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Agent avatar — portrait (or initials) + online dot                   */
/* ─────────────────────────────────────────────────────────────────── */

function AgentAvatar({
  member,
  size = "sm",
  pulse,
}: {
  member: TeamMember;
  size?: "sm" | "md";
  pulse?: boolean;
}) {
  const px = size === "md" ? 32 : 26;
  // Photo failed to decode → fall back to initials so the chip never blanks.
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      {member.avatar && !imgFailed ? (
        <img
          src={member.avatar}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{
            height: px,
            width: px,
            borderRadius: 999,
            objectFit: "cover",
            border: "1px solid var(--m-accent-line-d)",
          }}
        />
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: px,
            width: px,
            borderRadius: 999,
            fontSize: size === "md" ? 11 : 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            ...TONE_BG[member.tone],
          }}
        >
          {member.initials}
        </span>
      )}
      <span
        aria-hidden
        className={pulse ? "m-pulse" : undefined}
        style={{
          position: "absolute",
          bottom: -1,
          right: -1,
          height: 8,
          width: 8,
          borderRadius: 999,
          background: "var(--m-accent-d)",
          border: "2px solid var(--m-panel-dark)",
          boxSizing: "content-box",
        }}
      />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Helpers                                                              */
/* ─────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m} ${period}`;
}

/** Stable identity for an agent message — prefer server id, fall back to
 *  timestamp + first 32 chars of body so we still dedupe on backends that
 *  don't return ids per message. */
function agentMessageKey(m: ChatMessage): string {
  return m.id ?? `${m.createdAt}:${m.body.slice(0, 32)}`;
}
