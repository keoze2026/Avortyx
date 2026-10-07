"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/format";
import {
  type ActivityCategory,
  type ActivityChange,
  type ActivityKind,
  type WorkspaceActivityEvent,
} from "@/lib/mock/workspace-activity";
import { useWorkspaceMetaStore } from "@/lib/store/workspace-meta-store";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

type Filter = "all" | ActivityCategory;

/** `labelKey` for filters that already have translations; `label` for new ones. */
const FILTERS: Array<{ id: Filter; labelKey?: string; label?: string }> = [
  { id: "all", labelKey: "workspaceUI.activity.filter.all" },
  { id: "record", label: "Changes" },
  { id: "member", labelKey: "workspaceUI.activity.filter.member" },
  { id: "role", labelKey: "workspaceUI.activity.filter.role" },
  { id: "settings", labelKey: "workspaceUI.activity.filter.settings" },
  { id: "account", label: "Sign-ins & security" },
];

/** Translation keys for the member / role / workspace verbs. */
const VERB_KEYS: Partial<Record<ActivityKind, string>> = {
  "member.invited": "workspaceUI.activity.verbs.invited",
  "member.joined": "workspaceUI.activity.verbs.joined",
  "member.removed": "workspaceUI.activity.verbs.removed",
  "member.suspended": "workspaceUI.activity.verbs.suspended",
  "member.reactivated": "workspaceUI.activity.verbs.reactivated",
  "member.role-changed": "workspaceUI.activity.verbs.roleChanged",
  "role.permissions-updated": "workspaceUI.activity.verbs.permissionsUpdated",
  "workspace.renamed": "workspaceUI.activity.verbs.renamed",
  "workspace.timezone-changed": "workspaceUI.activity.verbs.timezoneChanged",
};

/** Wording when the server sent no label of its own. */
const DEFAULT_VERBS: Partial<Record<ActivityKind, string>> = {
  "record.created": "Created",
  "record.updated": "Updated",
  "record.deleted": "Deleted",
  "account.login": "Signed in",
  "account.logout": "Signed out",
  "account.security": "Changed security settings",
  "account.other": "Changed",
};

/** Per-kind icon shown next to the action verb. */
const KIND_ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  "member.invited": UserPlus,
  "member.joined": UserPlus,
  "member.removed": UserMinus,
  "member.suspended": UserMinus,
  "member.reactivated": UserPlus,
  "member.role-changed": UserCog,
  "role.permissions-updated": ShieldCheck,
  "workspace.renamed": Settings2,
  "workspace.timezone-changed": Settings2,
  "record.created": PlusCircle,
  "record.updated": Pencil,
  "record.deleted": Trash2,
  "account.login": LogIn,
  "account.logout": LogOut,
  "account.security": KeyRound,
  "account.other": UserCog,
};

/** Tint the icon so categories are visually distinct without color-coding everything. */
const CATEGORY_TINT: Record<ActivityCategory, string> = {
  member: "text-sky-500 dark:text-sky-400",
  role: "text-violet-500 dark:text-violet-400",
  settings: "text-amber-500 dark:text-amber-400",
  record: "text-emerald-500 dark:text-emerald-400",
  account: "text-slate-500 dark:text-slate-400",
};

/** How the server names a record type -> words for the feed. */
const TYPE_LABELS: Record<string, string> = {
  buyer: "buyer",
  destination: "destination",
  publisher: "publisher",
  campaign: "campaign",
  campaign_destination: "campaign destination",
  routing_rule: "routing rule",
  phone_number: "phone number",
  notification_rule: "notification rule",
  user: "user",
};

export function typeLabel(type?: string): string {
  if (!type) return "";
  return TYPE_LABELS[type] ?? type.replace(/[_-]+/g, " ").toLowerCase();
}

/** "max_calls_daily" / "maxCallsDaily" -> "Max calls daily". */
export function fieldLabel(field: string): string {
  const spaced = field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : field;
}

function absoluteTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** The verb for a row: translated for member / role / workspace events,
 *  otherwise the server's own label ("Updated", "Login", ...). */
function useVerb() {
  const { t } = useTranslation();
  return React.useCallback(
    (e: WorkspaceActivityEvent): string => {
      const key = VERB_KEYS[e.kind];
      if (key) return t(key);
      return e.actionLabel || DEFAULT_VERBS[e.kind] || "Changed";
    },
    [t],
  );
}

