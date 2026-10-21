"use client";

import { useEffect, useState } from "react";

// Where the AI's portrait goes (centre and radius, CSS px): between intro and card on wide screens
// (window centre from 2000px), her stage on phones and tablets, else small in the header's corner.

export type Placement = { x: number; y: number; r: number; tag: boolean };

// the rightmost intro text between two heights
export function textRight(top: number, bottom: number, from: number) {
  let right = from;
  const rects = [...document.querySelectorAll("[data-intro] h2, [data-intro] p")].flatMap((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()];
  });
  document.querySelectorAll("[data-intro] [role=group]").forEach((el) => rects.push(el.getBoundingClientRect()));
  for (const r of rects) if (r.width && r.bottom > top && r.top < bottom) right = Math.max(right, r.right);
  return right;
}

function measure(): Placement | null {
  const W = window.innerWidth, H = window.innerHeight;
  const card = document.querySelector("[data-card]")?.getBoundingClientRect();
  const intro = document.querySelector("[data-intro]")?.getBoundingClientRect();
  if (card && intro && W >= 1024 && intro.left < card.left) {
    // she spans ~1.2 radii across (1.35 as she turns) and ~1.4 up and down
    const cy = card.top + card.height / 2, most = W >= 2000 ? Math.min(H * 0.28, W * 0.12) : Math.min(H * 0.25, W * 0.12);
    // room for the circuit's wires to the card
    const gap = card.left - textRight(cy - most * 1.5, cy + most * 1.5, intro.left);
    const wires = Math.max(48, Math.min(120, gap * 0.22));
    const centred = window.matchMedia("(min-width: 125rem)").matches;
    for (let r = most; r >= 40; r *= 0.97) {
      const start = textRight(cy - r * 1.5, cy + r * 1.5, intro.left) + 24, end = card.left - wires;
      if (centred) {
        if (W / 2 - r * 1.225 >= start && W / 2 + r * 1.225 <= end) return { x: W / 2, y: H / 2, r, tag: true };
      } else if (end - start >= r * 2.45) return { x: (start + end) / 2, y: cy - r * 0.1, r, tag: true };
    }
  }
  // she is 2.8 units tall, ~2.4 wide
  const stage = document.querySelector("[data-ai-stage]")?.getBoundingClientRect();
  if (stage?.width && stage.height) return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2, r: Math.min(stage.height / 2.9, stage.width / 2.5), tag: false };
  const header = document.querySelector("[data-header]")?.getBoundingClientRect();
  if (!header) return null;
  const r = Math.max(15, header.height * 0.26);
  return { x: Math.min(header.right, W) - (W >= 640 ? 32 : 20) - r * 1.5, y: header.top + header.height / 2, r, tag: false };
}

export function useAiPlacement() {
  const [place, setPlace] = useState<Placement | null>(null);
  useEffect(() => {
    // keep the same object while nothing moved, to avoid re-renders
    const update = () => setPlace((was) => {
      const now = measure();
      return was && now && was.x === now.x && was.y === now.y && was.r === now.r && was.tag === now.tag ? was : now;
    });
    update();
    const timers = [window.setTimeout(update, 1200), window.setTimeout(update, 2300)];
    document.fonts?.ready.then(() => window.setTimeout(update, 50));
    const ro = new ResizeObserver(update);
    document.querySelectorAll("[data-card], [data-intro], [data-intro] [role=group], [data-header], [data-ai-stage]").forEach((el) => ro.observe(el));
    window.addEventListener("resize", update);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return place;
}
