import type { ReactNode } from "react";

const svgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "var(--m-accent)",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ITEMS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: (
      <svg {...svgProps}>
        <path d="M9.5 3.5 8 20.5M16 3.5 14.5 20.5M3.5 8.75h17M3 15.25h17" />
      </svg>
    ),
    title: "Number provisioning",
    body: "Buy, port and pool numbers across 50 states from one inventory.",
  },
  {
    icon: (
      <svg {...svgProps}>
        <path d="M2.5 12h3l2.6-6.5L12 18.5l2.6-8 1.7 3.2h5.2" />
      </svg>
    ),
    title: "Live monitoring",
    body: "Watch every in-flight call, with barge and whisper for supervisors.",
  },
  {
    icon: (
      <svg {...svgProps}>
        <path d="M11.4 2.8h8.3a1.5 1.5 0 0 1 1.5 1.5v8.3l-8.6 8.6a1.6 1.6 0 0 1-2.3 0l-7.5-7.5a1.6 1.6 0 0 1 0-2.3z" />
        <circle cx="16.6" cy="7.4" r="1.5" />
      </svg>
    ),
    title: "Buyer marketplace",
    body: "Publish inventory and let vetted buyers bid on your traffic.",
  },
  {
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="M12 6.6v10.8M14.7 9.3a3.1 3.1 0 0 0-2.7-1.3c-1.7 0-2.9.9-2.9 2.2 0 3 5.8 1.7 5.8 4.7 0 1.4-1.3 2.3-3 2.3a3.3 3.3 0 0 1-2.9-1.4" />
      </svg>
    ),
    title: "Payout automation",
    body: "Reconcile connected minutes and settle on your own schedule.",
  },
  {
    icon: (
      <svg {...svgProps}>
        <circle cx="5.2" cy="6" r="2.4" />
        <circle cx="5.2" cy="18" r="2.4" />
        <circle cx="18.8" cy="12" r="2.4" />
        <path d="M7.4 7 16.6 11M7.4 17 16.6 13" />
      </svg>
    ),
    title: "Attribution",
    body: "Tie every call back to the campaign, keyword and creative.",
  },
  {
    icon: (
      <svg {...svgProps}>
        <path d="M3.2 20.6h17.6" />
        <path d="M7 20.6v-5.4M12 20.6v-11M17 20.6v-7.6" />
      </svg>
    ),
    title: "Reporting",
    body: "Cohort, vertical and buyer-level analysis, exportable anywhere.",
  },
];

export function Capabilities() {
  return (
    <section
      id="platform"
      style={{ background: "var(--m-bg)", borderTop: "1px solid var(--m-line)" }}
    >
      <div className="m-section">
        <div className="m-container">
          <div
            className="m-reveal"
            style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}
          >
            <p className="m-label" style={{ color: "var(--m-accent)" }}>
              PLATFORM
            </p>
            <h2 className="m-h2" style={{ marginTop: 14 }}>
              One system for the whole call lifecycle.
            </h2>
            <p className="m-lead" style={{ marginTop: 16, color: "var(--m-fg-2)" }}>
              From the first ring to the payout reconciliation, without stitching
              four vendors together.
            </p>
          </div>

          <div
            className="sm:grid-cols-2 lg:grid-cols-3 m-reveal-late"
            style={{
              marginTop: 56,
              display: "grid",
              gap: 1,
              background: "var(--m-line)",
              border: "1px solid var(--m-line)",
              borderRadius: "var(--m-r-lg)",
              overflow: "hidden",
            }}
          >
            {ITEMS.map((item) => (
              <div
                key={item.title}
                style={{ background: "var(--m-surface)", padding: 28 }}
              >
                {item.icon}
                <h3 className="m-h3" style={{ marginTop: 16 }}>
                  {item.title}
                </h3>
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: "var(--m-fg-2)",
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Capabilities;
