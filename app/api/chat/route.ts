import { NextResponse } from "next/server";

/**
 * Avortyx AI — the landing-page chat. Proxies to Groq's OpenAI-compatible
 * chat endpoint so the API key never reaches the browser.
 *
 * Models are tried in order: Groq retires models on a schedule (a retired
 * id answers 400 `model_decommissioned` / 404 `model_not_found`), and a
 * single hardcoded id meant the widget went dark the day its model was
 * pulled. Every failure is mapped to a specific, human-readable `error`
 * the widget shows verbatim, and the raw upstream body is logged so the
 * cause is visible in the server logs.
 */

const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

const SYSTEM_PROMPT = `You are Avortyx AI, the friendly assistant embedded on the Avortyx landing page.

Avortyx is a real-time pay-per-call routing and intelligence platform for
modern call networks. It combines:
  • Live call routing between publishers, buyers, and destinations
  • AI-driven optimization and anomaly detection
  • Daily news + live crypto market feeds inside one workspace
  • Marketplace for buying and selling inbound call inventory
  • Full reporting, KYC / Trust Engine, and integrations

Keep replies short (1–3 short paragraphs), warm, and helpful. If the user
asks about Avortyx specifically, point them toward getting started or
booking a demo. Avortyx has no free plan — never promise free calls or a
free tier. If they want to talk to a human, mention that Maya (sales),
Jordan (solutions), or Lina (customer success) are available in this chat —
they can pick a person and the team will jump in here.

NEVER mention any other brand name. NEVER refer to Avortyx as a "lead
generation agency" or "web development agency" — it is a call-tracking and
routing platform. Otherwise answer general questions naturally.`;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface GroqErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

/** True when the upstream error means "this model id is gone" — try the next. */
function isModelUnavailable(status: number, body: GroqErrorBody): boolean {
  if (status === 404) return true;
  const code = body.error?.code ?? "";
  const msg = (body.error?.message ?? "").toLowerCase();
  return (
    code === "model_decommissioned" ||
    code === "model_not_found" ||
    code === "model_not_active" ||
    (status === 400 && msg.includes("model"))
  );
}

/** Map an upstream failure to the sentence the widget shows the visitor. */
function describeUpstream(status: number, body: GroqErrorBody): string {
  const code = body.error?.code ?? "";
  if (status === 401 || code === "invalid_api_key") {
    return "The AI service rejected our API key. Please contact the team.";
  }
  if (status === 403) return "The AI service refused the request.";
  if (status === 429 || code === "rate_limit_exceeded") {
    return "The assistant is busy right now — please try again in a moment.";
  }
  if (status >= 500) return "The AI service is temporarily unavailable. Please try again shortly.";
  return body.error?.message
    ? `The AI service returned an error: ${body.error.message}`
    : `The AI service returned an error (HTTP ${status}).`;
}

async function parseError(res: Response): Promise<{ body: GroqErrorBody; raw: string }> {
  const raw = await res.text();
  try {
    return { body: JSON.parse(raw) as GroqErrorBody, raw };
  } catch {
    return { body: {}, raw };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    console.error("[api/chat] GROQ_API_KEY is not set");
    return NextResponse.json(
      { error: "The assistant isn't configured on this server yet (missing GROQ_API_KEY)." },
      { status: 500 },
    );
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m): m is IncomingMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages." }, { status: 400 });
  }

  let lastStatus = 502;
  let lastError = "The AI service is unreachable.";

  for (const model of MODELS) {
    let upstream: Response;
    try {
      upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          temperature: 0.7,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-20)],
        }),
      });
    } catch (err) {
      console.error(`[api/chat] network error reaching Groq (${model}):`, err);
      return NextResponse.json(
        { error: "Couldn't reach the AI service. Please check the server's network access." },
        { status: 502 },
      );
    }

    if (upstream.ok) {
      const data = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) {
        console.error(`[api/chat] empty completion from ${model}`);
        return NextResponse.json({ error: "The assistant returned an empty reply." }, { status: 502 });
      }
      return NextResponse.json({ reply, model });
    }

    const { body: errBody, raw } = await parseError(upstream);
    console.error(`[api/chat] Groq ${upstream.status} for ${model}: ${raw.slice(0, 500)}`);

    if (isModelUnavailable(upstream.status, errBody)) {
      // Retired / unknown model id — fall through to the next candidate.
      lastStatus = 502;
      lastError = "None of the configured AI models are available right now.";
      continue;
    }

    // Any other failure (bad key, rate limit, outage) won't be fixed by a
    // different model — report it as it is.
    return NextResponse.json(
      { error: describeUpstream(upstream.status, errBody) },
      { status: upstream.status === 429 ? 429 : 502 },
    );
  }

  return NextResponse.json({ error: lastError }, { status: lastStatus });
}
