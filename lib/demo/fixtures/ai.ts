/**
 * AI Insights fixtures — daily briefing, recommendations, anomalies,
 * autopilot config. All wire-shape (snake_case).
 */

import { DEMO_BUYER, DEMO_CAMPAIGN, DEMO_PUBLISHER } from "./account";

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function seedAiBriefing() {
  return {
    headline: "Revenue is pacing 18% ahead of last week",
    summary:
      `${DEMO_CAMPAIGN.name} is converting 64% of connected calls. ${DEMO_BUYER.name} is answering 87% of routed calls; no-answer volume is concentrated between 14:00 and 16:00.`,
    generated_at: new Date(NOW).toISOString(),
    highlights: [
      { kind: "positive", label: DEMO_CAMPAIGN.name, value: "Conversion 61% → 64%", delta: 0.03 },
      { kind: "positive", label: DEMO_BUYER.name, value: "Accept rate 87%", delta: 0.87 },
      { kind: "warning", label: DEMO_PUBLISHER.name, value: "Duplicate callers up to 8%", delta: 0.08 },
      { kind: "negative", label: "14:00–16:00", value: "No-answer rate 21%", delta: -0.21 },
    ],
  };
}

export function seedRecommendations() {
  return [
    {
      id: "rec_demo_1",
      title: `Raise bid floor on ${DEMO_CAMPAIGN.name}`,
      summary:
        "Average winning bid is $1.18 versus your floor of $1.00. Lift the floor to $1.10 to capture an estimated $480/day in additional margin.",
      confidence: 0.86,
      category: "pricing",
      impact_estimate_usd: 480,
      before: { metric: "Avg margin / call", value: 0.15 },
      after: { metric: "Avg margin / call", value: 0.25 },
      created_at: new Date(NOW - 2 * HOUR).toISOString(),
      status: "open",
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: DEMO_CAMPAIGN.name,
    },
    {
      id: "rec_demo_2",
      title: `Add a second destination for ${DEMO_BUYER.name}`,
      summary:
        `${DEMO_BUYER.name} is answering on one number. A second destination with a 40/60 weight would cut the 14:00–16:00 no-answer rate by an estimated 9 points.`,
      confidence: 0.74,
      category: "routing",
      impact_estimate_usd: 320,
      before: { metric: "No-answer rate", value: 0.21 },
      after: { metric: "No-answer rate", value: 0.12 },
      created_at: new Date(NOW - 5 * HOUR).toISOString(),
      status: "open",
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: DEMO_CAMPAIGN.name,
    },
    {
      id: "rec_demo_3",
      title: "Block repeat callers for 24 hours",
      summary:
        `About 8% of ${DEMO_PUBLISHER.name}'s traffic is the same caller dialling again within the day. A 24-hour duplicate block would stop paying for those.`,
      confidence: 0.79,
      category: "risk",
      impact_estimate_usd: 410,
      before: { metric: "Duplicate rate", value: 0.08 },
      after: { metric: "Duplicate rate", value: 0.01 },
      created_at: new Date(NOW - 14 * HOUR).toISOString(),
      status: "open",
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: DEMO_CAMPAIGN.name,
    },
    {
      id: "rec_demo_5",
      title: "Tighten TCPA window from 90 → 30 days",
      summary:
        "Carrier complaints are trending up. A 30-day consent window would reduce risk while only excluding 2.1% of inbound.",
      confidence: 0.81,
      category: "compliance",
      impact_estimate_usd: 940,
      before: { metric: "Complaint rate", value: 0.014 },
      after: { metric: "Complaint rate", value: 0.006 },
      created_at: new Date(NOW - 1 * DAY).toISOString(),
      status: "open",
      campaign_id: null,
      campaign_name: null,
    },
  ];
}

export function seedAnomalies() {
  return [
    {
      id: "anom_demo_1",
      severity: "high",
      title: `Spike in no-answer calls — ${DEMO_BUYER.name}`,
      description: `No-answer rate jumped from 12% to 28% in the last hour on ${DEMO_BUYER.name}.`,
      detected_at: new Date(NOW - 18 * 60 * 1000).toISOString(),
      campaign_id: DEMO_CAMPAIGN.id,
      buyer_id: DEMO_BUYER.id,
      metric: "no_answer_rate",
      observed: 0.28,
      expected: 0.12,
    },
    {
      id: "anom_demo_2",
      severity: "medium",
      title: `Latency drift on ${DEMO_BUYER.name} endpoint`,
      description: "Average ping latency 412ms → 1,840ms over the last 30 minutes.",
      detected_at: new Date(NOW - 32 * 60 * 1000).toISOString(),
      campaign_id: DEMO_CAMPAIGN.id,
      buyer_id: DEMO_BUYER.id,
      metric: "endpoint_latency_ms",
      observed: 1_840,
      expected: 412,
    },
    {
      id: "anom_demo_3",
      severity: "low",
      title: `Off-hours surge — ${DEMO_CAMPAIGN.name}`,
      description: "Inbound at 02:00 ET is 4× the typical baseline.",
      detected_at: new Date(NOW - 2 * HOUR).toISOString(),
      campaign_id: DEMO_CAMPAIGN.id,
      buyer_id: null,
      metric: "calls_per_hour",
      observed: 42,
      expected: 10,
    },
  ];
}

export function seedAutopilotConfig() {
  return {
    enabled: false,
    mode: "advisory",
    auto_pause_on_anomaly: true,
    auto_adjust_bid_floor: false,
    auto_reroute_overflow: true,
    daily_change_budget_usd: 500,
    last_action_at: new Date(NOW - 6 * HOUR).toISOString(),
  };
}
