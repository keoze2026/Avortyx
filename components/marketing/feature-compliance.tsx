import Link from "next/link";

/**
 * Compliance section.
 *
 * Deliberately does NOT reuse the routing section's card-with-rows treatment.
 * The subject here is a *sequence* — a call descending through blocking gates —
 * so the visual is a vertical spine with nodes, and the copy column uses a
 * two-column key/detail grid rather than another bulleted list.
 *
 * The spine panel is a dark object floating on the light section; the copy
 * column stays on its light treatment.
 */

const GATES = [
  { label: "DNC registry", detail: "Federal · state · internal", ms: "12ms" },
  { label: "TCPA consent", detail: "Proof stored with record", ms: "8ms" },
  { label: "Recording rule", detail: "Two-party states applied", ms: "5ms" },
  { label: "Fraud signals", detail: "Carrier + velocity checks", ms: "31ms" },
];

const POINTS = [
  { k: "Suppression", v: "Federal, state and internal lists checked on every attempt." },
  { k: "Consent", v: "TCPA proof captured and stored alongside the call record." },
  { k: "Recording", v: "Per-state two-party rules applied without operator input." },
  { k: "Evidence", v: "Immutable decision logs, exportable for audit." },
];

/**
 * Focal motion: one pulse travels down the spine — each gate node's tint layer
 * fades up in sequence and the ripple lands on the Connected node — on a 4s
 * loop. The check marks never animate; only an additional low-alpha overlay
 * does, so nothing changes colour, only density. Default state is still: the
 * overlays are `opacity: 0` unless the user has expressed no motion preference.
 */
const COMPLIANCE_CSS = `
.cp-grid { display: grid; }
.cp-dl { display: grid; }
.cp-pulse,
.cp-ring {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0;
}
.cp-pulse {
  inset: -1px;
  border: 1px solid var(--m-accent-line-d);
  background: var(--m-accent-tint-d);
}
.cp-ring {
  inset: -5px;
  border: 1px solid var(--m-accent-line-d);
}
@media (prefers-reduced-motion: no-preference) {
  @keyframes cp-travel {
    0%   { opacity: 0; }
    6%   { opacity: 1; }
    22%  { opacity: 0; }
    100% { opacity: 0; }
  }
  .cp-pulse,
  .cp-ring {
    animation: cp-travel 4s ease-in-out infinite;
  }
  .cp-d0 { animation-delay: 0s; }
  .cp-d1 { animation-delay: 0.3s; }
  .cp-d2 { animation-delay: 0.6s; }
  .cp-d3 { animation-delay: 0.9s; }
  .cp-d4 { animation-delay: 1.2s; }
}
`;

function Check() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.8"
        stroke="var(--m-accent-d)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeatureCompliance() {
  return (
    <section
      id="compliance"
      style={{ background: "var(--m-bg-alt)", borderTop: "1px solid var(--m-line)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: COMPLIANCE_CSS }} />
      <div className="m-section">
        <div className="m-container">
          <div
            style={{ gap: 72, alignItems: "center" }}
            className="cp-grid lg:grid-cols-2"
          >
            {/* Copy — light side, unchanged */}
            <div className="lg:order-last m-reveal">
              <p className="m-label" style={{ color: "var(--m-accent)" }}>
                Compliance
              </p>
              <h2 className="m-h2" style={{ marginTop: 14 }}>
                Every call clears before it connects.
              </h2>
              <p className="m-lead" style={{ marginTop: 16, color: "var(--m-fg-2)", maxWidth: "44ch" }}>
                Consent, suppression and recording rules run as a blocking step in
                the routing path — not as an audit you read about afterwards.
              </p>

              {/* Key/detail grid — a different rhythm from the routing list */}
              <dl
                style={{
                  margin: "32px 0 0",
                  gap: "1px",
                  background: "var(--m-line)",
                  border: "1px solid var(--m-line)",
                  borderRadius: "var(--m-r)",
                  overflow: "hidden",
                }}
                className="cp-dl sm:grid-cols-2"
              >
                {POINTS.map((p) => (
                  <div key={p.k} style={{ background: "var(--m-surface)", padding: "16px 18px" }}>
                    <dt
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--m-mono)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--m-accent)",
                      }}
                    >
                      {p.k}
                    </dt>
                    <dd style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--m-fg-2)" }}>
                      {p.v}
                    </dd>
                  </div>
                ))}
              </dl>

              <Link href="#compliance-brief" className="m-link" style={{ marginTop: 28 }}>
                Read the compliance brief <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Gate pipeline — a spine, not a table */}
            <div className="lg:order-first">
              <div
                className="m-reveal-object"
                style={{
                  background: "var(--m-bg-dark)",
                  border: "1px solid var(--m-line-d2)",
                  borderRadius: "var(--m-r-lg)",
                  boxShadow: "var(--m-shadow-lg)",
                  padding: "28px 26px",
                }}
              >
                <div style={{ position: "relative", paddingLeft: 30 }}>
                  {/* the spine */}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 8,
                      top: 10,
                      bottom: 10,
                      width: 1,
                      background: "var(--m-line-d2)",
                    }}
                  />

                  {/* inbound */}
                  <div style={{ position: "relative", paddingBottom: 22 }}>
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: -30,
                        top: 3,
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                        border: "1px solid var(--m-line-d2)",
                        background: "var(--m-bg-dark-2)",
                      }}
                    />
                    <div style={{ fontSize: 11, fontFamily: "var(--m-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--m-fg-d3)" }}>
                      Inbound
                    </div>
                    <div style={{ fontSize: 14, fontFamily: "var(--m-mono)", color: "var(--m-fg-d)", marginTop: 5 }}>
                      +1 (888) 555-0147
                    </div>
                  </div>

                  {/* gates */}
                  {GATES.map((g, i) => (
                    <div key={g.label} style={{ position: "relative", paddingBottom: 20 }}>
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: -30,
                          top: 1,
                          width: 17,
                          height: 17,
                          borderRadius: 999,
                          border: "1px solid var(--m-accent-line-d)",
                          background: "var(--m-accent-tint-d)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <span className={`cp-pulse cp-d${i}`} />
                        <Check />
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--m-fg-d)", letterSpacing: "-0.01em" }}>
                          {g.label}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 12,
                            fontFamily: "var(--m-mono)",
                            color: "var(--m-fg-d3)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {g.ms}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--m-fg-d3)", marginTop: 3 }}>{g.detail}</div>
                    </div>
                  ))}

                  {/* connected */}
                  <div style={{ position: "relative" }}>
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: -30,
                        top: 3,
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                        background: "var(--m-accent-d)",
                      }}
                    >
                      <span className="cp-ring cp-d4" />
                    </span>
                    <div style={{ fontSize: 11, fontFamily: "var(--m-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--m-accent-d)" }}>
                      Connected
                    </div>
                    <div style={{ fontSize: 14, color: "var(--m-fg-d)", marginTop: 5 }}>
                      Apex Insurance
                      <span style={{ color: "var(--m-fg-d3)", fontFamily: "var(--m-mono)", fontSize: 12.5 }}>
                        {" · 56ms total"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureCompliance;
