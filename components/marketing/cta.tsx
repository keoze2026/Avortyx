import Link from "next/link";

import { ROUTES } from "@/lib/constants";

export function Cta() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--m-bg-dark)",
        color: "var(--m-fg-d)",
      }}
    >
      <div aria-hidden className="m-wash" />
      <div aria-hidden className="m-dots" />

      <div className="m-section" style={{ position: "relative" }}>
        <div className="m-container m-reveal" style={{ textAlign: "center" }}>
          <h2
            className="m-h2"
            style={{ color: "var(--m-fg-d)", maxWidth: "16ch", margin: "0 auto" }}
          >
            Put every call where it&apos;s worth the most.
          </h2>

          <p
            className="m-lead"
            style={{
              marginTop: 18,
              color: "var(--m-fg-d2)",
              maxWidth: "50ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Start routing in an afternoon. No contracts, no minimums, no
            rip-and-replace.
          </p>

          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Link href={ROUTES.signup} className="m-btn m-btn-on-dark">
              Start free
            </Link>
            <a href="#contact" className="m-btn m-btn-ghost-dark">
              Talk to sales
            </a>
          </div>

          <p className="m-label" style={{ marginTop: 30, color: "var(--m-fg-d3)" }}>
            14-day trial · No card required · SOC 2 Type II
          </p>
        </div>
      </div>
    </section>
  );
}

export default Cta;
