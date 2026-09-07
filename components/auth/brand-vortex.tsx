"use client";

/**
 * Brand-vortex background for the (auth) layout.
 *
 * The Avortyx logo is a three-arc spiral sweeping toward a bright core — this
 * extrudes that metaphor to ambient scale: concentric rings rotate around a
 * pinned-left centre, signal particles orbit each ring, and stray "inflow"
 * particles drift in from the edges and get pulled toward the core. The
 * visual reads as "Avortyx is the hub that everything (calls, news, crypto,
 * insights) funnels through."
 *
 * Palette — theme-aware. Every brand tone is read at runtime from the CSS
 * custom properties on <html>, so the vortex follows whichever `.theme-*`
 * accent the user picked instead of being baked to one hue:
 *   --vortyx-deep · --vortyx-teal (mid) · --vortyx-bright · --vortyx-ultra
 * plus --background for the base wash. If a variable is missing or
 * unparseable that slot degrades to the original emerald value (see the
 * FALLBACK_* table below) — never to NaN and never to a blank screen.
 *
 * Two themes:
 *   • dark   — deep tinted base with bright orbits
 *   • light  — barely-tinted off-white base with low-alpha accents
 *
 * Behavioural guarantees:
 *   • prefers-reduced-motion → static frame, no rotation, no inflow
 *   • document.visibilityState === "hidden" → RAF paused
 *   • MutationObserver on <html class> → re-reads the palette and re-paints
 *     when the light/dark mode OR the accent theme changes
 *   • getComputedStyle is never called from the RAF loop — the palette is
 *     resolved on mount and on theme change into an effect-scoped object
 *     that the paint passes read from
 *   • DPR capped at 2
 *   • No third-party deps
 */

import { useEffect, useRef } from "react";

type RGB = readonly [number, number, number];

/* ─── Fallback table (the ONLY hardcoded brand colours in this file) ───
 *
 * These are the original emerald constants. They are used verbatim for any
 * palette slot whose CSS custom property is missing, empty, or unparseable,
 * so a partial or broken theme degrades to the previous appearance rather
 * than rendering with NaN colours.
 */
const FALLBACK_DEEP: RGB = [12, 102, 71]; // #0C6647 — --vortyx-deep
const FALLBACK_MID: RGB = [18, 128, 92]; // #12805C — --vortyx-teal
const FALLBACK_BRIGHT: RGB = [61, 214, 140]; // #3DD68C — --vortyx-bright
const FALLBACK_ULTRA: RGB = [230, 247, 239]; // #E6F7EF — --vortyx-ultra
const FALLBACK_BASE_DARK: RGB = [10, 18, 16]; // #0A1210 — --background (dark)
const FALLBACK_BASE_LIGHT: RGB = [247, 250, 248]; // #F7FAF8 — --background (light)

const WHITE: RGB = [255, 255, 255];

/** Named slot in the resolved palette. Ring / arc / particle configs store a
 *  slot key rather than a tuple so they re-colour when the theme changes. */
type PaletteKey = "deep" | "mid" | "bright" | "ultra";

interface Palette extends Record<PaletteKey, RGB> {
  /** Resolved `--background`, the anchor for the base gradient. */
  base: RGB;
}

/* ─── Colour parsing ──────────────────────────────────────────────────
 *
 * Custom properties are unregistered, so getComputedStyle hands back the
 * authored token sequence with var()s substituted — which across the theme
 * sheet means hex (`#RRGGBB`), hsl (`hsl(155 14% 6%)`), rgba(), or a
 * `color-mix(in oklab, …)` expression (the `[class*="theme-"]` rules derive
 * the brand ramp from --accent that way). The first three are parsed here;
 * anything else is handed to the browser via a 1×1 offscreen canvas, which
 * is the only conversion-free way to resolve color-mix/oklab/oklch without
 * shipping a colour-space library. Every path returns null on failure.
 */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** `#RGB` / `#RRGGBB` (surrounding whitespace tolerated). */
function parseHexColor(value: string): RGB | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Split the inside of a colour function on commas, slashes and whitespace. */
function splitComponents(body: string): string[] {
  return body.split(/[\s,/]+/).filter(Boolean);
}

/** `24%` → 0.24; a bare number is read as a percentage too. */
function parsePercent(token: string): number | null {
  const n = Number(token.endsWith("%") ? token.slice(0, -1) : token);
  return Number.isFinite(n) ? n / 100 : null;
}

