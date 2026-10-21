// The chip's shape, for the live strip (live-ticker.tsx) and the AI's tag (ai-status.tsx): a box with
// its top-left and bottom-right corners slashed off at 45 degrees and every corner rounded, the square
// ones by `round`, the slashes' ends a little (`soft`).
export type ChipShape = { cut: number; round: number; soft: number };

const S2 = Math.SQRT1_2;
const n = (v: number) => +v.toFixed(2);

// the shape as a CSS mask, for a box of any size and before any script has run: a tile for each
// corner (an SVG: the slash, or the round) and two bars across the middle, which together cover it
export function chipMask({ cut, round, soft }: ChipShape): React.CSSProperties {
  const T = Math.ceil(Math.max(cut + soft, round)) + 2;
  const slash = `M0 ${T}L0 ${n(cut + soft)}Q0 ${cut} ${n(soft * S2)} ${n(cut - soft * S2)}L${n(cut - soft * S2)} ${n(soft * S2)}Q${cut} 0 ${n(cut + soft)} 0L${T} 0L${T} ${T}Z`;
  const rounded = `M0 0L${T - round} 0A${round} ${round} 0 0 1 ${T} ${round}L${T} ${T}L0 ${T}Z`;
  const tile = (d: string, turn: boolean) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}"><path d="${d}"${turn ? ` transform="rotate(180 ${T / 2} ${T / 2})"` : ""}/></svg>`)}")`;
  const bar = "linear-gradient(#000 0 0)";
  const image = [tile(slash, false), tile(rounded, false), tile(slash, true), tile(rounded, true), bar, bar].join(", ");
  const position = "left top, right top, right bottom, left bottom, center, center";
  const size = `${T}px ${T}px, ${T}px ${T}px, ${T}px ${T}px, ${T}px ${T}px, calc(100% - ${2 * T}px) 100%, 100% calc(100% - ${2 * T}px)`;
  return {
    maskImage: image, maskPosition: position, maskSize: size, maskRepeat: "no-repeat",
    WebkitMaskImage: image, WebkitMaskPosition: position, WebkitMaskSize: size, WebkitMaskRepeat: "no-repeat",
  };
}

// the shape inset by d: the square corners' rounds less d; the slashes, kept parallel, a little shorter
export const insetShape = ({ cut, round, soft }: ChipShape, d: number): ChipShape => ({
  cut: cut - d * (2 - Math.SQRT2), round: round - d, soft: Math.max(0, soft - d * 0.4),
});
