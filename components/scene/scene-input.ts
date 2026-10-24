"use client";

import { useEffect, useState } from "react";
import { BACKDROP_EVENT, type BackdropSignal } from "@/components/backdrop/backdrop-signal";

// Pointer and sign-in form state, read by the scene each frame without React re-renders.
// Only the status tag re-renders, via useAiMode().

export type AiMode = "Ready" | "Listening" | "Recognized" | "Not looking" | "Verifying" | "Welcome" | "Try again";

// smoothed frame step, so a hiccup frame doesn't make the animation jump
const clock = { frame: -1, step: 1 / 60 };
export function frameStep(frame: number, delta: number) {
  if (frame !== clock.frame) {
    clock.frame = frame;
    clock.step += (Math.min(0.05, delta) - clock.step) * 0.1;
  }
  return clock.step;
}

// pixel sizes scaled up on big or zoomed-out windows, so points keep their on-screen size
export const pointScale = (dpr: number, width: number, height: number) => dpr * Math.max(1, width / 1600, height / 1000);

export const input = {
  mouse: { x: 0, y: 0, px: -1e4, py: -1e4 }, // -1..1 across the window; and in CSS pixels
  focused: false,
  field: { x: 0, y: 0 }, // the focused field's centre, in CSS pixels
  ripple: 0,
  submittedAt: -1, // performance.now() of the last Sign in
  result: { at: -1, ok: false }, // and of its answer
  recognizedAt: -1, // when the email field last became a valid address
  degraded: false, // the platform's health, from the live strip
  hover: "" as "" | "submit" | "forgot", // what in the card the mouse is over
  dial: 0, // keystrokes in the password, each a notch of her dial
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let emailValid = false;


let mode: AiMode = "Ready";
const listeners = new Set<(m: AiMode) => void>();
export function setMode(next: AiMode) {
  if (next === mode) return;
  mode = next;
  listeners.forEach((f) => f(next));
}

export function useAiMode() {
  const [m, set] = useState<AiMode>(mode);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return m;
}

export function listen() {
  const onSignal = (ev: Event) => {
    const sig = (ev as CustomEvent<BackdropSignal>).detail;
    if (sig.kind === "focus") {
      input.focused = true;
      const r = document.activeElement?.getBoundingClientRect();
      if (r) input.field = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } else if (sig.kind === "blur") input.focused = false;
    else if (sig.kind === "submit") input.submittedAt = performance.now();
    else if (sig.kind === "result") input.result = { at: performance.now(), ok: sig.ok };
    else if (sig.kind === "status") input.degraded = sig.degraded;
  };
  const onInput = (ev: Event) => {
    const el = ev.target as HTMLInputElement | null;
    if (!el?.closest?.("[data-card]")) return;
    input.ripple = Math.min(1, input.ripple + 0.6);
    if (el.id === "password") input.dial++;
    if (el.type === "email") {
      const valid = EMAIL.test(el.value.trim());
      if (valid && !emailValid) input.recognizedAt = performance.now();
      emailValid = valid;
    }
  };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    input.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    input.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    input.mouse.px = e.clientX;
    input.mouse.py = e.clientY;
    const over = e.target as Element | null;
    input.hover = over?.closest?.("[data-card] button[type=submit]") ? "submit" : over?.closest?.('[data-card] a[href*="forgot"]') ? "forgot" : "";
  };
  const onLeave = () => {
    input.mouse.px = input.mouse.py = -1e4;
  };
  input.degraded = document.documentElement.dataset.systemStatus === "degraded";
  window.addEventListener(BACKDROP_EVENT, onSignal);
  document.addEventListener("input", onInput, true);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  return () => {
    window.removeEventListener(BACKDROP_EVENT, onSignal);
    document.removeEventListener("input", onInput, true);
    window.removeEventListener("pointermove", onPointer);
    document.documentElement.removeEventListener("pointerleave", onLeave);
  };
}
