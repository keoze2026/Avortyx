import { useEffect, useState } from "react";
import * as THREE from "three";

// The AI's portrait as points, sampled once in JS (ai-portrait.tsx animates them on the GPU) from
// public/ai-portrait.png, which the design prototype (Avortyx-Login: scripts/portrait/make-portrait.py) makes from her picture: per pixel
// her brightness (R), depth (G, 0 outside her), the centres of the flecks on her face (B 255), which
// glow, and of her eyes (B 128). A point on every pixel of her face, and on about half of those
// round it (the wires and machinery frame her, they don't compete), with more again in her face
// and most in her eyes, where people look (every second pixel each way on lighter devices); each a
// little off the grid so no pattern shows, as bright as the pixel, so she is drawn in detail; the
// darkest pixels are skipped. Each sits at the picture's depth, so she is in relief, not flat. Her neck fades
// out where the picture cuts it off. The flecks become larger, glowing nodes, each joined to its nearest
// two by lines (a constellation over her face). Every point has a seed (aRandom: when it leaves and
// where it goes) and a size; the lines' ends carry their nodes'.
// 2.8 units tall, centred; she faces the viewer (+z).

export type PortraitData = { w: number; h: number; px: Uint8ClampedArray };

const URL = "/ai-portrait.png";
const HEIGHT = 2.8, DEPTH = 1.3;
// her face is the nearest of her (the generator finds it the same way); the size of her eyes, in her units
const FACE = 0.7, EYE = { w: 0.15, h: 0.07 };

let pending: Promise<PortraitData> | null = null;

// fetched and decoded once (started as the scene's code loads, ai-scene.tsx), its pixels read
// exactly as stored (no colour management, no premultiplying)
export function loadPortrait() {
  pending ??= fetch(URL)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${URL}: ${r.status}`))))
    .then((blob) => createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" }))
    .then((bmp) => {
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      return { w: c.width, h: c.height, px: ctx.getImageData(0, 0, c.width, c.height).data };
    });
  return pending;
}

// the portrait's pixels once they're in; false if they couldn't be had (the scene goes on without her)
export function usePortrait() {
  const [data, setData] = useState<PortraitData | false | null>(null);
  useEffect(() => {
    let live = true;
    loadPortrait().then(
      (d) => live && setData(d),
      () => live && setData(false),
    );
    return () => void (live = false);
  }, []);
  return data;
}

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// eyes: her right and left eye's centres (x, y), in her space; far off when the picture marks none
type PortraitGeometry = { points: THREE.BufferGeometry; lines: THREE.BufferGeometry; eyes: THREE.Vector4 };

// one unit of her space per `step` pixels of the picture (so the points' spacing, for their size)
export const portraitSpacing = (h: number, step: number) => (HEIGHT / h) * step;

export function buildPortrait({ w, h, px }: PortraitData, step: number): PortraitGeometry {
  seed = 11;
  const unit = HEIGHT / h;
  const at = (x: number, y: number, z: number): [number, number, number] => [(x - w / 2) * unit, (h / 2 - y) * unit, z];
  const depthOf = (i: number) => ((px[i * 4 + 1] - 1) / 254 - 0.55) * DEPTH;

  const nodes: number[] = [], eyes: [number, number][] = [];
  for (let i = 0; i < w * h; i++) {
    const b = px[i * 4 + 2];
    if (b > 200 && px[i * 4 + 1]) nodes.push(i);
    else if (b > 100 && b < 160) {
      const [ex, ey] = at((i % w) + 0.5, Math.floor(i / w) + 0.5, 0);
      eyes.push([ex, ey]);
    }
  }
  eyes.sort((p, q) => p[0] - q[0]);
  const inEye = (x: number, y: number) =>
    eyes.reduce((k, [ex, ey]) => Math.max(k, Math.exp(-(((x - ex) / EYE.w) ** 2) - ((y - ey) / EYE.h) ** 2)), 0);

  const pos: number[] = [], rand: number[] = [], size: number[] = [], bright: number[] = [];
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const i = y * w + x;
      if (!px[i * 4 + 1]) continue;
      // fewer down her neck, to none at the picture's edge
      const fade = Math.min(1, (h - 1 - y) / (h * 0.16)), b = (px[i * 4] / 255) * fade * fade;
      if (b < 0.03 && rnd() > b * 20) continue;
      const [hx, hy] = at(x, y, 0), eye = inEye(hx, hy);
      // her face: one point here and, as often as not, a second; her eyes: up to two more, and
      // brighter; round her: one here every other time
      const face = (px[i * 4 + 1] - 1) / 254 > FACE;
      const n = face ? 1 + (rnd() < 0.6 ? 1 : 0) + Math.round(eye * 2) : rnd() < 0.5 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        pos.push(...at(x + rnd() * step, y + rnd() * step, depthOf(i) + (rnd() - 0.5) * 0.015));
        rand.push(rnd());
        size.push((0.8 + rnd() * 0.4) * (face ? 0.85 : 1));
        bright.push(Math.min(1, b * (face ? 0.8 : 1) * (1 + eye * 0.6)));
      }
    }
  const count = rand.length, total = count + nodes.length;
  // the nodes, just in front of her skin
  for (const i of nodes) {
    const x = i % w, y = (i - x) / w;
    pos.push(...at(x + 0.5, y + 0.5, depthOf(i) + 0.04));
    rand.push(rnd());
    size.push(2.6 + rnd() * 1.2);
    bright.push(1);
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  points.setAttribute("aRandom", new THREE.BufferAttribute(new Float32Array(rand), 1));
  points.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
  points.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(bright), 1));

  // the constellation: each node to its nearest two (a hundred or so nodes, so simply compared)
  const lp: number[] = [], lr: number[] = [], seen = new Set<number>();
  for (let a = count; a < total; a++) {
    const near: [number, number][] = [];
    for (let b = count; b < total; b++) {
      if (b === a) continue;
      const d2 = (pos[a * 3] - pos[b * 3]) ** 2 + (pos[a * 3 + 1] - pos[b * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b * 3 + 2]) ** 2;
      if (d2 < 0.3 * 0.3) near.push([d2, b]);
    }
    near.sort((p, q) => p[0] - q[0]);
    for (const [, b] of near.slice(0, 2)) {
      const k = Math.min(a, b) * total + Math.max(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      lp.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]);
      lr.push(rand[a], rand[b]);
    }
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
  lines.setAttribute("aRandom", new THREE.BufferAttribute(new Float32Array(lr), 1));
  const [r, l] = eyes.length === 2 ? eyes : [[99, 99], [99, 99]];
  return { points, lines, eyes: new THREE.Vector4(r[0], r[1], l[0], l[1]) };
}
