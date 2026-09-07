import type { CSSProperties } from "react";

const FEATURES = [
  {
    title: "Intent scoring",
    body: "Ranks callers on live transcription signals.",
  },
  {
    title: "Capacity aware",
    body: "Respects per-buyer concurrency and daily caps.",
  },
  {
    title: "Geo & schedule",
    body: "State, timezone and day-part rule trees.",
  },
  {
    title: "Never drops",
    body: "Fallback chains cascade until someone answers.",
  },
];

const RULES = [
  {
    name: "Health · CA",
    condition: "intent ≥ 85",
    destination: "Apex Insurance",
    priority: "P1",
  },
  {
    name: "Solar · TX",
    condition: "weight 60% · cap 12",
    destination: "SolarEdge",
    priority: "P2",
  },
  {
    name: "Legal · national",
    condition: "intent ≥ 90",
    destination: "Metro Legal",
    priority: "P1",
  },
  {
    name: "Fallback",
    condition: "any unmatched",
    destination: "Overflow pool",
    priority: "P4",
  },
];

/**
 * Focal motion: a single low-alpha accent band drifts down the rule list on a
 * 6s loop, reading as continuous evaluation. Nothing else in the section moves.
 * The band is invisible by default and only switches on under
 * `prefers-reduced-motion: no-preference`, so the reduced-motion frame is the
 * clean static card.
 */
const ROUTING_CSS = `
.rt-grid { display: grid; }
.rt-scan-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.rt-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 34%;
  opacity: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--m-accent-tint-d) 50%,
    transparent 100%
  );
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes rt-scan-move {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(294%); }
  }
  .rt-scan {
    opacity: 1;
    animation: rt-scan-move 6s linear infinite;
    will-change: transform;
  }
}
`;

const chipQuiet: CSSProperties = {
  display: "inline-block",
  padding: "1.5px 7px",
  borderRadius: 999,
  border: "1px solid var(--m-line-d2)",
  color: "var(--m-fg-d2)",
  fontSize: 10.5,
  lineHeight: 1.5,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

const chipAccent: CSSProperties = {
  display: "inline-block",
  padding: "1.5px 7px",
  borderRadius: 999,
  border: "1px solid var(--m-accent-line-d)",
  background: "var(--m-accent-tint-d)",
  color: "var(--m-accent-d)",
  fontSize: 10.5,
  lineHeight: 1.5,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

export function FeatureRouting() {
  return (
    <section id="routing" style={{ background: "var(--m-bg)" }}>
      <style dangerouslySetInnerHTML={{ __html: ROUTING_CSS }} />
      <div className="m-section">
        <div className="m-container">
          <div
            className="rt-grid lg:grid-cols-2"
            style={{ gap: 72, alignItems: "center" }}
          >
            {/* Copy — light side, unchanged */}
            <div className="m-reveal">
              <p className="m-label" style={{ color: "var(--m-accent)" }}>
                ROUTING
              </p>
              <h2 className="m-h2" style={{ marginTop: 14 }}>
                Rules you can reason about.
              </h2>
              <p
                className="m-lead"
                style={{
                  marginTop: 16,
                  color: "var(--m-fg-2)",
                  maxWidth: "44ch",
                }}
              >
                Static priority lists can&apos;t tell a high-intent caller from a
                tire-kicker. Avortyx scores intent, geography, buyer capacity and
                campaign economics on every call, then picks the destination worth
                the most.
              </p>

              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  marginTop: 30,
                  display: "grid",
                  gap: 14,
                  maxWidth: "42ch",
                }}
              >
                {FEATURES.map((f) => (
                  <li
                    key={f.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 4,
                        height: 4,
                        marginTop: 8,
                        borderRadius: 999,
                        background: "var(--m-accent)",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--m-fg)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {f.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          color: "var(--m-fg-2)",
                          marginTop: 3,
                        }}
                      >
                        {f.body}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <a href="#docs" className="m-link" style={{ marginTop: 26 }}>
                See routing docs <span aria-hidden>→</span>
              </a>
            </div>

            {/* Mockup — dark object floating on the light section */}
            <div
              className="m-reveal-object"
              style={{
                position: "relative",
                background: "var(--m-bg-dark)",
                border: "1px solid var(--m-line-d2)",
                borderRadius: "var(--m-r-lg)",
                boxShadow: "var(--m-shadow-lg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--m-line-d)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--m-display)",
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.015em",
                    color: "var(--m-fg-d)",
                  }}
                >
                  Routing rules
                </span>
                <span style={chipQuiet}>4 active</span>
              </div>

              <div style={{ position: "relative" }}>
                {/* focal motion: evaluation band */}
                <span aria-hidden className="rt-scan-wrap">
                  <span className="rt-scan" />
                </span>

                {RULES.map((r, i) => (
                  <div
                    key={r.name}
                    style={{
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "13px 16px",
                      borderBottom:
                        i < RULES.length - 1
                          ? "1px solid var(--m-line-d)"
                          : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--m-fg-d)",
                          letterSpacing: "-0.01em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--m-mono)",
                          fontSize: 12.5,
                          color: "var(--m-fg-d3)",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.condition}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--m-fg-d2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.destination}
                      </span>
                      <span style={chipAccent}>{r.priority}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "11px 16px",
                  background: "var(--m-bg-dark-3)",
                  borderTop: "1px solid var(--m-line-d)",
                  fontFamily: "var(--m-mono)",
                  fontSize: 11.5,
                  color: "var(--m-fg-d3)",
                }}
              >
                <span>Evaluated 3,847 times today</span>
                <span style={{ color: "var(--m-accent-d)" }}>0 unrouted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureRouting;
