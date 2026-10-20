"use client";

/**
 * BLOCKED NUMBERS on a publisher's Edit page.
 *
 * A caller added here is rejected on this publisher's tracking numbers only
 * (shown as a missed call, "Callerid Blocked"). The same caller still goes
 * through on every other publisher. Saved on the server at once, no Save
 * button. The workspace-wide list (sidebar > Blocked Numbers) is separate.
 */

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";
import { analyticsService } from "@/lib/api/services/analytics.service";
import { spamService, type SpamEntry } from "@/lib/api/services/spam.service";
import { numberMatches } from "@/lib/call-search";

const digitsOf = (v: string) => v.replace(/\D/g, "");
/** "6283585660" / "+16283585660" -> "+6283585660" / "+16283585660" for display. */
const shown = (n: string) => `+${digitsOf(n)}`;
/** Two spellings of one number ("1" + 10 digits, or just the 10) share a key. */
const keyOf = (n: string) => digitsOf(n).slice(-10);

interface Caller {
  key: string;
  number: string;
  count: number;
  last: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const SUGGESTIONS_SHOWN = 8;

export function PublisherBlockedNumbers({ publisherId }: { publisherId: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = React.useState<SpamEntry[] | null>(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Lookup: who has actually called this publisher's numbers lately. Loaded
  // the first time the box is used, from the same call log Reports reads.
  const [callers, setCallers] = React.useState<Caller[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const loadingCallers = React.useRef(false);

  const loadCallers = React.useCallback(async () => {
    if (loadingCallers.current || callers) return;
    loadingCallers.current = true;
    try {
      const now = new Date();
      const page = await analyticsService.calls({
        publisherId,
        dateFrom: ymd(new Date(now.getTime() - 29 * 86_400_000)),
        dateTo: ymd(now),
        pageSize: 500,
      });
      const byKey = new Map<string, Caller>();
      for (const c of page.items) {
        const number = c.callerNumber;
        const key = keyOf(number ?? "");
        // Anonymous / private callers have no number to block.
        if (digitsOf(number ?? "").length < 7) continue;
        const row = byKey.get(key);
        if (row) {
          row.count += 1;
          row.last = Math.max(row.last, c.startedAt ?? 0);
        } else {
          byKey.set(key, { key, number, count: 1, last: c.startedAt ?? 0 });
        }
      }
      setCallers([...byKey.values()].sort((a, b) => b.count - a.count || b.last - a.last));
    } catch {
      // Typing a number still works; the lookup tries again on the next click.
      setCallers(null);
    } finally {
      loadingCallers.current = false;
    }
  }, [publisherId, callers]);

  const blockedKeys = React.useMemo(() => new Set((entries ?? []).map((e) => keyOf(e.number))), [entries]);
  const suggestions = React.useMemo(() => {
    if (!callers) return [];
    const q = digitsOf(value);
    return callers
      .filter((c) => !blockedKeys.has(c.key))
      .filter((c) => (q.length === 0 ? true : q.length < 4 ? digitsOf(c.number).includes(q) : numberMatches(c.number, q)))
      .slice(0, SUGGESTIONS_SHOWN);
  }, [callers, blockedKeys, value]);

  const load = React.useCallback(async () => {
    try {
      const page = await spamService.listBlacklist({ publisherId, pageSize: 500 });
      setEntries(page.items.filter((e) => e.isActive));
    } catch {
      setEntries([]);
      toast.error(t("publisherBlocks.loadFailed"));
    }
  }, [publisherId, t]);

  React.useEffect(() => {
    setEntries(null);
    void load();
  }, [load]);

  const add = async () => {
    const digits = digitsOf(value);
    // A full number is at least 10 digits (US) - shorter is a typo.
    if (digits.length < 10) {
      toast.error(t("publisherBlocks.invalid"));
      return;
    }
    if ((entries ?? []).some((e) => digitsOf(e.number).endsWith(digits.slice(-10)))) {
      toast.error(t("publisherBlocks.already").replace("{number}", shown(digits)));
      return;
    }
    setBusy(true);
    try {
      const created = await spamService.createBlacklist({ number: digits, reason: "manual", publisherId });
      setEntries((prev) => [created, ...(prev ?? [])]);
      setValue("");
      toast.success(t("publisherBlocks.blocked").replace("{number}", shown(created.number || digits)));
    } catch {
      toast.error(t("publisherBlocks.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: SpamEntry) => {
    try {
      await spamService.deleteBlacklist(entry.id);
      setEntries((prev) => (prev ?? []).filter((e) => e.id !== entry.id));
      toast.success(t("publisherBlocks.unblocked").replace("{number}", shown(entry.number)));
    } catch {
      toast.error(t("publisherBlocks.saveFailed"));
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background/30">
      <header className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {t("publisherBlocks.title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("publisherBlocks.description")}</p>
        </div>
        {entries && entries.length > 0 && (
          <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
            {t("publisherBlocks.count").replace("{count}", String(entries.length))}
          </span>
        )}
      </header>

      <form
        className="flex items-center gap-2 border-t border-border px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            void loadCallers();
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={t("publisherBlocks.placeholder")}
          inputMode="tel"
          autoComplete="off"
          className="h-8 max-w-xs text-xs"
        />
        <Button type="submit" size="sm" disabled={busy || !digitsOf(value)}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("publisherBlocks.block")}
        </Button>
      </form>

      {open && (
        <div className="border-t border-border bg-secondary/20">
          <div className="px-4 pt-2.5 text-[11px] text-muted-foreground">{t("publisherBlocks.recentTitle")}</div>
          {callers === null ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("publisherBlocks.recentLoading")}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">{t("publisherBlocks.recentEmpty")}</div>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    // mouse down (not click) so the box keeps focus until the pick lands
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setValue(shown(c.number));
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="font-mono text-sm">{shown(c.number)}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.count === 1
                        ? t("publisherBlocks.recentCall")
                        : t("publisherBlocks.recentCalls").replace("{count}", String(c.count))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {entries === null ? (
        <div className="flex items-center gap-2 border-t border-border px-4 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("publisherBlocks.loading")}
        </div>
      ) : entries.length === 0 ? (
        <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
          {t("publisherBlocks.empty")}
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="font-mono text-sm">{shown(e.number)}</span>
              <button
                type="button"
                onClick={() => void remove(e)}
                aria-label={t("publisherBlocks.removeAria").replace("{number}", shown(e.number))}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
