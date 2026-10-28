/**
 * TFN Check (backend CH-213): is each of these numbers working, right now.
 *
 *   POST   /api/numbers/check/              portal check (optionally queues test calls)
 *   POST   /api/numbers/check/test          one test call for one number (CH-239)
 *   GET    /api/numbers/check/test/{id}     that test call, step by step
 *   GET    /api/numbers/check/today         every test call since 12 AM Eastern (CH-341)
 *   GET    /api/numbers/check/links         share links
 *   POST   /api/numbers/check/links         make a share link
 *   DELETE /api/numbers/check/links/{id}    cancel a share link
 *   GET    /api/public/tfn-check/{token}    public: the link's name
 *   POST   /api/public/tfn-check/{token}    public: check (no login)
 */
import { http } from "@/lib/api/http";

export type TfnStatus =
  | "working"
  | "active"
  | "not_working"
  | "not_in_service"
  | "paused"
  | "expired"
  | "not_found";

/** Best news first: the order of the summary chips. */
export const TFN_STATUS_ORDER: TfnStatus[] = [
  "working",
  "active",
  "not_working",
  "not_in_service",
  "paused",
  "expired",
  "not_found",
];

export interface TfnCheckResult {
  number: string;
  status: TfnStatus;
  label: string;
  detail: string;
  lastCallAt: string | null;
  lastTestAt: string | null;
  lastTestPassed: boolean | null;
  /** Test calls since 12 AM Eastern (CH-341); absent for a number that isn't ours. */
  testsToday?: number;
  testsTodayPassed?: number;
  testsTodayFailed?: number;
}

/** Today's test history on TFN Check (CH-341): kept until 12 AM Eastern. */
export interface TfnTestHistoryRow extends TfnTestCall {
  trigger: string;
  by: string;
  createdAt: string;
}

export interface TfnTodayNumber {
  number: string;
  tests: number;
  passed: number;
  failed: number;
  lastAt: string;
  lastStatus: TfnTestCall["status"];
}

export interface TfnTestsToday {
  since: string;
  resetsAt: string;
  total: number;
  numbers: TfnTodayNumber[];
  tests: TfnTestHistoryRow[];
}

export interface TfnCheckResponse {
  checkedAt: string;
  results: TfnCheckResult[];
  summary: Record<TfnStatus, number>;
  invalid: string[];
  truncated: boolean;
  maxNumbers: number;
  /** Portal only: test calls queued by this check. */
  testsQueued?: number;
}

/** One step of a test call, as it happened (CH-239). */
export interface TfnTestStep {
  key: "placed" | "reached" | "number" | "campaign" | "routing" | string;
  ok: boolean;
  text: string;
  at: string;
}

/** A test call started inside our own phone system: nothing goes to the
 *  carrier, no buyer is rung, nothing is billed (CH-239). */
export interface TfnTestCall {
  id: string;
  number: string;
  status: "queued" | "running" | "passed" | "failed";
  mode: string;
  steps: TfnTestStep[];
  startedAt: string | null;
  finishedAt: string | null;
}

interface TestWire {
  id: string;
  number: string;
  status: TfnTestCall["status"];
  mode: string;
  steps?: TfnTestStep[];
  started_at: string | null;
  finished_at: string | null;
}

function testFromWire(w: TestWire): TfnTestCall {
  return {
    id: w.id,
    number: w.number,
    status: w.status,
    mode: w.mode,
    steps: w.steps ?? [],
    startedAt: w.started_at,
    finishedAt: w.finished_at,
  };
}

export interface TfnCheckLink {
  id: string;
  name: string;
  token: string;
  url: string;
  publisherId: string | null;
  publisherName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  revokedAt: string | null;
  active: boolean;
}

