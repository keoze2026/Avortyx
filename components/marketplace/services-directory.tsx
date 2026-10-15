"use client";

/**
 * Marketplace → Services: a directory of partner websites (ad networks,
 * hosting, proxies...) for our users - the same idea as a wallet's
 * "Marketplace": "All services" / "My services", search, a section per
 * category with its count ("Ad networks (55)"), logo cards with a short
 * description and "More details", 9 cards per category until "Show all".
 *
 * Everyone can browse and star services into "My services". Platform staff /
 * superusers also get Add service, Categories, and edit / delete on each card.
 * Every text is in the chosen language; category names and descriptions use
 * the translations staff entered (English when none).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Globe,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  CategoriesDialog,
  ConfirmDelete,
  ServiceFormDialog,
} from "@/components/marketplace/directory-dialogs";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  marketplaceDirectoryService,
  pickTranslation,
  type Directory,
  type MarketplaceService,
  type ServiceCategory,
} from "@/lib/api/services/marketplace-directory.service";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/** Three rows of three before "Show all", like the reference. */
const PREVIEW_COUNT = 9;

type View = "all" | "mine";

export function ServicesDirectory() {
  const { t, locale } = useTranslation();
  const staffFlag = useAuthStore((s) => s.user?.isSuperuser === true || s.user?.isStaff === true);
  // The login's staff flags don't reach the portal yet (see isStaff in the
  // service), so the server is asked directly when they are missing.
  const [serverStaff, setServerStaff] = useState(false);

  const [data, setData] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [details, setDetails] = useState<MarketplaceService | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceService | null>(null);
  const [formCategory, setFormCategory] = useState<string | undefined>();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MarketplaceService | null>(null);

  // Staff controls: from the login's flags, or confirmed by the server.
  const canManage = staffFlag || serverStaff;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await marketplaceDirectoryService.load();
      setData(loaded);
      // Hidden services only ever come back to staff, so seeing one settles it.
      if (!staffFlag) {
        if (loaded.services.some((s) => !s.isActive)) setServerStaff(true);
        else if (!loaded.local) setServerStaff(await marketplaceDirectoryService.isStaff());
      }
    } catch (e) {
      setError(friendlyErrorMessage(e, t("marketplace.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t, staffFlag]);

  useEffect(() => {
    void load();
    // Load once; `t` changing language must not reload the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catName = useCallback(
    (c: ServiceCategory | undefined) => (c ? pickTranslation(c.name, c.nameTranslations, locale) : ""),
    [locale],
  );
  const descOf = useCallback(
    (s: MarketplaceService) => pickTranslation(s.description, s.descriptionTranslations, locale),
    [locale],
  );

  // Users never see hidden services, even if the backend sent them.
  const visibleServices = useMemo(
    () =>
      (data?.services ?? []).filter((s) => (canManage || s.isActive) && (view === "all" || s.isFavorite)),
    [data, canManage, view],
  );

  const countFor = useCallback(
    (categoryId: string) => visibleServices.filter((s) => s.categoryId === categoryId).length,
    [visibleServices],
  );

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.categories ?? [])
      .filter((c) => activeCategory === "all" || c.id === activeCategory)
      .map((c) => ({
        category: c,
        items: visibleServices.filter(
          (s) =>
            s.categoryId === c.id &&
            (!q || s.name.toLowerCase().includes(q) || descOf(s).toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
        ),
      }))
      // While searching (or in My services), hide categories with no match.
      // Otherwise staff still see empty categories so they can fill them.
      .filter((sec) => sec.items.length > 0 || (!q && canManage && view === "all"));
  }, [data, visibleServices, query, activeCategory, canManage, view, descOf]);

  function openAdd(categoryId?: string) {
    if (!data?.categories.length) {
      toast.info(t("marketplace.addCategoryFirst"));
      setCategoriesOpen(true);
      return;
    }
    setEditing(null);
    setFormCategory(categoryId);
    setFormOpen(true);
  }

  function openEdit(svc: MarketplaceService) {
    setEditing(svc);
    setFormCategory(undefined);
    setFormOpen(true);
  }

  async function confirmDelete(svc: MarketplaceService) {
    try {
      await marketplaceDirectoryService.deleteService(svc.id);
      toast.success(t("marketplace.deleted"));
      void load();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("marketplace.deleteError")));
    } finally {
      setToDelete(null);
    }
  }

  async function toggleFavorite(svc: MarketplaceService) {
    const next = !svc.isFavorite;
    // Flip at once; put it back if the server says no.
    const flip = (value: boolean) =>
      setData((d) =>
        d ? { ...d, services: d.services.map((s) => (s.id === svc.id ? { ...s, isFavorite: value } : s)) } : d,
      );
    flip(next);
    setDetails((d) => (d && d.id === svc.id ? { ...d, isFavorite: next } : d));
    try {
      await marketplaceDirectoryService.setFavorite(svc.id, next);
      toast.success(t(next ? "marketplace.favoriteAdded" : "marketplace.favoriteRemoved"));
    } catch (e) {
      flip(!next);
      setDetails((d) => (d && d.id === svc.id ? { ...d, isFavorite: !next } : d));
      toast.error(friendlyErrorMessage(e, t("marketplace.favoriteError")));
    }
  }

  const categoryById = (id: string) => data?.categories.find((c) => c.id === id);
  const allVisible = (data?.services ?? []).filter((s) => canManage || s.isActive);
  const hasAnything = (data?.categories.length ?? 0) > 0 && (canManage || allVisible.length > 0);

  return (
    <>
      <PageHeader
        title={t("marketplace.title")}
        description={t("marketplace.subtitle")}
        actions={
          canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}>
                <Layers className="h-3.5 w-3.5" />
                {t("marketplace.categories")}
              </Button>
              <Button size="sm" onClick={() => openAdd()}>
                <Plus className="h-3.5 w-3.5" />
                {t("marketplace.addService")}
              </Button>
            </>
          ) : undefined
        }
      />

      {canManage && data?.local && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[oklch(0.78_0.16_75)]/40 bg-[oklch(0.78_0.16_75)]/10 px-3.5 py-2.5 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.78_0.16_75)]" />
          <p>{t("marketplace.localNotice")}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          tone="amber"
          title={t("marketplace.loadError")}
          description={error}
          actions={
            <Button size="sm" variant="outline" onClick={() => void load()}>
              {t("marketplace.tryAgain")}
            </Button>
          }
        />
      ) : !hasAnything ? (
        <EmptyState
          icon={Store}
          title={t("marketplace.emptyTitle")}
          description={canManage ? t("marketplace.emptyStaff") : t("marketplace.emptyUser")}
          actions={
            canManage ? (
              <Button size="sm" onClick={() => openAdd()}>
                <Plus className="h-3.5 w-3.5" />
                {t("marketplace.addService")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {/* ─── All services / My services (underline tabs, like the reference) ─── */}
          <div className="flex flex-col gap-4 border-b border-border lg:flex-row lg:items-end lg:justify-between">
            <div className="flex gap-1">
              {(["all", "mine"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "relative px-3 py-2.5 text-[13px] font-medium transition-colors",
                    view === v ? "text-[color:var(--success)]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "all" ? t("marketplace.view.all") : t("marketplace.view.mine")}
                  {v === "mine" && (
                    <span className="ml-1 text-muted-foreground">
                      ({allVisible.filter((s) => s.isFavorite).length})
                    </span>
                  )}
                  {view === v && (
                    <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-[color:var(--success)]" />
                  )}
                </button>
              ))}
            </div>
            <div className="relative pb-3 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-[calc(50%-0.375rem)] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("marketplace.search")}
                className="pl-9"
              />
            </div>
          </div>

          {/* ─── Category filter ─────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label={t("marketplace.all")}
              count={visibleServices.length}
            />
            {data!.categories.map((c) => (
              <FilterChip
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
                label={catName(c)}
                count={countFor(c.id)}
              />
            ))}
          </div>

          {sections.length === 0 &&
            (view === "mine" && !query.trim() ? (
              <EmptyState icon={Star} title={t("marketplace.mineEmptyTitle")} description={t("marketplace.mineEmpty")} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("marketplace.noMatch").replace("{q}", query)}
              </p>
            ))}

          {/* ─── Sections: "Ad networks (55)" ─────────────────────── */}
          {sections.map(({ category, items }) => {
            const isOpen = expanded[category.id] || !!query.trim() || view === "mine";
            const shown = isOpen ? items : items.slice(0, PREVIEW_COUNT);
            return (
              <section key={category.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-medium text-foreground">
                    {catName(category)}{" "}
                    <span className="text-[color:var(--success)]">({items.length})</span>
                  </h2>
                  {canManage && view === "all" && (
                    <Button size="sm" variant="ghost" onClick={() => openAdd(category.id)}>
                      <Plus className="h-3.5 w-3.5" />
                      {t("marketplace.addHere")}
                    </Button>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
                    {t("marketplace.categoryEmpty")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((svc) => (
                      <ServiceCard
                        key={svc.id}
                        service={svc}
                        description={descOf(svc)}
                        canManage={canManage}
                        onDetails={() => setDetails(svc)}
                        onEdit={() => openEdit(svc)}
                        onDelete={() => setToDelete(svc)}
                        onFavorite={() => void toggleFavorite(svc)}
                      />
                    ))}
                  </div>
                )}

                {!isOpen && items.length > PREVIEW_COUNT && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded((e) => ({ ...e, [category.id]: true }))}
                    >
                      {t("marketplace.showAll").replace("{n}", String(items.length))}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {expanded[category.id] && !query.trim() && view === "all" && items.length > PREVIEW_COUNT && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded((e) => ({ ...e, [category.id]: false }))}
                    >
                      {t("marketplace.hide")} <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ─── More details ─────────────────────────────────────────── */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-md">
          {details && (
            <>
              <div className="flex h-28 items-center justify-center rounded-lg bg-white p-4">
                <Logo service={details} large />
              </div>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{details.name}</span>
                  <FavoriteButton
                    active={!!details.isFavorite}
                    onClick={() => void toggleFavorite(details)}
                    labelOn={t("marketplace.removeFavorite")}
                    labelOff={t("marketplace.addFavorite")}
                  />
                </DialogTitle>
                <DialogDescription>{catName(categoryById(details.categoryId))}</DialogDescription>
              </DialogHeader>
              {descOf(details) && (
                <p className="max-h-64 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {descOf(details)}
                </p>
              )}
              {/* Seeded services start without a link until staff add one. */}
              {details.websiteUrl ? (
                <Button asChild className="w-full">
                  <a href={details.websiteUrl} target="_blank" rel="noopener noreferrer">
                    {t("marketplace.visitWebsite")} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

      {canManage && data && (
        <>
          <ServiceFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            categories={data.categories}
            service={editing}
            defaultCategoryId={formCategory}
            onSaved={() => void load()}
          />
          <CategoriesDialog
            open={categoriesOpen}
            onOpenChange={setCategoriesOpen}
            categories={data.categories}
            countFor={(id) => data.services.filter((s) => s.categoryId === id).length}
            onChanged={() => void load()}
          />
          <ConfirmDelete
            open={!!toDelete}
            title={t("marketplace.deleteTitle").replace("{name}", toDelete?.name ?? "")}
            description={t("marketplace.deleteDesc")}
            onCancel={() => setToDelete(null)}
            onConfirm={() => toDelete && void confirmDelete(toDelete)}
          />
        </>
      )}
    </>
  );
}

/* ─── pieces ─────────────────────────────────────────────────────────── */

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-[color:var(--success)]/60 bg-[color:var(--success)]/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {label} <span className="text-muted-foreground">{count}</span>
    </button>
  );
}

function FavoriteButton({
  active,
  onClick,
  labelOn,
  labelOff,
  className,
}: {
  active: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? labelOn : labelOff}
      title={active ? labelOn : labelOff}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
        active ? "text-amber-500" : "text-muted-foreground hover:text-amber-500",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  );
}

function Logo({ service, large }: { service: MarketplaceService; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!service.logoUrl || broken) {
    return (
      <div className="flex flex-col items-center gap-1 text-neutral-500">
        <Globe className={large ? "h-8 w-8" : "h-6 w-6"} />
        <span className="max-w-full truncate text-xs font-semibold">{service.name}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={service.logoUrl}
      alt={service.name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="max-h-full max-w-full object-contain"
    />
  );
}

function ServiceCard({
  service,
  description,
  canManage,
  onDetails,
  onEdit,
  onDelete,
  onFavorite,
}: {
  service: MarketplaceService;
  description: string;
  canManage: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-[color:var(--success)]/50",
        !service.isActive && "opacity-60",
      )}
    >
      <div className="absolute left-2 top-2 z-10">
        <FavoriteButton
          active={!!service.isFavorite}
          onClick={onFavorite}
          labelOn={t("marketplace.removeFavorite")}
          labelOff={t("marketplace.addFavorite")}
          className="bg-white/80 backdrop-blur-sm"
        />
      </div>
      {canManage && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button size="icon" variant="secondary" className="h-7 w-7" aria-label={t("marketplace.edit")} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="secondary" className="h-7 w-7" aria-label={t("marketplace.delete")} onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}

      {/* Logos are made for white backgrounds, so they sit on white in both themes. */}
      <button
        type="button"
        onClick={onDetails}
        className="m-3 mb-0 flex h-28 items-center justify-center rounded-lg bg-white px-6 py-4"
        aria-label={t("marketplace.detailsAria").replace("{name}", service.name)}
      >
        <Logo service={service} />
      </button>

      <div className="flex flex-1 flex-col items-center px-4 pb-4 pt-3 text-center">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {service.name}
          {!service.isActive && (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("marketplace.hidden")} />
          )}
        </h3>
        <p className="mt-1 line-clamp-3 min-h-[3.25rem] text-[12px] leading-[1.1rem] text-muted-foreground">
          {description}
        </p>
        <button
          type="button"
          onClick={onDetails}
          className="mt-3 inline-flex items-center gap-0.5 border-b border-dashed border-[color:var(--success)]/60 text-[12px] font-medium text-[color:var(--success)] hover:border-solid"
        >
          {t("marketplace.moreDetails")} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
