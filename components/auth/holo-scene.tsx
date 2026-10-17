"use client";

import { useEffect, useRef, useState } from "react";

// The backdrop: a ring of light, and round it the whole page astir: a drifting haze, faint rays,
// stars circling the ring, comets spiralling in to it and a wave of light leaving it now and then.
// The ring: 144 fine spikes round a dark disc, each burning brightest near its
// tip, the whole ring turning very slowly; eight star flares on it that flare up one after another,
// and twelve small comets inside it drifting the other way (after the "Ringba Platform" ring on
// ringba.com, rebuilt from scratch in the Avortyx blues). It sits in the open space between the intro
// and the sign-in card ([data-scene-anchor]); on phones it rests dimmed behind the card.
//
// It is one WebGL shader that fills the window. The ring is sized from the window and every size in
// it is a share of the ring, so it looks the same at any browser zoom, from 25% to 500%: zoomed all
// the way out the whole ring still fits the screen, only sharper. It is drawn at the screen's pixel
// density (up to 2x). Falls back to a still CSS ring without WebGL, holds still for reduced motion,
// pauses while the tab is hidden, and draws fewer pixels on slow devices.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uC;      // the ring's centre, in canvas pixels (y up)
uniform float uR;     // its outer radius, in canvas pixels
uniform float uU;     // the width of a fine line, in canvas pixels
uniform float uTime;
uniform float uAmp;   // the ring's strength: lower on phones, where it sits behind the card
uniform float uH;     // the window's height, in canvas pixels: the page's layers are sized from it
uniform vec2 uM;      // where the pointer is (-1 to 1 each way, eased), for a little parallax
uniform vec4 uQuiet;  // the intro's words (canvas pixels, x0 y0 x1 y1): the page keeps still behind them
uniform float uWave;  // how far the wave travels before it fades out, in ring radii

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float SPIKES = 144.0;
const float TURN = TAU / 450.0;   // the ring turns once in 7.5 minutes, anticlockwise
const float DRIFT = TAU / 1000.0; // the comets once in 16.7 minutes, clockwise

// the palette: the Avortyx blues on a deep navy
const vec3 NAVY = vec3(0.024, 0.039, 0.106);   // #060a1b, the page
const vec3 DISC = vec3(0.035, 0.055, 0.180);   // #090e2e, inside the ring
const vec3 COBALT = vec3(0.090, 0.224, 0.659); // #1739a8
const vec3 ROYAL = vec3(0.114, 0.306, 0.847);  // #1d4ed8
const vec3 BLUE = vec3(0.231, 0.510, 0.965);   // #3b82f6
const vec3 SKY = vec3(0.576, 0.773, 0.992);    // #93c5fd
const vec3 ICE = vec3(0.859, 0.918, 0.996);    // #dbeafe

float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * n3(p); p = p * 2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return v;
}
vec2 spin(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// distance from p to the segment a-b, and how far along it (0 at a, 1 at b)
vec2 seg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return vec2(length(p - a - ab * h), h);
}

