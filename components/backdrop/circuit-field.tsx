"use client";

import { useEffect, useRef } from "react";
import { BACKDROP_EVENT, type BackdropSignal } from "./backdrop-signal";
import { textRight, useAiPlacement, type Placement } from "@/components/scene/use-ai-placement";

// The circuit board the sign-in card sits on as a chip (glass-card.tsx), on wide screens where the
// card stands beside the intro: one 2D canvas behind the page, drawn round the card. Quiet: thin
// traces in a dim blue, lit only when something happens.
//  - Traces: three from each side of the chip, the outer two turning away at 45 degrees, to a pad:
//    on the left to Avortyx AI's portrait (so she and the chip read as one system), never into the
//    intro's words (where there's no room, the left side is left out), on the right towards the
//    edge. As the page opens they draw themselves out from the chip, one after another, once the
//    chip has lit (.chip-on), and their pads light as each arrives; then they're drawn once per
//    layout.
//  - Pulses, which carry the page's meaning: each call that comes in (backdrop-signal.ts "call", not
//    sent in the app yet) runs from her along a trace into the chip, then out of it along one on
//    the right, to a buyer; Sign in sends one down every trace at once. A pulse is a head in the ice
//    accent with a short tail.
// While a sign-in field has focus the traces glow a little brighter. Still for reduced motion (one
// frame, the traces drawn, no pulses), paused while the tab is hidden (no animation frames), hidden
// in High Contrast and below 1024px.

const BLUE = "59,130,246", ICE = "219,234,254";
const DRAW = { after: 1.5, each: 0.9, stagger: 0.12 }; // the traces drawing out: when, how long, one after another

type Trace = { pts: [number, number][]; len: number; side: -1 | 1; order: number };
type Pulse = { trace: Trace; at: number; dur: number; inward: boolean; then?: boolean };
type Layout = { box: [number, number, number, number]; traces: Trace[]; board: HTMLCanvasElement };

// a soft dot of light, drawn once, stamped for each pulse
function sprite(rgb: string, size: number, glow: number, dpr: number) {
  const s = Math.ceil((size + glow * 2) * dpr), c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  x.shadowColor = `rgba(${BLUE},1)`;
  x.shadowBlur = glow * dpr;
  x.fillStyle = `rgba(${rgb},1)`;
  x.beginPath();
  x.arc(s / 2, s / 2, (size * dpr) / 2, 0, Math.PI * 2);
  x.fill();
  return c;
}

function layout(card: DOMRect, her: Placement | null, words: number, W: number, dpr: number): Layout | null {
  const cy = card.top + card.height / 2, h = card.height;
  // where the left side ends: at her right edge, else a fixed reach, and clear of the intro's words
  // (`words`: their right edge); the right, short of the window's edge
  const leftEnd = Math.max(her?.tag ? her.x + her.r * 1.15 : card.left - 220, words + 32);
  const rightEnd = Math.min(W - 18, card.right + 260);
  const rBand = rightEnd - (card.right + 18), lBand = card.left - 18 - leftEnd;
  if (rBand < 40) return null;
  const sides = lBand >= 60 ? ([-1, 1] as const) : ([1] as const);

  // from the chip's side, out 26px, round at 45 degrees (dy), and on to the pad
  const traces: Trace[] = [];
  const trace = (side: -1 | 1, y0: number, dy: number, end: number) => {
    const x0 = side < 0 ? card.left - 4 : card.right + 4, x1 = x0 + side * 26;
    const pts: [number, number][] = dy ? [[x0, y0], [x1, y0], [x1 + side * Math.abs(dy), y0 + dy], [end, y0 + dy]] : [[x0, y0], [end, y0]];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    traces.push({ pts, len, side, order: traces.length });
  };
  for (const side of sides) {
    const end = side < 0 ? leftEnd : rightEnd - 6;
    trace(side, card.top + h * 0.1, -h * 0.07, end);
    trace(side, cy, 0, side < 0 ? end : card.right + rBand * 0.55);
    trace(side, card.bottom - h * 0.1, h * 0.07, end);
  }

  const pad = 24, ys = traces.flatMap((t) => t.pts.map((p) => p[1]));
  const box: Layout["box"] = [(sides.length > 1 ? leftEnd : card.left) - pad, Math.min(...ys) - pad, rightEnd + pad, Math.max(...ys) + pad];
  const board = document.createElement("canvas");
  board.width = Math.ceil((box[2] - box[0]) * dpr);
  board.height = Math.ceil((box[3] - box[1]) * dpr);
  const b = board.getContext("2d")!;
  b.scale(dpr, dpr);
  b.translate(-box[0], -box[1]);
  for (const t of traces) strokeTrace(b, t, 1, 1);
  return { box, traces, board };
}

