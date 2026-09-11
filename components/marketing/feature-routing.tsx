import type { CSSProperties } from "react";
import { Phone } from "lucide-react";

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
    // Where this threshold sits on the 0-100 intent scale — rendered as a
    // marker, not just stated, so the bar a call has to clear is visible.
    threshold: 85,
    destination: "Apex Insurance",
    priority: "P1",
  },
  {
    name: "Solar · TX",
    condition: "weight 60% · cap 12",
    threshold: null,
    destination: "SolarEdge",
    priority: "P2",
  },
  {
    name: "Legal · national",
    condition: "intent ≥ 90",
    threshold: 90,
    destination: "Metro Legal",
    priority: "P1",
  },
  {
    name: "Fallback",
    condition: "any unmatched",
    threshold: null,
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

/* The phone in the header is the signal's source — the scan band above
   already sweeps top-to-bottom through the rules, so anchoring a rippling
   phone glyph right where that sweep starts reads as "a call comes in here,
   and its evaluation travels down through the stack," not two unrelated
   animations sharing a card. */
.rt-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1px solid var(--m-accent-line-d);
  opacity: 0;
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes rt-ripple {
    0%   { transform: scale(0.55); opacity: 0.6; }
    100% { transform: scale(2.3); opacity: 0; }
  }
  .rt-ring {
    animation: rt-ripple 3s ease-out infinite;
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
                  gap: 10,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--m-line-d)",
                }}
              >
                {/* The signal source — every rule below exists to answer
                    "where does this call go," so the call itself opens the
                    panel rather than a plain label. */}
                <span
                  aria-hidden
                  style={{
                    position: "relative",
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span className="rt-ring" />
                  <span className="rt-ring" style={{ animationDelay: "-1.5s" }} />
                  <span
                    style={{
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      background: "var(--m-accent-tint-d)",
                      border: "1px solid var(--m-accent-line-d)",
                    }}
                  >
                    <Phone size={11} color="var(--m-accent-d)" strokeWidth={2} />
                  </span>
                </span>

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
                <span style={{ ...chipQuiet, marginLeft: "auto" }}>4 active</span>
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
                      // Rank column added: evaluation order is the thing this
                      // panel exists to make legible, so it gets its own slot
                      // rather than living only in the P-priority chip.
                      gridTemplateColumns: "24px minmax(0,1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "13px 16px",
                      borderBottom:
                        i < RULES.length - 1
                          ? "1px solid var(--m-line-d)"
                          : "none",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        fontFamily: "var(--m-mono)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--m-fg-d3)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

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
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 4,
                          // Lets the condition text actually shrink below its
                          // content width — flex items default to min-width:
                          // auto, which would otherwise fight its own
                          // overflow:hidden and let the row spill past the card.
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--m-mono)",
                            fontSize: 12.5,
                            color: "var(--m-fg-d3)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {r.condition}
                        </span>
                        {/* Not every rule gates on intent — only render the
                            scale for the ones that do, rather than a marker
                            with nothing to mark. */}
                        {r.threshold != null && (
                          <span
                            aria-hidden
                            style={{
                              position: "relative",
                              width: 40,
                              height: 3,
                              borderRadius: 999,
                              background: "var(--m-line-d2)",
                              flexShrink: 0,
                            }}
                          >
                            {/* Single marker at the threshold — a cutoff
                                point on the 0-100 scale, not a fill amount. */}
                            <span
                              style={{
                                position: "absolute",
                                left: `${r.threshold}%`,
                                top: "50%",
                                width: 3,
                                height: 9,
                                marginLeft: -1.5,
                                transform: "translateY(-50%)",
                                borderRadius: 999,
                                background: "var(--m-accent-d)",
                              }}
                            />
                          </span>
                        )}
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