// ── the page round the ring: a drifting haze, faint rays fanning out from the ring, stars slowly
// circling it, comets spiralling in to it (calls on their way to be routed) and, every 7 seconds, a
// wave of light leaving it. w = window heights from the ring's centre, a = the angle there.
vec3 page(vec2 w, float a, float t) {
  float Rw = uR / uH;  // the ring's radius, in window heights
  float wr = length(w);
  float px = 1.0 / uH;  // a canvas pixel, in window heights
  vec3 c = vec3(0.0);

  // the haze: two slow layers of cloud in the deeper blues, and a broad glow round the ring
  float neb = fbm(vec3(w * 1.6 + uM * 0.012, t * 0.012));
  float neb2 = fbm(vec3(w * 3.4 + vec2(5.2, 1.3), t * 0.018));
  c += mix(COBALT, ROYAL, neb2) * smoothstep(0.38, 0.82, neb) * 0.085;
  c += ROYAL * exp(-pow(wr / (Rw * 2.4), 2.0)) * 0.035;

  // the rays: brighter and dimmer sectors turning slowly, fading out towards the page's edges
  vec2 dir = vec2(cos(a), sin(a));
  float ray = n3(vec3(dir * 3.0, t * 0.035)) * n3(vec3(dir * 7.5 + 4.0, t * 0.05));
  c += mix(ROYAL, BLUE, 0.4) * pow(ray, 1.6) * smoothstep(Rw * 0.95, Rw * 1.25, wr) * exp(-(wr - Rw) * 1.5) * 0.16;

  // the stars: three depths, the nearer ones larger, faster round and further moved by the pointer
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float cell = mix(0.024, 0.055, fl * 0.5);
    vec2 s = spin(w, t * TAU / mix(1100.0, 600.0, fl * 0.5)) + uM * (0.004 + 0.009 * fl);
    vec2 id = floor(s / cell);
    float k = h2(id + fl * 17.0);
    if (k > 0.7) {
      vec2 off = (vec2(h2(id + 3.1), h2(id + 7.7)) - 0.5) * 0.7;
      float d = length(fract(s / cell) - 0.5 - off) * cell / px;
      float size = (0.55 + 0.35 * fl + 0.5 * (k - 0.7) / 0.3) * uU;
      float tw = 0.55 + 0.45 * sin(t * (0.5 + 2.0 * k) + k * 40.0);
      c += mix(SKY, ICE, k) * exp(-d * d / (size * size)) * tw * (0.3 + 0.25 * fl);
    }
  }

  // the comets: sixteen of them, each spiralling in from well outside the ring over 9 to 16
  // seconds, brightening as they come and fading as they reach it
  if (wr > Rw * 0.98) {
    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      float k = h2(vec2(fi, 9.0));
      float ph = fract(t / (9.0 + 7.0 * k) + k * 3.7);
      float th0 = fi * TAU / 16.0 + k * 2.0;
      float r1 = mix(Rw * 2.7, Rw * 1.02, pow(ph, 1.5));
      float r0 = mix(Rw * 2.7, Rw * 1.02, pow(max(ph - 0.05, 0.0), 1.5));
      vec2 head = r1 * vec2(cos(th0 + ph * 1.3), sin(th0 + ph * 1.3));
      vec2 tail = r0 * vec2(cos(th0 + (ph - 0.05) * 1.3), sin(th0 + (ph - 0.05) * 1.3));
      vec2 d = seg(w, tail, head);
      float dp = d.x / px;
      if (dp > 40.0 * uU) continue;
      float fade = smoothstep(0.0, 0.2, ph) * (1.0 - smoothstep(0.82, 1.0, ph));
      float wpx = 1.1 * uU;
      c += mix(ROYAL, SKY, d.y) * (exp(-dp * dp / (wpx * wpx)) * 0.8 + exp(-dp / (5.0 * uU)) * 0.12) * d.y * d.y * fade;
      c += ICE * exp(-pow(length(w - head) / px / (1.4 * uU), 2.0)) * fade * 0.8;
    }
  }

  // the wave: a soft ring of light that leaves the ring every 7 seconds and fades as it spreads,
  // gone by uWave radii (zoomed far out: exactly where the intro and the card begin)
  float wp = fract(t / 7.0);
  float dw = abs(wr - mix(Rw * 1.0, Rw * uWave, wp)) / px;
  float life = pow(1.0 - wp, 1.4) * smoothstep(0.0, 0.04, wp) * step(Rw, wr);
  c += mix(BLUE, SKY, 0.3) * (exp(-dw * dw / (4.0 * uU * uU)) * 0.22 + exp(-dw / (40.0 * uU)) * 0.06) * life;

  return c;
}

