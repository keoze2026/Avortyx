import type { ReactNode } from "react";

const FEATURES = [
  {
    title: "REST + webhooks",
    body: "Signed, retried, idempotent delivery.",
  },
  {
    title: "Event stream",
    body: "Subscribe to call state over WebSocket.",
  },
  {
    title: "Typed SDKs",
    body: "Node, Python and Go, generated from the spec.",
  },
  {
    title: "Sandbox",
    body: "Simulate traffic without spending a cent.",
  },
];

function Punc({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--m-fg-d3)" }}>{children}</span>;
}

function Key({ name }: { name: string }) {
  return (
    <>
      <Punc>&quot;</Punc>
      <span style={{ color: "var(--m-fg-d2)" }}>{name}</span>
      <Punc>&quot;: </Punc>
    </>
  );
}

function Str({ value, last }: { value: string; last?: boolean }) {
  return (
    <>
      <span style={{ color: "var(--m-accent-d)" }}>&quot;{value}&quot;</span>
      {last ? null : <Punc>,</Punc>}
    </>
  );
}

function Num({ value, last }: { value: string; last?: boolean }) {
  return (
    <>
      <span style={{ color: "#F2F5F3" }}>{value}</span>
      {last ? null : <Punc>,</Punc>}
    </>
  );
}

function Comment({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: "var(--m-fg-d3)", fontStyle: "italic" }}>{children}</span>
  );
}

export function Developers() {
  return (
    <section
      id="developers"
      style={{ background: "var(--m-bg)", borderTop: "1px solid var(--m-line)" }}
    >
      <div className="m-section">
        <div className="m-container">
          <div
            className="lg:grid-cols-2"
            style={{ display: "grid", gap: 72, alignItems: "center" }}
          >
            {/* Copy — second column on desktop, first on mobile */}
            <div className="lg:order-last m-reveal">
              <p className="m-label" style={{ color: "var(--m-accent)" }}>
                DEVELOPERS
              </p>
              <h2 className="m-h2" style={{ marginTop: 14 }}>
                A routing engine you can call from anywhere.
              </h2>
              <p
                className="m-lead"
                style={{
                  marginTop: 16,
                  color: "var(--m-fg-2)",
                  maxWidth: "44ch",
                }}
              >
                Every action in the console is an API call. Route a number, adjust a
                buyer cap, stream call events — the same primitives the product is
                built on.
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

              <a href="#api" className="m-link" style={{ marginTop: 26 }}>
                Explore the API <span aria-hidden>→</span>
              </a>
            </div>

            {/* Code panel */}
            <div
              className="lg:order-first m-reveal-object"
              style={{
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
                  gap: 7,
                  padding: "11px 14px",
                  borderBottom: "1px solid var(--m-line-d)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                  }}
                />
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: "var(--m-mono)",
                    fontSize: 11.5,
                    color: "var(--m-fg-d3)",
                  }}
                >
                  POST /v1/calls/route
                </span>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 18,
                  fontFamily: "var(--m-mono)",
                  fontSize: 12.5,
                  lineHeight: 1.75,
                  color: "var(--m-fg-d2)",
                  overflowX: "auto",
                }}
              >
                <code>
                  <Punc>{"{"}</Punc>
                  {"\n  "}
                  <Key name="from" />
                  <Str value="+18885550147" />
                  {"\n  "}
                  <Key name="campaign" />
                  <Str value="health-ca" />
                  {"\n  "}
                  <Key name="intent" />
                  <Num value="0.94" last />
                  {"\n"}
                  <Punc>{"}"}</Punc>
                  {"\n\n"}
                  <Comment>{"// 200 OK"}</Comment>
                  {"\n"}
                  <Punc>{"{"}</Punc>
                  {"\n  "}
                  <Key name="buyer" />
                  <Str value="apex-insurance" />
                  {"\n  "}
                  <Key name="payout" />
                  <Str value="22.50" />
                  {"\n  "}
                  <Key name="decided_in_ms" />
                  <Num value="310" last />
                  {"\n"}
                  <Punc>{"}"}</Punc>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Developers;
