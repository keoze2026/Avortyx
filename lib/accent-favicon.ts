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
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${bright}"/><stop offset="55%" stop-color="${mid}"/><stop offset="100%" stop-color="${deep}"/>
</linearGradient></defs>
<g transform="translate(32 32) scale(1.42) translate(-32 -32)">
<path d="M52 32a20 20 0 1 1-13.2-18.8" stroke="url(#g)" stroke-width="5" stroke-linecap="round"/>
<path d="M44.5 32a12.5 12.5 0 1 1-8.9-11.9" stroke="url(#g)" stroke-width="4.4" stroke-linecap="round"/>
<path d="M38 32a6 6 0 1 1-4.2-5.7" stroke="url(#g)" stroke-width="3.6" stroke-linecap="round"/>
<circle cx="32" cy="32" r="2" fill="${bright}"/>
</g></svg>`;
}

/** Point the tab-icon links at the coloured mark, or back to the files. */
export function applyAccentFavicon(theme: ColorTheme, isDefault: boolean) {
  if (typeof document === "undefined") return;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  const svg = isDefault ? null : faviconSvg(theme);
  const url = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
  for (const link of links) {
    if (!link.dataset.origHref) {
      link.dataset.origHref = link.getAttribute("href") ?? "";
      link.dataset.origType = link.getAttribute("type") ?? "";
    }
    if (url) {
      link.setAttribute("href", url);
      link.setAttribute("type", "image/svg+xml");
    } else {
      link.setAttribute("href", link.dataset.origHref);
      if (link.dataset.origType) link.setAttribute("type", link.dataset.origType);
      else link.removeAttribute("type");
    }
  }
}
