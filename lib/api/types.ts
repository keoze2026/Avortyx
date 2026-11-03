/**
 * Shared API client types.
 */

/** Standard list-endpoint envelope as confirmed by the backend dev.
 *  Backend wire shape is { items, total, page, page_size } — after the
 *  case adapter it becomes { items, total, page, pageSize }. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query params accepted by every list endpoint. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** HTTP methods we actually use. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Per-request options the http wrapper accepts. */
export interface RequestOptions {
  /** Query-string params. camelCase keys are converted to snake_case on the wire. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Request body. camelCase keys are converted to snake_case on the wire. */
  body?: unknown;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** Skip JWT injection (used for the login/refresh endpoints themselves). */
  anonymous?: boolean;
  /** Skip case conversion on the request body (e.g. uploading a raw FormData). */
  rawBody?: boolean;
  /** Skip case conversion on the response (e.g. for endpoints returning files). */
  rawResponse?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** CH-482: give up after this many ms with a "took too long" error, so no
   *  screen waits forever. Default 15 s for reads, 30 s for changes, none for
   *  file downloads (rawResponse). 0 = no limit. */
  timeoutMs?: number;
}
