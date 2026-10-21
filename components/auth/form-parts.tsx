"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The pieces the sign-in and reset-password forms share: the floating-label field, the email check,
// the primary button and the note under a form (what came back from the server).

// A field whose label sits inside it like a placeholder, then floats to the top edge when the field
// has focus or a value. On focus a gradient rim (in the Avortyx blues) and a soft glow light up round it: the
// rim is a layer behind the input showing through its transparent border. Icon and label come after
// the input in the markup so they can follow its state (peer-focus, peer-placeholder-shown).
export function FloatingField({
  id, name, type, label, icon: Icon, autoComplete, trailing, inputProps, error,
}: {
  id: string; name: string; type: string; label: string; icon: LucideIcon; autoComplete: string; trailing?: React.ReactNode;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>; error?: string;
}) {
  return (
    <div>
      <div className="group/field relative">
        <span aria-hidden="true" className="pointer-events-none absolute -inset-[3px] rounded-[19px] bg-[linear-gradient(110deg,rgba(59,130,246,0.5),rgba(96,165,250,0.4))] opacity-0 blur-md transition-opacity duration-300 group-focus-within/field:opacity-40" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(110deg,var(--color-keppel-400),var(--color-signal-300)_55%,var(--color-keppel-500))] opacity-0 transition-opacity duration-300 group-focus-within/field:opacity-100" />
        <input
          id={id}
          name={name}
          type={type}
          placeholder=" "
          autoComplete={autoComplete}
          data-lpignore="true"
          data-1p-ignore="true"
          {...inputProps}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? `${id}-error` : "", inputProps?.["aria-describedby"] ?? ""].join(" ").trim() || undefined}
          className={cn(
            // (16px on touch screens: iOS zooms the page into a field whose text is any smaller as it takes focus)
            "peer relative h-[54px] w-full rounded-2xl border bg-[#0b1222] bg-clip-padding pb-[4px] pl-[44px] pt-[19px] text-[14px] leading-[20px] text-foreground outline-none pointer-coarse:text-[16px]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-12px_24px_-18px_rgba(0,0,0,0.6)] transition-[border-color,background-color] duration-200",
            // a soft red rim while the field has a problem
            error ? "border-[#f0a0a8]/45 hover:border-[#f0a0a8]/60" : "border-white/10 hover:border-white/20",
            "focus:border-transparent focus:bg-[#0d1528]",
            trailing ? "pr-12" : "pr-4",
            inputProps?.className,
          )}
        />
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-[16px] top-[19px] h-[16px] w-[16px] text-muted-foreground transition-colors duration-200 peer-[:not(:placeholder-shown)]:text-foreground/70 peer-focus:text-signal-300!"
        />
        <label
          htmlFor={id}
          className={cn(
            // placed in whole pixels, never shifted by half its height, so the text stays sharp
            "pointer-events-none absolute left-[44px] top-[20px] origin-left text-[14px] leading-[14px] transition-all duration-200",
            error ? "text-[#f3b2b8]" : "text-muted-foreground peer-focus:text-signal-300",
            // floated: small, near the top edge
            "peer-focus:top-[10px] peer-focus:text-[11px] peer-focus:font-medium peer-focus:tracking-[0.04em]",
            "peer-[:not(:placeholder-shown)]:top-[10px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:tracking-[0.04em]",
          )}
        >
          {label}
        </label>
        {trailing}
      </div>
      {/* the field's problem, if it has one, read out as it appears */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <span className="block pl-[4px] pt-[6px] text-xs text-[#f3b2b8]">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// a quiet check at the end of an email field, once the address looks right
export function EmailCheck({ ok }: { ok: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {ok && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-none absolute right-[16px] top-[18px] grid h-[18px] w-[18px] place-items-center rounded-full bg-signal-400/15 text-signal-300 ring-1 ring-inset ring-signal-400/30"
        >
          <Check className="h-[11px] w-[11px]" strokeWidth={3} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// what's wrong with an email address, if anything (a translation key, lib/i18n/extra/sign-in.ts)
export function emailProblem(email: string) {
  if (!email.trim()) return "signIn.emailRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return "signIn.emailInvalid";
  return undefined;
}

// the bright primary button: a sheen crosses it on hover; while pending, a spinner and `busy`;
// `disabled` (the 2FA code not yet whole) dims it.
// In High Contrast its gradient goes, so it gets a border to stay a button.
export const PRIMARY = "group relative flex forced-colors:border h-[46px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,var(--color-keppel-500),var(--color-keppel-600)_50%,#1d4ed8)] text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(59,130,246,0.65),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.2)] outline-none transition-[filter,box-shadow] duration-300 hover:shadow-[0_16px_40px_-12px_rgba(59,130,246,0.8),0_0_0_1px_rgba(96,165,250,0.25),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 focus-visible:ring-4 focus-visible:ring-signal-400/30 disabled:cursor-progress";
export function PrimaryButton({ pending, idle, busy, disabled }: { pending: boolean; idle: string; busy: string; disabled?: boolean }) {
  return (
    <motion.button type="submit" disabled={pending || disabled} whileTap={{ scale: 0.985 }} className={disabled && !pending ? `${PRIMARY} opacity-60` : PRIMARY}>
      <ButtonShine />
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span key="pending" className="relative inline-flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {busy}
          </motion.span>
        ) : (
          <motion.span key="idle" className="relative inline-flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {idle}
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
// the sheen and the top glint, for anything styled as PRIMARY
export function ButtonShine() {
  return (
    <>
      {/* the sheen: a soft band of light crossing the button while hovered */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity group-hover:animate-[login-shimmer_1.6s_ease-in-out_infinite] group-hover:opacity-100" />
      {/* a light blue glint along the top edge */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-signal-200/70 to-transparent" />
    </>
  );
}

// the note under a form: what came back from the server, read out
export function FormNote({ note }: { note: string }) {
  return (
    <AnimatePresence initial={false}>
      {note && (
        <motion.p
          key="note"
          role="status"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <span className="block rounded-xl border border-[var(--color-keppel-400)]/30 bg-[var(--color-keppel-500)]/10 px-[12px] py-[10px] text-xs text-[#c3cfe6]">{note}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
