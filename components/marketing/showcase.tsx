const NAV = [
  "Dashboard",
  "Live calls",
  "Buyers",
  "Campaigns",
  "Numbers",
  "Reports",
];

const TILES = [
  { label: "In flight", value: "47", live: true },
  { label: "Connected today", value: "3,847", live: false },
  { label: "Revenue", value: "$284,620", live: false },
];

const COLUMNS = ["Time", "Caller", "Vertical", "Buyer", "Payout", "Status"];

const ROWS = [
  {
    time: "14:32:08",
    caller: "+1 (855) 555-0198",
    vertical: "Medicare",
    buyer: "Silverline Health",
    payout: "—",
    status: "Routing",
  },
  {
    time: "14:31:54",
    caller: "+1 (888) 555-0147",
    vertical: "Health",
    buyer: "Apex Insurance",
    payout: "$22.50",
    status: "Connected",
  },
  {
    time: "14:31:22",
    caller: "+1 (800) 555-0923",
    vertical: "Solar",
    buyer: "SolarEdge Partners",
    payout: "$18.00",
    status: "Connected",
  },
  {
    time: "14:30:47",
    caller: "+1 (844) 555-0381",
    vertical: "Legal",
    buyer: "Metro Legal Group",
    payout: "$41.00",
    status: "Connected",
  },
  {
    time: "14:30:11",
    caller: "+1 (877) 555-0264",
    vertical: "Home",
    buyer: "Beacon Roofing",
    payout: "$16.75",
    status: "Connected",
  },
];

/**
 * Focal motion: the single live counter — "In flight" — breathes on a 4s loop.
 * It is the one number in the console that is genuinely in motion, so it is the
 * only thing that moves. No entrance animation; the window is complete at rest,
 * and reduced-motion users get the static frame because the animation is only
 * declared inside the `no-preference` query.
 */
const SHOWCASE_CSS = `
.sc-body { display: grid; }
.sc-tiles { display: grid; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes sc-breathe {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.62; }
  }
  .sc-live {
    animation: sc-breathe 4s ease-in-out infinite;
  }
}
`;

function StatusChip({ status }: { status: string }) {
  const connected = status === "Connected";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1.5px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        border: connected
          ? "1px solid var(--m-accent-line-d)"
          : "1px solid var(--m-line-d2)",
        background: connected ? "var(--m-accent-tint-d)" : "transparent",
        color: connected ? "var(--m-accent-d)" : "var(--m-fg-d3)",
      }}
    >
      {status}
    </span>
  );
}