// a trace drawn out to `k` of its length (its pad once it's all there), at `glow` of its brightness
function strokeTrace(c: CanvasRenderingContext2D, t: Trace, k: number, glow: number) {
  c.lineJoin = "round";
  c.lineCap = "round";
  for (const [width, alpha, blur] of [[3, 0.1, 10], [1, 0.5, 4]] as const) {
    c.lineWidth = width;
    c.strokeStyle = `rgba(${BLUE},${alpha * glow})`;
    c.shadowColor = `rgba(${BLUE},1)`;
    c.shadowBlur = blur;
    c.beginPath();
    let left = k * t.len;
    c.moveTo(...t.pts[0]);
    for (let i = 1; i < t.pts.length && left > 0; i++) {
      const [ax, ay] = t.pts[i - 1], [bx, by] = t.pts[i], l = Math.hypot(bx - ax, by - ay), f = Math.min(1, left / l);
      c.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
      left -= l;
    }
    c.stroke();
  }
  if (k < 1) return;
  const [x, y] = t.pts[t.pts.length - 1];
  c.shadowBlur = 8;
  c.fillStyle = `rgba(${BLUE},${0.8 * glow})`;
  c.beginPath();
  c.arc(x, y, 3, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;
  c.fillStyle = `rgba(${ICE},${0.7 * glow})`;
  c.beginPath();
  c.arc(x, y, 1.2, 0, Math.PI * 2);
  c.fill();
}

// a point at distance s along a trace
function along(t: Trace, s: number): [number, number] {
  for (let i = 1; i < t.pts.length; i++) {
    const [ax, ay] = t.pts[i - 1], [bx, by] = t.pts[i], l = Math.hypot(bx - ax, by - ay);
    if (s <= l) return [ax + ((bx - ax) * s) / l, ay + ((by - ay) * s) / l];
    s -= l;
  }
  return t.pts[t.pts.length - 1];
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export function CircuitField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const her = useAiPlacement();
  // when the page opened, for the traces drawing out (kept as the layout changes)
  const opened = useRef(0);

  useEffect(() => {
    const cv = canvas.current, card = document.querySelector("[data-card]"), intro = document.querySelector("[data-intro]");
    if (!cv || !card || !intro) return;
    const ctx = cv.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const born = (opened.current ||= performance.now() / 1000);
    let dpr = 1, lay: Layout | null = null, head: HTMLCanvasElement;
    let pulses: Pulse[] = [];
    const energy = { focus: 0, focused: false };

    const measure = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, c = card.getBoundingClientRect(), i = intro.getBoundingClientRect();
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      lay = W >= 1024 && i.width && i.left < c.left ? layout(c, her, textRight(c.top - 40, c.bottom + 40, i.left), W, dpr) : null;
      pulses = [];
      head = sprite(ICE, 3, 6, dpr);
      if (reduced) draw(born + 99);
    };

    // a pulse along one of a side's traces (at random), starting `delay` seconds from now
    const send = (side: -1 | 1, inward: boolean, now: number, delay = 0, then = false) => {
      const on = lay?.traces.filter((t) => t.side === side);
      if (!on?.length) return;
      const trace = on[Math.floor(Math.random() * on.length)];
      pulses.push({ trace, at: now + delay, dur: 0.5 + trace.len / 500, inward, then });
    };

    const draw = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!lay) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      energy.focus += ((energy.focused ? 1 : 0) - energy.focus) * 0.06;

      // the traces: drawing themselves out as the page opens, then from the board
      const since = t - born - DRAW.after, total = DRAW.each + DRAW.stagger * (lay.traces.length - 1);
      if (since < total) {
        for (const tr of lay.traces) {
          const k = ease(Math.min(1, Math.max(0, (since - tr.order * DRAW.stagger) / DRAW.each)));
          if (k > 0) strokeTrace(ctx, tr, k, 1);
        }
      } else {
        const [x0, y0, x1, y1] = lay.box;
        ctx.globalAlpha = 1 + energy.focus * 0.5;
        ctx.drawImage(lay.board, x0, y0, x1 - x0, y1 - y0);
        if (energy.focus > 0.01) {
          ctx.globalAlpha = energy.focus * 0.5;
          ctx.drawImage(lay.board, x0, y0, x1 - x0, y1 - y0);
        }
      }

      // the pulses: a head with a fading tail; one that came in from her goes on out to a buyer
      const hs = head.width / dpr / 2;
      pulses = pulses.filter((p) => {
        const k = (t - p.at) / p.dur;
        if (k < 0) return true;
        if (k >= 1) {
          if (p.then) send(1, false, t);
          return false;
        }
        for (let j = 0; j < 8; j++) {
          const run = ease(k) * p.trace.len + (p.inward ? j : -j) * 4;
          if (run < 0 || run > p.trace.len) continue;
          const [x, y] = along(p.trace, p.inward ? p.trace.len - run : run);
          ctx.globalAlpha = (1 - j / 8) * (j ? 0.45 : 1) * Math.min(1, (1 - k) * 4);
          ctx.drawImage(head, x - hs, y - hs, hs * 2, hs * 2);
        }
        return true;
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const onSignal = (e: Event) => {
      const s = (e as CustomEvent<BackdropSignal>).detail, now = performance.now() / 1000;
      if (s.kind === "focus") energy.focused = true;
      else if (s.kind === "blur") energy.focused = false;
      else if (reduced || !lay || now - born < DRAW.after + 1) return;
      // a call: in from her (or, with no room for her side, straight out to a buyer)
      else if (s.kind === "call") {
        if (pulses.length > 4) return;
        if (lay.traces.some((t) => t.side < 0)) send(-1, true, now, 0, true);
        else send(1, false, now);
      } else if (s.kind === "submit") for (const tr of lay.traces) pulses.push({ trace: tr, at: now + tr.order * 0.04, dur: 0.7, inward: tr.side < 0 });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    ro.observe(intro);
    window.addEventListener("resize", measure);
    window.addEventListener(BACKDROP_EVENT, onSignal);
    let id = 0;
    const loop = (ms: number) => {
      draw(ms / 1000);
      id = requestAnimationFrame(loop);
    };
    if (!reduced) id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener(BACKDROP_EVENT, onSignal);
    };
  }, [her]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full mix-blend-screen forced-colors:hidden"
    />
  );
}