/** Angle token → degrees. Accepts deg / rad / grad / turn and bare numbers. */
function parseAngle(token: string): number | null {
  const match = /^([+-]?[\d.]+(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(token);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  switch ((match[2] || "deg").toLowerCase()) {
    case "rad":
      return (n * 180) / Math.PI;
    case "grad":
      return n * 0.9;
    case "turn":
      return n * 360;
    default:
      return n;
  }
}

/** `rgb()` / `rgba()`, legacy comma or modern space syntax. Alpha ignored. */
function parseRgbColor(value: string): RGB | null {
  const match = /^rgba?\(([^)]*)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = splitComponents(match[1]);
  if (parts.length < 3) return null;
  const out: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const token = parts[i];
    const n = token.endsWith("%")
      ? (Number(token.slice(0, -1)) * 255) / 100
      : Number(token);
    if (!Number.isFinite(n)) return null;
    out.push(clampByte(n));
  }
  return [out[0], out[1], out[2]];
}

/** `hsl()` / `hsla()`, legacy comma or modern space syntax. Alpha ignored. */
function parseHslColor(value: string): RGB | null {
  const match = /^hsla?\(([^)]*)\)$/i.exec(value.trim());
  if (!match) return null;
  const parts = splitComponents(match[1]);
  if (parts.length < 3) return null;
  const h = parseAngle(parts[0]);
  const s = parsePercent(parts[1]);
  const l = parsePercent(parts[2]);
  if (h === null || s === null || l === null) return null;
  const sat = Math.max(0, Math.min(1, s));
  const lum = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = lum - c / 2;
  return [
    clampByte((rgb[0] + m) * 255),
    clampByte((rgb[1] + m) * 255),
    clampByte((rgb[2] + m) * 255),
  ];
}

/** Lazily-created 1×1 probe canvas. `null` once creation is known to fail. */
let probeCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Last-resort resolver: let the browser parse the colour and read the sRGB
 * bytes back. Covers `color-mix()`, `oklab()`, `color()` and named colours.
 * Only ever called on mount / theme change, never per frame.
 */
