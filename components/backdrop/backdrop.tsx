// The static CSS backdrop under the 3D scene: dark ground, faint glows, grain, vignette.
// The grain also keeps the long gradients from banding.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden forced-colors:hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_0%,#0a1a38,#050b19_45%,#03050b)]" />
      <div className="absolute left-1/2 top-[-40%] h-[90vmax] w-[90vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.13),transparent)]" />
      <div className="absolute -left-[20%] top-[30%] h-[65vmax] w-[65vmax] rounded-full bg-[radial-gradient(closest-side,rgba(96,165,250,0.05),transparent)]" />
      <div className="absolute -bottom-[35%] -right-[20%] h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(closest-side,rgba(29,78,216,0.1),transparent)]" />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_42%,transparent_45%,rgba(1,2,6,0.75))]" />
    </div>
  );
}
