"use client";

/**
 * Marketplace → Services: a directory of partner websites (ad networks,
 * hosting, proxies...) for our users. Grouped by category with a count,
 * searchable, 8 cards per category until "Show all".
 *
 * Everyone can browse. Platform staff / superusers also get Add service,
 * Categories, and edit / delete on each card.
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
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  marketplaceDirectoryService,
  type Directory,
  type MarketplaceService,
} from "@/lib/api/services/marketplace-directory.service";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

const PREVIEW_COUNT = 8;

export function ServicesDirectory() {
  const canManage = useAuthStore((s) => s.user?.isSuperuser === true || s.user?.isStaff === true);

  const [data, setData] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [details, setDetails] = useState<MarketplaceService | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceService | null>(null);
  const [formCategory, setFormCategory] = useState<string | undefined>();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MarketplaceService | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await marketplaceDirectoryService.load());
    } catch (e) {
      setError(friendlyErrorMessage(e, "Couldn't load services"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Users never see hidden services, even if the backend sent them.
  const visibleServices = useMemo(
    () => (data?.services ?? []).filter((s) => canManage || s.isActive),
    [data, canManage],
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
            (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
        ),
      }))
      // While searching, hide categories with no match. Otherwise staff still
      // see empty categories so they can fill them.
      .filter((sec) => sec.items.length > 0 || (!q && canManage));
  }, [data, visibleServices, query, activeCategory, canManage]);

  function openAdd(categoryId?: string) {
    if (!data?.categories.length) {
      toast.info("Add a category first.");
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
      toast.success("Service deleted");
      void load();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't delete the service"));
    } finally {
      setToDelete(null);
    }
  }

  const categoryName = (id: string) => data?.categories.find((c) => c.id === id)?.name ?? "";
  const hasAnything = (data?.categories.length ?? 0) > 0 && (canManage || visibleServices.length > 0);

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Services for our users: ad networks, hosting, proxies and more."
        actions={
          canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}>
                <Layers className="h-3.5 w-3.5" />
                Categories
              </Button>
              <Button size="sm" onClick={() => openAdd()}>
                <Plus className="h-3.5 w-3.5" />
                Add service
              </Button>
            </>
          ) : undefined
        }
      />

      {canManage && data?.local && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[oklch(0.78_0.16_75)]/40 bg-[oklch(0.78_0.16_75)]/10 px-3.5 py-2.5 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.78_0.16_75)]" />
          <p>
            The backend for Services isn&apos;t live yet. What you add here is saved in{" "}
            <strong>this browser only</strong> and users can&apos;t see it until the backend ships.
          </p>
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
          title="Couldn't load services"
          description={error}
          actions={
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !hasAnything ? (
        <EmptyState
          icon={Store}
          title="No services yet"
          description={
            canManage
              ? "Add a category, then add the partner websites you want users to see."
              : "Partner services will appear here soon."
          }
          actions={
            canManage ? (
              <Button size="sm" onClick={() => openAdd()}>
                <Plus className="h-3.5 w-3.5" />
                Add service
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {/* ─── Search + category filter ─────────────────────────── */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                label="All"
                count={visibleServices.length}
              />
              {data!.categories.map((c) => (
                <FilterChip
                  key={c.id}
                  active={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                  label={c.name}
                  count={countFor(c.id)}
                />
              ))}
            </div>
          </div>

          {sections.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No services match &ldquo;{query}&rdquo;.
            </p>
          )}

          {/* ─── Sections ─────────────────────────────────────────── */}
          {sections.map(({ category, items }) => {
            const isOpen = expanded[category.id] || !!query.trim();
            const shown = isOpen ? items : items.slice(0, PREVIEW_COUNT);
            return (
              <section key={category.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {category.name}{" "}
                    <span className="text-[color:var(--success)]">({items.length})</span>
                  </h2>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => openAdd(category.id)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add here
                    </Button>
                  )}
                </div>

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
                    No services in this category yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {shown.map((svc) => (
                      <ServiceCard
                        key={svc.id}
                        service={svc}
                        canManage={canManage}
                        onDetails={() => setDetails(svc)}
                        onEdit={() => openEdit(svc)}
                        onDelete={() => setToDelete(svc)}
                      />
                    ))}
                  </div>
                )}

                {!query.trim() && items.length > PREVIEW_COUNT && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded((e) => ({ ...e, [category.id]: !e[category.id] }))}
                    >
                      {isOpen ? (
                        <>
                          Hide <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          Show all ({items.length}) <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ─── Details ──────────────────────────────────────────────── */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-md">
          {details && (
            <>
              <div className="flex h-28 items-center justify-center rounded-lg bg-white p-4">
                <Logo service={details} large />
              </div>
              <DialogHeader>
                <DialogTitle>{details.name}</DialogTitle>
                <DialogDescription>{categoryName(details.categoryId)}</DialogDescription>
              </DialogHeader>
              {details.description && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {details.description}
                </p>
              )}
              <Button asChild className="w-full">
                <a href={details.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Visit website <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
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
            title={`Delete "${toDelete?.name ?? ""}"?`}
            description="It will be removed from the Marketplace for all users. This can't be undone."
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
          ? "border-accent/60 bg-accent/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {label} <span className="text-muted-foreground">{count}</span>
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
  canManage,
  onDetails,
  onEdit,
  onDelete,
}: {
  service: MarketplaceService;
  canManage: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-accent/40",
        !service.isActive && "opacity-60",
      )}
    >
      {canManage && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Delete" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}

      {/* Logos are made for white backgrounds, so they sit on white in both themes. */}
      <button
        type="button"
        onClick={onDetails}
        className="m-3 mb-0 flex h-24 items-center justify-center rounded-lg bg-white p-3"
        aria-label={`${service.name} details`}
      >
        <Logo service={service} />
      </button>

      <div className="flex flex-1 flex-col items-center px-4 pb-4 pt-3 text-center">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {service.name}
          {!service.isActive && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Hidden" />}
        </h3>
        <p className="mt-1 line-clamp-3 min-h-[3.25rem] text-[12px] leading-[1.1rem] text-muted-foreground">
          {service.description}
        </p>
        <button
          type="button"
          onClick={onDetails}
          className="mt-3 inline-flex items-center gap-0.5 text-[12px] font-medium text-[color:var(--success)] hover:underline"
        >
          More details <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