// a soft line across: d = distance in ring radii, w = half width in ring radii, never under ~a pixel
float soft(float d, float w) {
  float wp = max(w * uR, 0.7 * uU);
  return exp(-(d * uR / wp) * (d * uR / wp)) * min(1.0, w * uR / wp + 0.35);
}

// one star flare: q = offset from its centre (ring radii), k = how bright it is now
vec3 flare(vec2 q, float k, float seed) {
  float d = length(q);
  if (d > 0.2) return vec3(0.0);
  float a = atan(q.y, q.x);
  float x = d / 0.17;
  float rays = pow(abs(cos(a * 4.0 + seed)), 70.0) * exp(-x * 3.2)
             + pow(abs(cos(a * 6.0 + seed * 2.3)), 90.0) * exp(-x * 4.5) * 0.7
             + pow(abs(cos(a * 5.0 + seed * 4.1)), 110.0) * exp(-x * 6.5) * 0.5;
  float halo = exp(-x * x * 26.0) * 0.45 + exp(-x * 5.0) * 0.1;
  float core = soft(d, 0.006);
  vec3 c = mix(BLUE, SKY, 0.55) * (rays + halo) + ICE * core * 1.4;
  return c * k * (1.0 - smoothstep(0.85, 1.15, x));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - uC) / uR;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = uTime;
  // behind the intro's words the page's stars and comets fade back, so the words read cleanly
  vec2 qd = max(max(uQuiet.xy - fc, fc - uQuiet.zw), 0.0);
  float quiet = 1.0 - 0.72 * exp(-dot(qd, qd) / pow(0.05 * uH, 2.0));
  vec3 col = NAVY + page((fc - uC) / uH, a, t) * quiet;

  // a faint field of light round the ring, and the dark disc inside it
  col += COBALT * exp(-pow((r - 0.82) / 0.2, 2.0)) * 0.12;
  col = mix(col, DISC, 1.0 - smoothstep(0.6, 0.66, r));

  // ── the spikes: wide and dim at the root, narrowing to a hot point at 0.845, then a fine tail
  if (r > 0.55 && r < 1.06) {
    float ar = a - t * TURN;
    float per = TAU / SPIKES;
    float k = floor(ar / per + 0.5);
    float s = (ar - k * per) * r;  // across the spike, in ring radii
    float v = h2(vec2(k, 3.0));
    float tip = 0.845 + (v - 0.5) * 0.012;
    float rise = pow(smoothstep(0.6, tip, r), 2.2) * (1.0 - smoothstep(tip, tip + 0.03, r));
    float w = mix(0.0115, 0.0016, smoothstep(0.64, tip, r));
    float body = soft(s, w) * rise * (0.8 + 0.25 * v);
    float hot = exp(-pow((r - tip) / 0.011, 2.0)) * soft(s, 0.0022);
    float tail = exp(-max(r - tip, 0.0) / 0.055) * (1.0 - smoothstep(0.95, 1.02, r)) * step(tip, r) * soft(s, 0.0018);
    vec3 bodyCol = mix(COBALT * 0.8, mix(BLUE, SKY, 0.35), smoothstep(0.72, tip, r));
    col += bodyCol * body * 1.25;
    col += ICE * hot * 1.3;
    col += BLUE * tail * 0.55;
    col += ROYAL * exp(-pow((r - 0.8) / 0.07, 2.0)) * 0.07;  // the glow between the spikes
  }

  // ── eight flares on the ring, turning with it; each flares up in its turn, every 4 seconds
  if (r > 0.6 && r < 1.08) {
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      // the order they light in: NE, SE, SW, NW, E, S, W, N
      float deg = fi < 4.0 ? 45.0 - 90.0 * fi : -90.0 * (fi - 4.0);
      float th = radians(deg) + t * TURN;
      vec2 c = 0.85 * vec2(cos(th), sin(th));
      vec2 q = p - c;
      if (dot(q, q) > 0.04) continue;
      float ph = fract((t - 0.5 * (fi + 1.0)) / 4.0);
      float op = ph < 0.6 ? mix(1.0, 0.5, ph / 0.6) : mix(0.5, 1.0, (ph - 0.6) / 0.4);
      float boost = ph < 0.3 ? ph / 0.3 : 1.0 - (ph - 0.3) / 0.7;
      col += flare(q, op * (0.75 + 0.45 * boost), fi * 1.7);
    }
  }

  // ── twelve comets just inside the disc's edge, drifting clockwise, heads first
  if (r > 0.45 && r < 0.7) {
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float rr = 0.575 + 0.025 * sin(fi * 2.1);
      float th = radians(78.7 - 30.2 * fi) - t * DRIFT;
      vec2 c = rr * vec2(cos(th), sin(th));
      vec2 q = p - c;
      if (dot(q, q) > 0.0025) continue;
      vec2 dir = vec2(sin(th), -cos(th));  // the way it travels
      float x = dot(q, dir), y = dot(q, vec2(-dir.y, dir.x));
      float len = x < 0.0 ? 0.026 : 0.009;
      float glow = exp(-pow(x / len, 2.0) - pow(y / 0.0075, 2.0));
      float head = soft(length(vec2(x - 0.002, y)), 0.0035);
      col += mix(ROYAL, BLUE, 0.6) * glow * 0.8 + ICE * head * 0.9;
    }
  }

  col = mix(NAVY, col, uAmp);
  col += (h2(fc + fract(t)) - 0.5) / 255.0;  // dither, so the glow never bands
  gl_FragColor = vec4(col, 1.0);
}`;

type Layout = { cx: number; cy: number; r: number; wide: boolean; quiet?: number[]; wave?: number };

// how far right the intro's words actually reach (its box is wider than the text in it)
function textRight(el: Element) {
  let right = 0;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width) right = Math.max(right, r.right);
  }
  return right;
}

// where the ring goes, in CSS pixels; r = its outer radius
function place(): Layout {
  const w = window.innerWidth, h = window.innerHeight;
  const anchor = document.querySelector("[data-scene-anchor]")?.getBoundingClientRect();
  const intro = document.querySelector("[data-intro]");
  const card = document.querySelector("[data-scene-card]")?.getBoundingClientRect();
  if (anchor && anchor.width > 120 && intro && card) {
    // centred between the end of the intro's words and the card, level with the card's middle,
    // clear of both; never more than 40% of the window's height, so it always fits the screen
    // (zoomed all the way out, height is what limits it)
    const gap = 28;
    const left = textRight(intro) + gap, right = card.left - gap;
    // the row's middle, which is the card's; read from the row, which never moves (the card rises in)
    const cy = anchor.top + anchor.height / 2;
    const half = (right - left) / 2;
    const r = Math.max(60, Math.min(half, h * 0.4, (Math.min(cy, h - cy) - h * 0.04) / 1.02));
    const box = intro.getBoundingClientRect();
    const quiet = [box.left, box.top, left - gap, box.bottom];
    // the outer circle (the wave of light the ring sends out) spreads to 3.4 radii, under the content.
    // Zoomed far out the column is wide (app/(login)/login/page.tsx) and the gap far outgrows the ring: the
    // wave then fades at the gap's edges, so the intro and the card stand outside the outer circle
    const wave = half > r * 1.2 ? half / r : 3.4;
    return { cx: (left + right) / 2, cy, r, wide: true, quiet, wave };
  }
  // phones and narrow windows: behind the card, whose frosted glass softens it to a glow
  return { cx: w / 2, cy: h / 2, r: Math.min(w * 0.62, h * 0.42), wide: false };
}

export function HoloScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState<Layout | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = () => {
      setFallback(place());
      const onResize = () => setFallback(place());
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    };
    if (!canvas || !gl) return still();

    function shader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return still();
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = U("uTime"), uC = U("uC"), uR = U("uR"), uU = U("uU"), uAmp = U("uAmp"), uH = U("uH"), uM = U("uM"), uQuiet = U("uQuiet"), uWave = U("uWave");

    let quality = 1;
    function layout() {
      const w = window.innerWidth, h = window.innerHeight;
      // the screen's own pixel density (below 1 when zoomed out), at most 2x
      const scale = Math.min(window.devicePixelRatio || 1, 2) * quality;
      canvas!.width = Math.max(1, Math.round(w * scale));
      canvas!.height = Math.max(1, Math.round(h * scale));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      const l = place();
      const k = canvas!.width / w;
      gl!.uniform2f(uC, l.cx * k, canvas!.height - l.cy * k);
      gl!.uniform1f(uR, l.r * k);
      // a fine line is a pixel wide on a 1000px-tall picture, wider on taller ones
      gl!.uniform1f(uU, Math.max(1, canvas!.height / 1000));
      gl!.uniform1f(uAmp, l.wide ? 1 : 0.6);
      gl!.uniform1f(uH, canvas!.height);
      // the quiet box, flipped to canvas pixels with y up (none on phones: the card covers that)
      gl!.uniform1f(uWave, l.wave ?? 3.4);
      const q = l.quiet ?? [0, 0, 0, 0];
      gl!.uniform4f(uQuiet, q[0] * k, canvas!.height - q[3] * k, q[2] * k, canvas!.height - q[1] * k);
      // resizing the canvas clears it: a still ring (reduced motion) has to be drawn again
      if (reduced) frame(performance.now());
    }
    layout();
    window.addEventListener("resize", layout);
    // the words and the card settle after fonts and the live price arrive: place the ring again
    const watch = new ResizeObserver(() => layout());
    document.querySelectorAll("[data-intro], [data-scene-card], [data-scene-anchor]").forEach((el) => watch.observe(el));
    document.fonts?.ready.then(() => layout());

    let raf = 0, last = 0, slow = 0, frames = 0;
    const t0 = performance.now();
    // the pointer, eased, for the stars' parallax (a mouse only; touch screens keep still)
    const aim = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      aim.x = (e.clientX / window.innerWidth) * 2 - 1;
      aim.y = 1 - (e.clientY / window.innerHeight) * 2;
    };
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    function frame(now: number) {
      eased.x += (aim.x - eased.x) * 0.04;
      eased.y += (aim.y - eased.y) * 0.04;
      gl!.uniform2f(uM, eased.x, eased.y);
      gl!.uniform1f(uTime, reduced ? 3.5 : (now - t0) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (reduced) return;
      // only if most frames take longer than ~34ms (under 30 fps): draw fewer pixels
      if (last && ++frames > 60) {
        slow += now - last > 34 ? 1 : 0;
        if (frames > 120) {
          if (slow > 45 && quality > 0.5) {
            quality *= 0.8;
            layout();
          }
          frames = 60;
          slow = 0;
        }
      }
      last = now;
      raf = requestAnimationFrame(frame);
    }
    function start() {
      cancelAnimationFrame(raf);
      last = 0;
      if (reduced) frame(performance.now());
      else if (!document.hidden) raf = requestAnimationFrame(frame);
    }
    start();
    requestAnimationFrame(() => requestAnimationFrame(() => (canvas.style.opacity = "1")));
    document.addEventListener("visibilitychange", start);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
      watch.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  if (fallback) {
    const { cx, cy, r } = fallback;
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[#060a1b]"
        style={{
          backgroundImage: `radial-gradient(circle at ${cx}px ${cy}px, #090e2e ${r * 0.6}px, rgba(29,78,216,0.35) ${r * 0.8}px, rgba(147,197,253,0.45) ${r * 0.845}px, rgba(29,78,216,0.12) ${r * 0.9}px, transparent ${r}px)`,
        }}
      />
    );
  }
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      role="presentation"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-[#060a1b] opacity-0 transition-opacity duration-700"
    />
  );
}