export function Showcase() {
  return (
    <section
      style={{
        background: "var(--m-bg-alt)",
        borderTop: "1px solid var(--m-line)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: SHOWCASE_CSS }} />
      <div className="m-section">
        <div className="m-container">
          {/* Copy — light side, unchanged */}
          <div
            className="m-reveal"
            style={{ textAlign: "center", maxWidth: 620, margin: "0 auto" }}
          >
            <p className="m-label" style={{ color: "var(--m-accent)" }}>
              THE CONSOLE
            </p>
            <h2 className="m-h2" style={{ marginTop: 14 }}>
              Your whole network, one screen.
            </h2>
            <p className="m-lead" style={{ marginTop: 16, color: "var(--m-fg-2)" }}>
              Operators live here — call queue, buyer health and revenue on a single
              surface.
            </p>
          </div>

          {/* Dark app window floating on the light section */}
          <div
            className="m-reveal-object"
            style={{
              marginTop: 52,
              background: "var(--m-bg-dark)",
              border: "1px solid var(--m-line-d2)",
              borderRadius: "var(--m-r-lg)",
              boxShadow: "var(--m-shadow-lg)",
              overflow: "hidden",
            }}
          >
            {/* Window chrome */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 14px",
                background: "var(--m-bg-dark-2)",
                borderBottom: "1px solid var(--m-line-d)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--m-line-d2)",
                }}
              />
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--m-line-d2)",
                }}
              />
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--m-line-d2)",
                }}
              />
              <span
                style={{
                  margin: "0 auto",
                  padding: "3px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--m-line-d)",
                  background: "var(--m-bg-dark-3)",
                  fontFamily: "var(--m-mono)",
                  fontSize: 11.5,
                  color: "var(--m-fg-d3)",
                }}
              >
                app.avortyx.com/console
              </span>
            </div>

            {/* Window body */}
            <div className="sc-body lg:grid-cols-[180px_1fr]">
              {/* Sidebar */}
              <nav
                aria-label="Console navigation"
                className="hidden lg:block"
                style={{
                  background: "var(--m-bg-dark-2)",
                  borderRight: "1px solid var(--m-line-d)",
                  padding: 14,
                }}
              >
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {NAV.map((item) => {
                    const active = item === "Live calls";
                    return (
                      <li key={item}>
                        <span
                          style={{
                            display: "block",
                            padding: "7px 9px",
                            borderRadius: "var(--m-r-sm)",
                            fontSize: 13,
                            letterSpacing: "-0.01em",
                            color: active
                              ? "var(--m-accent-d)"
                              : "var(--m-fg-d2)",
                            background: active
                              ? "var(--m-accent-tint-d)"
                              : "transparent",
                          }}
                        >
                          {item}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Main pane */}
              <div style={{ padding: 18, minWidth: 0 }}>
                <div className="sc-tiles sm:grid-cols-3" style={{ gap: 12 }}>
                  {TILES.map((t) => (
                    <div
                      key={t.label}
                      style={{
                        border: "1px solid var(--m-line-d)",
                        background: "var(--m-bg-dark-2)",
                        borderRadius: "var(--m-r)",
                        padding: 14,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--m-fg-d3)" }}>
                        {t.label}
                      </div>
                      <div
                        className={t.live ? "sc-live" : undefined}
                        style={{
                          marginTop: 6,
                          fontFamily: "var(--m-display)",
                          fontSize: 22,
                          fontWeight: 600,
                          letterSpacing: "-0.028em",
                          color: "var(--m-fg-d)",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: 1.1,
                        }}
                      >
                        {t.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 560,
                      borderCollapse: "collapse",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr>
                        {COLUMNS.map((c) => (
                          <th
                            key={c}
                            scope="col"
                            style={{
                              padding: "0 12px 9px 0",
                              borderBottom: "1px solid var(--m-line-d)",
                              fontFamily: "var(--m-mono)",
                              fontSize: 11,
                              fontWeight: 400,
                              textTransform: "uppercase",
                              letterSpacing: "0.09em",
                              color: "var(--m-fg-d3)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((r, i) => (
                        <tr key={r.time}>
                          <td
                            style={{
                              padding: "11px 12px 11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              fontFamily: "var(--m-mono)",
                              fontSize: 13,
                              color: "var(--m-fg-d3)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.time}
                          </td>
                          <td
                            style={{
                              padding: "11px 12px 11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              fontFamily: "var(--m-mono)",
                              fontSize: 13,
                              color: "var(--m-fg-d)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.caller}
                          </td>
                          <td
                            style={{
                              padding: "11px 12px 11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              fontSize: 13,
                              color: "var(--m-fg-d2)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.vertical}
                          </td>
                          <td
                            style={{
                              padding: "11px 12px 11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              fontSize: 13,
                              color: "var(--m-fg-d)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.buyer}
                          </td>
                          <td
                            style={{
                              padding: "11px 12px 11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              fontFamily: "var(--m-mono)",
                              fontSize: 13,
                              color:
                                r.payout === "—"
                                  ? "var(--m-fg-d3)"
                                  : "var(--m-fg-d)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.payout}
                          </td>
                          <td
                            style={{
                              padding: "11px 0",
                              borderBottom:
                                i < ROWS.length - 1
                                  ? "1px solid var(--m-line-d)"
                                  : "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <StatusChip status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Showcase;