export function WorkspaceActivityLog() {
  const { t } = useTranslation();
  const verbOf = useVerb();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = React.useState(false);

  // Live activity log from GET /api/accounts/workspace/activity, mapped to
  // the FE event shape via the workspace-meta store.
  const events = useWorkspaceMetaStore((s) => s.activity);
  const refreshActivity = useWorkspaceMetaStore((s) => s.refreshActivity);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshActivity();
    } finally {
      setRefreshing(false);
    }
  }, [refreshActivity]);

  // The feed is otherwise loaded only once, at sign-in - so an edit made a
  // minute ago would not be here. Re-read it whenever the tab is opened.
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(0);
  }, [query, filter, pageSize]);

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      const haystack = [
        e.actor.name,
        e.target ?? "",
        verbOf(e),
        typeLabel(e.targetType),
        ...(e.changes ?? []).flatMap((c) => [fieldLabel(c.field), c.old ?? "", c.new ?? ""]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [events, filter, query, verbOf]);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-col gap-3 border-b border-border bg-secondary/20 px-4 py-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">{t("workspaceUI.activity.title")}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("workspaceUI.activity.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("workspaceUI.activity.searchPlaceholder")}
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <div className="inline-flex flex-wrap items-center rounded-md border border-border bg-card p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  filter === f.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.labelKey ? t(f.labelKey) : f.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh activity"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-left">{t("workspaceUI.activity.columnActor")}</TableHead>
                <TableHead className="text-left">{t("workspaceUI.activity.columnAction")}</TableHead>
                <TableHead className="text-left">{t("workspaceUI.activity.columnDetail")}</TableHead>
                <TableHead className="pr-4">{t("workspaceUI.activity.columnWhen")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">
                    {t("workspaceUI.activity.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered
                  .slice(page * pageSize, page * pageSize + pageSize)
                  .map((e) => (
                    <ActivityRow
                      key={e.id}
                      event={e}
                      verb={verbOf(e)}
                      open={expanded.has(e.id)}
                      onToggle={() => toggle(e.id)}
                    />
                  ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border px-4 py-2.5">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  event,
  verb,
  open,
  onToggle,
}: {
  event: WorkspaceActivityEvent;
  verb: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICONS[event.kind] ?? Pencil;
  const changes = event.changes ?? [];
  const type = typeLabel(event.targetType);

  return (
    <>
      <TableRow className={cn(open && "border-b-0 bg-secondary/20")}>
        <TableCell className="pl-4 text-left">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-background shadow"
              style={{
                background: `linear-gradient(135deg, ${event.actor.avatar[0]}, ${event.actor.avatar[1]})`,
              }}
            >
              {event.actor.initials}
            </span>
            <span className="truncate text-sm font-medium">{event.actor.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-left">
          <div className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", CATEGORY_TINT[event.category])} />
            <span className="text-muted-foreground">
              {verb}
              {type && event.category === "record" ? ` ${type}` : ""}
            </span>
            {event.target && <span className="font-medium text-foreground">{event.target}</span>}
          </div>
        </TableCell>
        <TableCell className="text-left text-[12px] text-muted-foreground">
          {changes.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/60"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {changes.length === 1 ? "1 field changed" : `${changes.length} fields changed`}
            </button>
          ) : event.rolePair ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px]">
                {t(`workspaceUI.members.role.${event.rolePair.from}`)}
              </span>
              <span aria-hidden>→</span>
              <span className="rounded border border-accent/45 bg-accent/12 px-1.5 py-0.5 text-[10px] text-foreground">
                {t(`workspaceUI.members.role.${event.rolePair.to}`)}
              </span>
            </span>
          ) : (
            event.detail ?? "—"
          )}
        </TableCell>
        <TableCell className="pr-4 tabular-nums" title={absoluteTime(event.timestamp)}>
          {formatRelativeTime(event.timestamp)}
        </TableCell>
      </TableRow>
      {open && changes.length > 0 && (
        <TableRow className="bg-secondary/20 hover:bg-secondary/20">
          <TableCell colSpan={4} className="px-4 pb-3 pt-0">
            <ChangesTable changes={changes} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The FIELD / OLD / NEW table under an edited row. */
function ChangesTable({ changes }: { changes: ActivityChange[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="w-1/4 px-3 py-1.5 font-semibold">Field</th>
            <th className="w-[37.5%] px-3 py-1.5 font-semibold">Old</th>
            <th className="w-[37.5%] px-3 py-1.5 font-semibold">New</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.field} className="border-b border-border/60 last:border-b-0 align-top">
              <td className="px-3 py-1.5 font-medium text-foreground">{fieldLabel(c.field)}</td>
              <td className="px-3 py-1.5">
                <Value value={c.old} tone="old" />
              </td>
              <td className="px-3 py-1.5">
                <Value value={c.new} tone="new" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Value({ value, tone }: { value: string | null; tone: "old" | "new" }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      title={value.length > 160 ? value : undefined}
      className={cn(
        "whitespace-pre-wrap break-words font-mono text-[11px]",
        tone === "old" ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
      )}
    >
      {value.length > 160 ? `${value.slice(0, 160)}…` : value}
    </span>
  );
}