function resolveViaProbeCanvas(value: string): RGB | null {
  try {
    if (probeCtx === undefined) {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      probeCtx = probe.getContext("2d", { willReadFrequently: true });
    }
    const ctx = probeCtx;
    if (!ctx) return null;
    // An unparseable fillStyle assignment is silently ignored, so sentinel
    // twice: only a value the browser rejected leaves both sentinels intact.
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    if (ctx.fillStyle === "#000000") {
      ctx.fillStyle = "#ffffff";
      ctx.fillStyle = value;
      if (ctx.fillStyle === "#ffffff") return null;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    if (data[3] === 0) return null;
    return [data[0], data[1], data[2]];
  } catch {
    return null;
  }
}

/** Resolve any CSS colour string to an [r,g,b] tuple, or null. */
function resolveCssColor(value: string): RGB | null {
  const raw = value.trim();
  if (!raw) return null;
  return (
    parseHexColor(raw) ??
    parseRgbColor(raw) ??
    parseHslColor(raw) ??
    resolveViaProbeCanvas(raw)
  );
}

/** Read one custom property off <html>, falling back on any failure. */
function readVarColor(name: string, fallback: RGB): RGB {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return resolveCssColor(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Snapshot the live theme into a plain object the paint passes can read. */
function readPalette(isDark: boolean): Palette {
  return {
    deep: readVarColor("--vortyx-deep", FALLBACK_DEEP),
    mid: readVarColor("--vortyx-teal", FALLBACK_MID),
    bright: readVarColor("--vortyx-bright", FALLBACK_BRIGHT),
    ultra: readVarColor("--vortyx-ultra", FALLBACK_ULTRA),
    base: readVarColor(
      "--background",
      isDark ? FALLBACK_BASE_DARK : FALLBACK_BASE_LIGHT,
    ),
  };
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    clampByte(a[0] + (b[0] - a[0]) * t),
    clampByte(a[1] + (b[1] - a[1]) * t),
    clampByte(a[2] + (b[2] - a[2]) * t),
  ];
}

function scaleRgb(c: RGB, f: number): RGB {
  return [clampByte(c[0] * f), clampByte(c[1] * f), clampByte(c[2] * f)];
}

function rgbStr(c: RGB) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * Three base-gradient stops derived from the theme's own `--background`.
 * The mid stop *is* the page background (light mode nudges it a hair toward
 * the deep tone, matching the original off-white wash on a pure-white
 * canvas); the centre lifts toward the brand and the edge falls away. With
 * the emerald theme active this reproduces the previous hardcoded stops to
 * within a couple of 8-bit steps.
 */
function computeBaseStops(palette: Palette, isDark: boolean): [string, string, string] {
  if (isDark) {
    const mid = palette.base;
    return [
      rgbStr(mixRgb(mid, palette.deep, 0.12)),
      rgbStr(mid),
      rgbStr(scaleRgb(mid, 0.35)),
    ];
  }
  const mid = mixRgb(palette.base, palette.deep, 0.03);
  return [
    rgbStr(mixRgb(mid, palette.bright, 0.05)),
    rgbStr(mid),
    rgbStr(mixRgb(mid, WHITE, 0.55)),
  ];
}

interface RingConfig {
  /** Radius as a fraction of the half-min-dimension. */
  rFrac: number;
  /** Palette slot this ring strokes with, resolved per paint. */
  color: PaletteKey;
  /** Stroke alpha for the dark theme. */
  alphaDark: number;
  /** Stroke alpha for the light theme. */
  alphaLight: number;
  /** Dash pattern length (px units before DPR). */
  dash: number;
  /** Number of orbital particles riding this ring. */
  particles: number;
  /** Angular velocity (rad/sec). */
  omega: number;
  /** Particle radius (px). */
  size: number;
}

/** Six concentric rings. Inner rings use the lighter tone and rotate
 *  faster; outer rings are deeper and slower — same rhythm as the logo. */
const RINGS: RingConfig[] = [
  { rFrac: 0.22, color: "bright", alphaDark: 0.55, alphaLight: 0.45, dash: 2.5, particles: 3, omega: 0.18, size: 2.0 },
  { rFrac: 0.34, color: "bright", alphaDark: 0.42, alphaLight: 0.36, dash: 2.5, particles: 4, omega: -0.13, size: 1.8 },
  { rFrac: 0.48, color: "mid", alphaDark: 0.32, alphaLight: 0.3, dash: 3, particles: 5, omega: 0.09, size: 1.6 },
  { rFrac: 0.64, color: "mid", alphaDark: 0.22, alphaLight: 0.22, dash: 3, particles: 6, omega: -0.06, size: 1.5 },
  { rFrac: 0.82, color: "deep", alphaDark: 0.17, alphaLight: 0.17, dash: 4, particles: 7, omega: 0.045, size: 1.3 },
  { rFrac: 1.0, color: "deep", alphaDark: 0.12, alphaLight: 0.13, dash: 4, particles: 8, omega: -0.03, size: 1.2 },
];

/** Three rotating spiral arcs that echo the logo at ambient scale. */
const SPIRAL_ARCS: Array<{
  rFrac: number;
  sweep: number;
  width: number;
  alphaDark: number;
  alphaLight: number;
  color: PaletteKey;
  omega: number;
}> = [
  { rFrac: 0.28, sweep: Math.PI * 1.5, width: 1.4, alphaDark: 0.55, alphaLight: 0.5, color: "bright", omega: 0.06 },
  { rFrac: 0.46, sweep: Math.PI * 1.4, width: 1.2, alphaDark: 0.4, alphaLight: 0.38, color: "mid", omega: -0.04 },
  { rFrac: 0.7, sweep: Math.PI * 1.3, width: 1.0, alphaDark: 0.25, alphaLight: 0.26, color: "mid", omega: 0.025 },
];

interface OrbitalParticle {
  ringIdx: number;
  /** Current angle on the ring (rad). */
  theta: number;
}

interface InflowParticle {
  x: number;
  y: number;
  angle: number;
  r: number;
  speed: number;
  /** Palette slot, so in-flight particles re-colour on a theme change. */
  color: PaletteKey;
  trail: Array<{ x: number; y: number }>;
}

function rgba(c: RGB, a: number) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface BrandVortexProps {
  /** Horizontal centre of the vortex as a fraction of viewport width (0..1).
   *  Default 0.5 (centred). Set to 0.35 to bias toward the left so the form
   *  on the right has clean breathing room above the vortex's edge. */
  centerX?: number;
}

export function BrandVortex({ centerX = 0.5 }: BrandVortexProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReduced = reducedMotion.matches;
    let isDark = false;
    /** Live palette + precomputed base stops. Seeded with the fallback table
     *  and then written only by refreshTheme() (mount + theme change); the
     *  RAF loop reads this snapshot and never resolves CSS itself. */
    let palette: Palette = {
      deep: FALLBACK_DEEP,
      mid: FALLBACK_MID,
      bright: FALLBACK_BRIGHT,
      ultra: FALLBACK_ULTRA,
      base: FALLBACK_BASE_LIGHT,
    };
    let baseStops: [string, string, string] = computeBaseStops(palette, false);

    /** Re-read mode + palette from <html>. Cheap enough to run on every
     *  class mutation, and never called from inside the RAF loop. */
    const refreshTheme = () => {
      isDark = document.documentElement.classList.contains("dark");
      palette = readPalette(isDark);
      baseStops = computeBaseStops(palette, isDark);
    };
    refreshTheme();

    /** On wide screens the form is on the right, so pin the vortex left.
     *  On narrow screens the form is centred, so centre the vortex too. */
    const wideScreen = () => window.innerWidth >= 1024;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let cx = width * centerX;
    let cy = height / 2;
    let radiusUnit = Math.min(width, height) / 2;

    const orbitals: OrbitalParticle[] = [];
    let inflows: InflowParticle[] = [];

    /** Global rotation drift — one full turn every ~2 minutes. */
    let globalAngle = 0;

    const seedOrbitals = () => {
      orbitals.length = 0;
      RINGS.forEach((ring, ringIdx) => {
        for (let i = 0; i < ring.particles; i += 1) {
          orbitals.push({
            ringIdx,
            theta: (i / ring.particles) * Math.PI * 2 + Math.random() * 0.4,
          });
        }
      });
    };

    const seedInflow = (): InflowParticle => {
      const angle = Math.random() * Math.PI * 2;
      const r = radiusUnit * 1.15;
      const slots: PaletteKey[] = ["bright", "bright", "mid", "mid", "deep"];
      const color = slots[Math.floor(Math.random() * slots.length)];
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle,
        r,
        speed: rand(80, 140),
        color,
        trail: [],
      };
    };

    const sizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width * (wideScreen() ? centerX : 0.5);
      cy = height / 2;
      // Widen the radius unit on wide screens so the outer rings reach into
      // the right column and visually unite the two zones. On narrow / square
      // viewports fall back to half-min for the original tight composition.
      radiusUnit = wideScreen()
        ? Math.max(Math.min(width, height) / 2, width * 0.42)
        : Math.min(width, height) / 2;
      seedOrbitals();
      inflows = [];
    };

    sizeCanvas();

    let last = performance.now();
    let nextInflowAt = last + 800;
    let rafId = 0;
    let running = true;

    /* ─── Painting passes (theme-aware via `isDark` + `palette`) ─────
     *
     * Every pass reads colours out of the `palette` / `baseStops` snapshot
     * above. No getComputedStyle / CSS variable lookup happens below this
     * line — the snapshot is refreshed by refreshTheme() only.
     */

    const paintBase = () => {
      // Derived from the theme's --background: centre lifts toward the deep
      // brand tone, mid stop is the page background, edge falls away.
      const grad = ctx.createRadialGradient(
        cx,
        cy,
        radiusUnit * 0.05,
        cx,
        cy,
        radiusUnit * 1.5,
      );
      if (isDark) {
        grad.addColorStop(0, baseStops[0]);
        grad.addColorStop(0.5, baseStops[1]);
        grad.addColorStop(1, baseStops[2]);
      } else {
        // Soft daylight — faint brand tint at centre, near-white edges.
        grad.addColorStop(0, baseStops[0]);
        grad.addColorStop(0.55, baseStops[1]);
        grad.addColorStop(1, baseStops[2]);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    };

    const paintCore = () => {
      // "Calm eye" glow — gentle 0.04 Hz breath.
      const breath = 0.85 + Math.sin(globalAngle * 4) * 0.15;
      const grad = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        radiusUnit * 0.42 * breath,
      );
      if (isDark) {
        grad.addColorStop(0, rgba(palette.ultra, 0.18 * breath));
        grad.addColorStop(0.5, rgba(palette.bright, 0.08));
        grad.addColorStop(1, rgba(palette.bright, 0));
      } else {
        grad.addColorStop(0, rgba(palette.bright, 0.18 * breath));
        grad.addColorStop(0.5, rgba(palette.mid, 0.07));
        grad.addColorStop(1, rgba(palette.mid, 0));
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusUnit * 0.55, 0, Math.PI * 2);
      ctx.fill();
    };

    const paintRings = () => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(globalAngle * 0.4);
      for (const ring of RINGS) {
        const r = ring.rFrac * radiusUnit;
        const alpha = isDark ? ring.alphaDark : ring.alphaLight;
        ctx.strokeStyle = rgba(palette[ring.color], alpha);
        ctx.lineWidth = 1;
        ctx.setLineDash([ring.dash, ring.dash * 2.5]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    };

    const paintSpirals = () => {
      for (const arc of SPIRAL_ARCS) {
        const r = arc.rFrac * radiusUnit;
        const start = globalAngle * arc.omega * 14;
        const alpha = isDark ? arc.alphaDark : arc.alphaLight;
        ctx.strokeStyle = rgba(palette[arc.color], alpha);
        ctx.lineWidth = arc.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + arc.sweep);
        ctx.stroke();
        // Leading-edge spark — echoes the logo's core highlight.
        const tipX = cx + Math.cos(start + arc.sweep) * r;
        const tipY = cy + Math.sin(start + arc.sweep) * r;
        const sparkGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14);
        const sparkColor = isDark ? palette.ultra : palette.bright;
        // 0.9 → 0.75: the bright brand tone is far more chromatic than the
        // indigo it replaced, so a full-strength tip spark read as a harsh
        // dot on the near-white light base.
        sparkGrad.addColorStop(0, rgba(sparkColor, 0.75));
        sparkGrad.addColorStop(1, rgba(sparkColor, 0));
        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const paintOrbitals = (dt: number) => {
      for (const p of orbitals) {
        const ring = RINGS[p.ringIdx];
        const color = palette[ring.color];
        if (!isReduced) p.theta += ring.omega * dt;
        const r = ring.rFrac * radiusUnit;
        const x = cx + Math.cos(p.theta) * r;
        const y = cy + Math.sin(p.theta) * r;
        ctx.fillStyle = rgba(color, isDark ? 0.85 : 0.7);
        ctx.beginPath();
        ctx.arc(x, y, ring.size, 0, Math.PI * 2);
        ctx.fill();
        const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, ring.size * 4);
        haloGrad.addColorStop(0, rgba(color, isDark ? 0.4 : 0.25));
        haloGrad.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(x, y, ring.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const paintInflow = (dt: number) => {
      if (!isReduced && performance.now() >= nextInflowAt && inflows.length < 6) {
        inflows.push(seedInflow());
        nextInflowAt = performance.now() + rand(3200, 5500);
      }
      for (let i = inflows.length - 1; i >= 0; i -= 1) {
        const p = inflows[i];
        if (!isReduced) {
          p.r -= p.speed * dt;
          p.angle += 0.6 * dt * (radiusUnit / Math.max(40, p.r));
          p.x = cx + Math.cos(p.angle) * p.r;
          p.y = cy + Math.sin(p.angle) * p.r;
          p.trail.unshift({ x: p.x, y: p.y });
          if (p.trail.length > 12) p.trail.length = 12;
        } else if (p.trail.length === 0) {
          p.trail.unshift({ x: p.x, y: p.y });
        }
        const trailColor = palette[p.color];
        for (let k = p.trail.length - 1; k >= 0; k -= 1) {
          const t = p.trail[k];
          const alpha = (1 - k / p.trail.length) * (isDark ? 0.6 : 0.45);
          ctx.fillStyle = rgba(trailColor, alpha);
          ctx.beginPath();
          ctx.arc(t.x, t.y, k === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.r < radiusUnit * 0.06) {
          // Reached the core — soft ripple flash on arrival.
          const flashColor = isDark ? palette.ultra : palette.bright;
          const coreFlash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
          coreFlash.addColorStop(0, rgba(flashColor, isDark ? 0.4 : 0.28));
          coreFlash.addColorStop(1, rgba(flashColor, 0));
          ctx.fillStyle = coreFlash;
          ctx.beginPath();
          ctx.arc(cx, cy, 70, 0, Math.PI * 2);
          ctx.fill();
          inflows.splice(i, 1);
        }
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(40, now - last) / 1000;
      last = now;
      if (!isReduced) globalAngle += 0.05 * dt;

      paintBase();
      paintCore();
      paintRings();
      paintOrbitals(dt);
      paintSpirals();
      paintInflow(dt);

      if (running) rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    /* ─── Lifecycle hooks ─────────────────────────────────────────── */

    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!running) {
          running = true;
          last = performance.now();
          nextInflowAt = last + 800;
          rafId = requestAnimationFrame(frame);
        }
      } else {
        running = false;
        cancelAnimationFrame(rafId);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onReducedMotionChange = (e: MediaQueryListEvent) => {
      isReduced = e.matches;
    };
    reducedMotion.addEventListener("change", onReducedMotionChange);

    /** Both the light/dark toggle (`dark`) and the accent picker
     *  (`theme-*`) mutate <html>'s class list, and the picker also writes
     *  `data-color-theme` — observe both so the vortex re-reads the palette
     *  and repaints on the next frame without a remount. */
    const themeObserver = new MutationObserver(() => {
      refreshTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-color-theme"],
    });

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      themeObserver.disconnect();
    };
  }, [centerX]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      role="presentation"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
