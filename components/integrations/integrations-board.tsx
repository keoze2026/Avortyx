"use client";

/**
 * IntegrationsBoard — a horizontal dual-listbox for connecting / disconnecting
 * apps. Left column lists available apps, right column lists connected apps.
 * The user multi-selects rows in either column and uses the >> / << buttons
 * in the middle to move them across.
 *
 * Each row shows a real brand icon (simpleicons.org CDN) instead of a plain
 * letter, plus the app name, description, and category. Per-column search
 * filters in real time. The "clean and not cluttered" target.
 */

import { useMemo, useState } from "react";
import { ChevronsLeft, ChevronsRight, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppIcon } from "./app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { INTEGRATION_CATEGORIES } from "@/lib/mock/integrations";
import type { IntegrationApp, IntegrationCategory } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { Can } from "@/components/shared/can";

const CATEGORY_LABEL: Record<IntegrationCategory, string> = Object.fromEntries(
  INTEGRATION_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<IntegrationCategory, string>;

interface IntegrationsBoardProps {
  apps: IntegrationApp[];
  /** Called when one or more apps move from Available → Connected. */
  onConnect: (ids: string[]) => void;
  /** Called when one or more apps move from Connected → Available. */
  onDisconnect: (ids: string[]) => void;
}

export function IntegrationsBoard({
  apps,
  onConnect,
  onDisconnect,
}: IntegrationsBoardProps) {
  const { t } = useTranslation();
  const available = useMemo(() => apps.filter((a) => !a.connected), [apps]);
  const connected = useMemo(() => apps.filter((a) => a.connected), [apps]);

  const [availQuery, setAvailQuery] = useState("");
  const [connQuery, setConnQuery] = useState("");
  const [availSelected, setAvailSelected] = useState<Set<string>>(new Set());
  const [connSelected, setConnSelected] = useState<Set<string>>(new Set());

  const filteredAvail = useMemo(
    () => filterApps(available, availQuery),
    [available, availQuery],
  );
  const filteredConn = useMemo(
    () => filterApps(connected, connQuery),
    [connected, connQuery],
  );

  const moveRight = () => {
    if (availSelected.size === 0) return;
    onConnect(Array.from(availSelected));
    toast.success(
      availSelected.size === 1
        ? t("toolsUI.integrations.board.toastConnectedOne")
        : t("toolsUI.integrations.board.toastConnectedMany").replace("{count}", String(availSelected.size)),
    );
    setAvailSelected(new Set());
  };

  const moveLeft = () => {
    if (connSelected.size === 0) return;
    onDisconnect(Array.from(connSelected));
    toast.success(
      connSelected.size === 1
        ? t("toolsUI.integrations.board.toastDisconnectedOne")
        : t("toolsUI.integrations.board.toastDisconnectedMany").replace("{count}", String(connSelected.size)),
    );
    setConnSelected(new Set());
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
      {/* ── Available (left) ─────────────────────────────────────────── */}
      <Column
        title={t("toolsUI.integrations.board.available")}
        accentClass="text-muted-foreground"
        count={available.length}
        selected={availSelected.size}
        query={availQuery}
        onQueryChange={setAvailQuery}
        apps={filteredAvail}
        selectedSet={availSelected}
        onSelectedChange={setAvailSelected}
        rowAccent="border-border"
        emptyLabel={t("toolsUI.integrations.board.emptyAvailable")}
      />

      {/* ── Transfer controls ────────────────────────────────────────── */}
      <div className="flex flex-row items-stretch justify-center gap-2 lg:flex-col lg:items-center lg:gap-3 lg:px-1 lg:py-12">
        <Can area="integrations" action="edit"><Button
          variant={availSelected.size > 0 ? "default" : "outline"}
          size="icon"
          className="h-10 w-10 lg:h-12 lg:w-12"
          aria-label={t("toolsUI.integrations.board.connectAria")}
          onClick={moveRight}
          disabled={availSelected.size === 0}
        >
          <ChevronsRight className="h-5 w-5" />
        </Button></Can>
        <Can area="integrations" action="delete"><Button
          variant={connSelected.size > 0 ? "default" : "outline"}
          size="icon"
          className="h-10 w-10 lg:h-12 lg:w-12"
          aria-label={t("toolsUI.integrations.board.disconnectAria")}
          onClick={moveLeft}
          disabled={connSelected.size === 0}
        >
          <ChevronsLeft className="h-5 w-5" />
        </Button></Can>
      </div>

      {/* ── Connected (right) ────────────────────────────────────────── */}
      <Column
        title={t("toolsUI.integrations.board.connected")}
        accentClass="text-[color:var(--success)]"
        count={connected.length}
        selected={connSelected.size}
        query={connQuery}
        onQueryChange={setConnQuery}
        apps={filteredConn}
        selectedSet={connSelected}
        onSelectedChange={setConnSelected}
        rowAccent="border-[color:var(--success)]/30"
        emptyLabel={t("toolsUI.integrations.board.emptyConnected")}
        liveDot
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

interface ColumnProps {
  title: string;
  accentClass: string;
  count: number;
  selected: number;
  query: string;
  onQueryChange: (v: string) => void;
  apps: IntegrationApp[];
  selectedSet: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  rowAccent: string;
  emptyLabel: string;
  /** Show a pulsing dot next to the count (used on the Connected column). */
  liveDot?: boolean;
}

function Column({
  title,
  accentClass,
  count,
  selected,
  query,
  onQueryChange,
  apps,
  selectedSet,
  onSelectedChange,
  rowAccent,
  emptyLabel,
  liveDot,
}: ColumnProps) {
  const { t } = useTranslation();
  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const toggleAll = () => {
    if (apps.length === 0) return;
    const allSelected = apps.every((a) => selectedSet.has(a.id));
    onSelectedChange(allSelected ? new Set() : new Set(apps.map((a) => a.id)));
  };

  const allChecked = apps.length > 0 && apps.every((a) => selectedSet.has(a.id));
  const partial =
    !allChecked && apps.some((a) => selectedSet.has(a.id));

  return (
    <Card className="flex h-full min-h-[28rem] flex-col overflow-hidden p-0">
      {/* Column header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold uppercase tracking-wider", accentClass)}>
            {title}
          </span>
          {liveDot && (
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        </div>
        {selected > 0 && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
            {t("toolsUI.integrations.board.selected").replace("{count}", String(selected))}
          </span>
        )}
      </div>

      {/* Search + select-all */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Checkbox
          checked={allChecked ? true : partial ? "indeterminate" : false}
          onCheckedChange={toggleAll}
          aria-label={t("toolsUI.integrations.board.selectAllAria").replace("{column}", title.toLowerCase())}
        />
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("toolsUI.integrations.board.searchPlaceholder").replace("{column}", title.toLowerCase())}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* List */}
      {apps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {apps.map((app) => {
            const checked = selectedSet.has(app.id);
            return (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => toggle(app.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                    checked && "bg-accent/8",
                    checked && rowAccent,
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(app.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t("toolsUI.integrations.board.selectAppAria").replace("{name}", app.name)}
                  />
                  <AppIcon app={app} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{app.name}</span>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] font-normal capitalize"
                      >
                        {CATEGORY_LABEL[app.category]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {app.description}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function filterApps(apps: IntegrationApp[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return apps;
  return apps.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q),
  );
}
