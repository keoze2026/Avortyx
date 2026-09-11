/**
 * Trust rail beneath the hero.
 *
 * A slow marquee rather than a static row — it gives the page a pulse right
 * after the hero without asking for attention. The track holds two identical
 * halves so translating -50% loops seamlessly; it pauses on hover, and
 * `prefers-reduced-motion` leaves it stationary (the first half is still
 * fully legible at rest).
 *
 * Hairline dividers between names are a device used nowhere else on the page.
 */

const NETWORKS = [
  "Ringwell",
  "Northaven",
  "Calibr",
  "Tenpoint",
  "Meridian",
  "Halcyon",
  "Bellcast",
];

function Half({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden || undefined}
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {NETWORKS.map((name) => (
        <li key={name} style={{ display: "flex", alignItems: "center" }}>
          <span
            aria-hidden
            style={{ width: 1, height: 15, background: "var(--m-line-2)", margin: "0 30px" }}
          />
          <span
            style={{
              fontFamily: "var(--m-display)",
              fontSize: 16.5,
              fontWeight: 600,
              letterSpacing: "-0.022em",
              color: "var(--m-fg-3)",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LogoRail() {
  return (
    <section
      aria-label="Customers"
      style={{ background: "var(--m-bg)", borderBottom: "1px solid var(--m-line)" }}
    >
      <div style={{ padding: "34px 0" }}>
        <p
          className="m-label"
          style={{ color: "var(--m-fg-3)", textAlign: "center", margin: 0 }}
        >
          Trusted by networks that route calls at scale
        </p>

        <div className="m-marquee-mask" style={{ marginTop: 22 }}>
          <div className="m-marquee-track">
            <Half />
            <Half ariaHidden />
          </div>
        </div>
      </div>
    </section>
  );
}

export default LogoRail;
