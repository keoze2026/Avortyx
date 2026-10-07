/**
 * Normalized error surface for the API client.
 *
 * Every non-2xx response becomes an `ApiError`. Consumers can branch on
 *   - `status` for HTTP status (401, 404, 422, 429, 500…)
 *   - `code` for backend-supplied error code (when present)
 *   - `fieldErrors` for per-field validation errors (Django Ninja shape)
 *   - `message` for a user-displayable message (fallback: HTTP status text)
 *   - `friendlyMessage` for a guaranteed human-readable message safe to
 *     drop into a toast — strips HTML, hides server stack traces, and
 *     falls back to a clean per-status-code default.
 *
 * Django Ninja typically returns one of:
 *   { "detail": "..." }
 *   { "detail": [{ "loc": ["body","email"], "msg": "..." }, ...] }
 *   { "message": "...", "code": "..." }   (custom error handlers)
 */

export interface FieldError {
  field: string;
  message: string;
}

/** Heuristic — does the message look like an HTML page rather than a
 *  user-readable error string? Django's default 500 page starts with
 *  `<!doctype html>` or similar. */
function looksLikeHtml(s: string): boolean {
  const trimmed = s.trim().slice(0, 200).toLowerCase();
  return (
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html") ||
    /<\/?(?:html|head|body|title|p|h\d|div)\b/.test(trimmed)
  );
}

/** Heuristic — does the message look like a Python traceback or other
 *  backend stack output that we shouldn't show end users? */
function looksLikeTraceback(s: string): boolean {
  return (
    s.includes("Traceback (most recent call last)") ||
    s.includes("    at ") ||
    s.includes("File \"")
  );
}

/** Map an HTTP status to a clean, end-user-readable fallback message
 *  for cases where the backend's response body is unusable (HTML page,
 *  traceback, empty, or just unhelpful). */
function fallbackForStatus(status: number): string {
  if (status === 0) return "Couldn't reach the server. Check your connection and try again.";
  if (status === 400) return "Request couldn't be processed. Please double-check the values and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "This action conflicts with the current state. Please refresh and try again.";
  if (status === 422) return "Some fields are missing or invalid. Please review and try again.";
  if (status === 423) return "This is locked. Enter the reports PIN on the Reports page to view it.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  if (status >= 500 && status < 600) return "Something went wrong on our end. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: FieldError[];
  /** Raw response body, kept around for debugging. */
  body?: unknown;

  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    fieldErrors?: FieldError[];
    body?: unknown;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.fieldErrors = opts.fieldErrors;
    this.body = opts.body;
  }

  /** True for 401 / 403 — caller can decide to bounce to login. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** True for 5xx — caller can decide to retry / show "server error". */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * A message that is always safe to show to an end user via toast / inline
   * error. Strips HTML bodies, Python tracebacks, and overly-verbose
   * frameworks output. Falls back to a clean per-status-code default when
   * the raw message isn't usable.
   */
  get friendlyMessage(): string {
    const raw = (this.message ?? "").trim();
    // HTML page (e.g. Django's default 500 debug page) → never readable.
    if (!raw || looksLikeHtml(raw) || looksLikeTraceback(raw)) {
      return fallbackForStatus(this.status);
    }
    // Single long line with no spaces (e.g. base64 token, stack trace dump) →
    // unhelpful, fall back.
    if (raw.length > 240 && !raw.includes(" ")) {
      return fallbackForStatus(this.status);
    }
    // Otherwise the backend's message is at least plausibly readable.
    return raw;
  }
}

interface DjangoNinjaDetailItem {
  loc?: unknown[];
  msg?: string;
  message?: string;
}

/** Parse an error response body into an `ApiError`. Tolerant of shape variance. */
export function normalizeErrorBody(
  status: number,
  statusText: string,
  body: unknown,
): ApiError {
  // String body — assume the body IS the message.
  if (typeof body === "string" && body.length > 0) {
    return new ApiError({ status, message: body, body });
  }

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;

    // Django Ninja validation: detail is an array of {loc, msg}.
    if (Array.isArray(obj.detail)) {
      const items = obj.detail as DjangoNinjaDetailItem[];
      const fieldErrors: FieldError[] = items.map((it) => {
        const loc = Array.isArray(it.loc) ? it.loc : [];
        // Strip the leading 'body' / 'query' / 'path' kind.
        const field = loc
          .slice(1)
          .filter((p) => typeof p === "string" || typeof p === "number")
          .join(".");
        return {
          field: field || "_",
          message: it.msg ?? it.message ?? "Invalid",
        };
      });
      // Build a human-readable top-line message that prefixes the field name
      // so callers don't have to dig into fieldErrors to know what's wrong.
      // Multiple errors → "field1, field2: <first message>".
      const namedFields = fieldErrors
        .map((fe) => fe.field)
        .filter((f) => f && f !== "_");
      const firstMsg = fieldErrors[0]?.message ?? statusText;
      const message =
        namedFields.length > 0
          ? `${namedFields.join(", ")} — ${firstMsg}`
          : firstMsg;
      return new ApiError({
        status,
        message,
        fieldErrors,
        body,
      });
    }

    // Single-message detail: { detail: "..." }
    if (typeof obj.detail === "string") {
      return new ApiError({ status, message: obj.detail, body });
    }

    // Custom { message, code }
    if (typeof obj.message === "string") {
      return new ApiError({
        status,
        message: obj.message,
        code: typeof obj.code === "string" ? obj.code : undefined,
        body,
      });
    }
  }

  return new ApiError({ status, message: statusText || `HTTP ${status}`, body });
}

/**
 * Convenience for callers that just want a clean message from any caught
 * error — handles `ApiError`, plain `Error`, and unknown values uniformly.
 */
/**
 * The browser's own failure for "the request never completed": the connection
 * dropped, DNS failed, the device went offline, or a CORS/network layer refused
 * it before any server answered. It carries no server message, only text such
 * as "Failed to fetch".
 */
export function isNetworkFailure(e: unknown): boolean {
  if (e instanceof ApiError) return false;
  if (e instanceof TypeError) return true;
  return e instanceof Error && /^(failed to fetch|networkerror|load failed|network request failed)/i.test(e.message ?? "");
}

export function friendlyErrorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiError) return e.friendlyMessage;
  // Say what happened instead of printing the browser's "Failed to fetch".
  if (isNetworkFailure(e)) return "Couldn't reach the server. Check your internet connection and try again.";
  if (e instanceof Error) {
    const raw = e.message ?? "";
    if (!raw || looksLikeHtml(raw) || looksLikeTraceback(raw)) return fallback;
    return raw;
  }
  return fallback;
}