interface Wire {
  checked_at: string;
  results: Array<{
    number: string;
    status: TfnStatus;
    label: string;
    detail: string;
    last_call_at: string | null;
    last_test_at: string | null;
    last_test_passed: boolean | null;
    tests_today?: number;
    tests_today_passed?: number;
    tests_today_failed?: number;
  }>;
  summary: Record<TfnStatus, number>;
  invalid: string[];
  truncated: boolean;
  max_numbers: number;
  tests_queued?: number;
}

/** Read raw so the summary keeps the status codes as its keys. */
function fromWire(w: Wire): TfnCheckResponse {
  return {
    checkedAt: w.checked_at,
    results: (w.results ?? []).map((r) => ({
      number: r.number,
      status: r.status,
      label: r.label,
      detail: r.detail,
      lastCallAt: r.last_call_at,
      lastTestAt: r.last_test_at,
      lastTestPassed: r.last_test_passed,
      testsToday: r.tests_today,
      testsTodayPassed: r.tests_today_passed,
      testsTodayFailed: r.tests_today_failed,
    })),
    summary: w.summary ?? ({} as Record<TfnStatus, number>),
    invalid: w.invalid ?? [],
    truncated: Boolean(w.truncated),
    maxNumbers: w.max_numbers ?? 200,
    testsQueued: w.tests_queued,
  };
}

export const tfnCheckService = {
  async check(numbers: string, test = false): Promise<TfnCheckResponse> {
    const w = await http.post<Wire>("/api/numbers/check/", {
      body: { numbers, test },
      rawResponse: true,
    });
    return fromWire(w);
  },

  async startTestCall(number: string): Promise<TfnTestCall> {
    const w = await http.post<TestWire>("/api/numbers/check/test", {
      body: { number },
      rawResponse: true,
    });
    return testFromWire(w);
  },

  async getTestCall(id: string): Promise<TfnTestCall> {
    const w = await http.get<TestWire>(`/api/numbers/check/test/${encodeURIComponent(id)}`, {
      rawResponse: true,
    });
    return testFromWire(w);
  },

  async testsToday(): Promise<TfnTestsToday> {
    const w = await http.get<{
      since: string;
      resets_at: string;
      total: number;
      numbers: Array<{ number: string; tests: number; passed: number; failed: number; last_at: string; last_status: TfnTestCall["status"] }>;
      tests: Array<TestWire & { trigger: string; by: string; created_at: string }>;
    }>("/api/numbers/check/today", { rawResponse: true });
    return {
      since: w.since,
      resetsAt: w.resets_at,
      total: w.total ?? 0,
      numbers: (w.numbers ?? []).map((n) => ({
        number: n.number,
        tests: n.tests,
        passed: n.passed,
        failed: n.failed,
        lastAt: n.last_at,
        lastStatus: n.last_status,
      })),
      tests: (w.tests ?? []).map((t) => ({ ...testFromWire(t), trigger: t.trigger, by: t.by, createdAt: t.created_at })),
    };
  },

  async listLinks(): Promise<TfnCheckLink[]> {
    return http.get<TfnCheckLink[]>("/api/numbers/check/links");
  },

  async createLink(input: { name: string; publisherId?: string | null }): Promise<TfnCheckLink> {
    return http.post<TfnCheckLink>("/api/numbers/check/links", {
      body: { name: input.name, publisherId: input.publisherId || null },
    });
  },

  async revokeLink(id: string): Promise<TfnCheckLink> {
    return http.delete<TfnCheckLink>(`/api/numbers/check/links/${id}`);
  },

  async publicInfo(token: string): Promise<{ name: string; maxNumbers: number }> {
    return http.get<{ name: string; maxNumbers: number }>(
      `/api/public/tfn-check/${encodeURIComponent(token)}`,
      { anonymous: true },
    );
  },

  async publicCheck(token: string, numbers: string): Promise<TfnCheckResponse> {
    const w = await http.post<Wire>(`/api/public/tfn-check/${encodeURIComponent(token)}`, {
      body: { numbers },
      anonymous: true,
      rawResponse: true,
    });
    return fromWire(w);
  },
};
