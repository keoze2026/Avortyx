"use client";

/**
 * Drives the scroll reveals for the marketing shell. Renders nothing.
 *
 * Why an observer rather than CSS `animation-timeline: view()`: that property
 * is Chromium-only, so Safari and Firefox got no reveals at all. This works
 * everywhere.
 *
 * Safety properties, in order of importance:
 *   • The hidden rest state lives entirely under `.js-reveal`, which only
 *     exists once this mounts. No JS → nothing is ever hidden.
 *   • Under `prefers-reduced-motion: reduce` it bails before adding the
 *     class, so those users get the finished page immediately.
 *   • Elements already on screen are marked `.is-in` *before* `.js-reveal`
 *     is added, so above-the-fold content never flashes out and back in.
 *   • A MutationObserver picks up nodes added later (route changes, lazy
 *     sections) so they reveal too rather than staying stuck hidden.
 */

import { useEffect } from "react";

const SELECTOR = ".m-reveal, .m-reveal-late, .m-reveal-object";

export function Reveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.querySelector<HTMLElement>(".marketing-shell");
    if (!root || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.04 },
    );

    const track = (el: Element) => {
      if (el.classList.contains("is-in")) return;
      io.observe(el);
    };

    // Settle what's already on screen first, so adding `.js-reveal` below
    // can't briefly hide content the visitor is looking at.
    const initial = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
    for (const el of initial) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add("is-in");
      }
    }

    root.classList.add("js-reveal");
    for (const el of initial) track(el);

    // Catch anything mounted after this pass.
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(SELECTOR)) track(node);
          node.querySelectorAll<HTMLElement>(SELECTOR).forEach(track);
        }
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);

  return null;
}

export default Reveal;
