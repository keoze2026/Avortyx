/**
 * TFN Check (backend CH-213): is each of these numbers working, right now.
 *
 *   POST   /api/numbers/check/              portal check (optionally queues test calls)
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
