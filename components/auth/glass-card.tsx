"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { AvortyxMark } from "@/components/brand/avortyx-logo";
import { cn } from "@/lib/utils";
import { BACKDROP_EVENT, type BackdropSignal } from "@/components/backdrop/backdrop-signal";

// The glass card every screen uses (sign-in, reset password, not found), in layers from the outside in:
//  1. a wide blue glow beneath it, lifting it off the backdrop;
//  2. a 1px gradient rim (light catching the top-left and bottom-right edges), with a point of light
//     travelling slowly round it (.edge-light, globals.css) and, under a mouse, a brighter patch of
//     rim nearest the pointer;
//  3. the glass: obsidian at 92% (it stands in front of the network behind it), a heavy blur, a 1px inner hairline and a top
//     highlight, so it reads as a thick pane rather than a flat panel; under a mouse a soft light
//     follows the pointer across it, and the pane leans a degree or two towards it (level again
//     while one of its fields has focus, so it holds still for typing);
//  4. the mark in its tile, its three rings orbiting slowly (spinning while a sign-in is sent);
//  5. a title and a line, the screen's content, and at its foot, set apart on a darker band, an
//     optional line (on the sign-in card: for publishers and buyers, who don't sign in here), and
//     `below`, anything to show under the card.
// It rises and settles in as the page opens (CSS, globals.css: .card-in, so it shows without waiting
// for JavaScript). For reduced motion: no lean, no orbit.

const LEAN = 2.5; // degrees, at the card's edge

// `fixed`: the size of the card on app.avortyx.io's sign-in, 348 x 582px on wide screens (less tall
// on short windows), its content centred and its foot at the bottom (the sign-in and reset cards);
// taller only when its content needs it (the code step with a message under it), so nothing is cut
// off; otherwise as tall as its content (not found)
export function GlassCard({
  title, subtitle, children, foot, below, fixed = false,
}: {
  title: React.ReactNode; subtitle: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode; below?: React.ReactNode; fixed?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });

  // the pointer's place on the card, for the light (CSS variables, so React doesn't re-render)
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
    ref.current.dataset.lit = "";
    const typing = ref.current.contains(document.activeElement) && document.activeElement?.tagName === "INPUT";
    if (!reduced && !typing) {
      ry.set(((x / b.width) * 2 - 1) * LEAN);
      rx.set(-((y / b.height) * 2 - 1) * LEAN);
    } else {
      rx.set(0);
      ry.set(0);
    }
  }
  function onLeave() {
    delete ref.current?.dataset.lit;
    rx.set(0);
    ry.set(0);
  }

  // while a sign-in is on its way, the mark spins; a field taking focus sends a light round the rim
  // as the AI's pulse arrives along the wire (circuit-field.tsx)
  useEffect(() => {
    let timer = 0, heard = 0;
    const onSignal = (e: Event) => {
      const kind = (e as CustomEvent<BackdropSignal>).detail.kind, el = ref.current;
      if (kind === "focus" && el) {
        window.clearTimeout(heard);
        heard = window.setTimeout(() => {
          delete el.dataset.heard;
          void el.offsetWidth;
          el.dataset.heard = "";
        }, 450);
      }
      if (kind !== "submit" || !ref.current) return;
      ref.current.dataset.busy = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => delete ref.current?.dataset.busy, 1100);
    };
    window.addEventListener(BACKDROP_EVENT, onSignal);
    return () => {
      window.removeEventListener(BACKDROP_EVENT, onSignal);
      window.clearTimeout(timer);
      window.clearTimeout(heard);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      data-card=""
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onFocus={() => {
        rx.set(0);
        ry.set(0);
      }}
      className="card-in group/card relative w-full max-w-[27rem] lg:max-w-[348px]"
    >
      {/* 1. the glow beneath */}
      <div aria-hidden="true" className="absolute -inset-12 -z-10 rounded-[3rem] forced-colors:hidden bg-[radial-gradient(closest-side,rgba(59,130,246,0.3),rgba(96,165,250,0.09)_60%,transparent)] blur-2xl" />

      {/* 2. the rim */}
      <div className={cn("relative rounded-[21px] p-px", fixed && "lg:flex lg:min-h-[min(582px,calc(100dvh-196px))] lg:flex-col", "bg-[linear-gradient(150deg,rgba(147,197,253,0.42),rgba(255,255,255,0.08)_28%,rgba(255,255,255,0.04)_60%,rgba(96,165,250,0.3))] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95),0_0_0_1px_rgba(2,4,10,0.6),0_0_90px_-18px_rgba(59,130,246,0.6),0_0_24px_-8px_rgba(96,165,250,0.35)]")}>
        <span aria-hidden="true" className="edge-light" />
        <span aria-hidden="true" className="edge-orbit" />
        <span aria-hidden="true" className="rim-light" />

        {/* 3. the glass */}
        <div className="relative flex h-full flex-1 flex-col overflow-hidden rounded-[20px] forced-colors:border bg-obsidian-850/[0.92] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-xl backdrop-saturate-150">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-keppel-200)]/60 to-transparent" />
          <span aria-hidden="true" className="pointer-events-none absolute -top-28 left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-[var(--color-keppel-500)]/[0.12] blur-3xl" />
          {/* the light following the pointer */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-data-[lit]/card:opacity-100 bg-[radial-gradient(380px_circle_at_var(--mx,50%)_var(--my,0%),rgba(147,197,253,0.09),transparent_45%)]"
          />

          <div className="relative flex flex-1 flex-col justify-center px-7 pb-7 pt-8 short:pb-5 short:pt-6 sm:px-8">
            <div className="mb-7 flex flex-col items-center gap-4 text-center short:mb-5 short:gap-3">
              {/* 4. the mark */}
              <span className="relative grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(59,130,246,0.55)] short:hidden">
                <AvortyxMark id="auth" className="mark-orbit h-[30px] w-[30px]" />
              </span>
              <div>
                <h1 className="font-display text-[26px] font-semibold leading-[32px] tracking-[-0.025em] text-foreground short:text-[22px] short:leading-[28px]">
                  {title}
                </h1>
                <p className="mt-[6px] text-[13px] leading-[20px] text-muted-foreground">{subtitle}</p>
              </div>
            </div>

            {children}
          </div>

          {/* 5. the foot */}
          {foot && (
            <div className="relative flex items-start gap-[12px] border-t border-white/[0.06] bg-obsidian-950/40 px-7 py-[14px] short:py-3 sm:px-8">{foot}</div>
          )}
        </div>
      </div>

      {below}
    </motion.div>
  );
}
