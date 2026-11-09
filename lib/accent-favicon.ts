/**
 * CH-457 (Sir, 31 Oct): the browser-tab icon follows the picked colour, like
 * the Avortyx logo in the sidebar (CH-455). The files in /public stay the
 * blue default; for any other colour the same mark is drawn in that colour
 * and put on the page's icon links.
 */
import type { ColorTheme } from "@/lib/accent-themes";

const HEX = /#[0-9a-f]{6}/gi;

function mix(hex: string, other: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(a, s) * (1 - amount) + ch(b, s) * amount));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Bright, middle and deep stops for the mark, from the theme's swatch. */
export function faviconStops(theme: ColorTheme): [string, string, string] | null {
  const found = theme.swatch.match(HEX);
  if (!found?.length) return null;
  if (found.length >= 3) return [found[0], found[1], found[2]];
  const base = found[0];
  return [mix(base, "#ffffff", 0.4), base, mix(base, "#000000", 0.25)];
}

export function faviconSvg(theme: ColorTheme): string | null {
  const stops = faviconStops(theme);
  if (!stops) return null;
  const [bright, mid, deep] = stops;
  const ultra = mix(bright, "#ffffff", 0.7);
  // Same dark tile as public/favicon.svg, with the mark in the picked colour.
  return `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" fill="none">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${bright}"/><stop offset="55%" stop-color="${mid}"/><stop offset="100%" stop-color="${deep}"/>
</linearGradient>
<radialGradient id="c" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="${ultra}"/><stop offset="60%" stop-color="${bright}" stop-opacity="0.6"/><stop offset="100%" stop-color="${mid}" stop-opacity="0"/>
</radialGradient>
<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="180" height="180" rx="40" fill="#0E1219"/>
<g transform="translate(90 90) scale(2.2) translate(-32 -32)">
<circle cx="32" cy="32" r="20" fill="url(#c)" opacity="0.45"/>
<path d="M52 32a20 20 0 1 1-13.2-18.8" stroke="url(#g)" stroke-width="3" stroke-linecap="round" filter="url(#f)"/>
<path d="M44.5 32a12.5 12.5 0 1 1-8.9-11.9" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" filter="url(#f)" opacity="0.92"/>
<path d="M38 32a6 6 0 1 1-4.2-5.7" stroke="url(#g)" stroke-width="2" stroke-linecap="round" filter="url(#f)" opacity="0.9"/>
<circle cx="32" cy="32" r="1.6" fill="${ultra}" filter="url(#f)"/>
</g></svg>`;
}

/** Point the tab-icon links at the coloured mark, or back to the files.
 *  Only touches a link that is not already right, so it can run on every
 *  change to the page head without looping. */
export function applyAccentFavicon(theme: ColorTheme, isDefault: boolean) {
  if (typeof document === "undefined") return;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  const svg = isDefault ? null : faviconSvg(theme);
  const url = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("data:")) {
      // First sight, or Next.js put its own file back: remember the file.
      link.dataset.origHref = href;
      link.dataset.origType = link.getAttribute("type") ?? "";
    }
    const wantHref = url ?? link.dataset.origHref ?? href;
    if (href !== wantHref) link.setAttribute("href", wantHref);
    const wantType = url ? "image/svg+xml" : link.dataset.origType ?? "";
    if ((link.getAttribute("type") ?? "") !== wantType) {
      if (wantType) link.setAttribute("type", wantType);
      else link.removeAttribute("type");
    }
  }
}

/** CH-459: Next.js rewrites the page head on every page change and puts the
 *  blue icon files back, so the tab went blue again after a click in the
 *  sidebar. Watch the head and re-apply the colour whenever it changes.
 *  Returns the function that stops watching. */
export function watchAccentFavicon(theme: ColorTheme, isDefault: boolean): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  applyAccentFavicon(theme, isDefault);
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyAccentFavicon(theme, isDefault);
    });
  });
  observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  return () => observer.disconnect();
}
