"use client";

/**
 * The PERMISSIONS and REPORTING VISIBILITY boxes of a buyer's or publisher's
 * access settings, saved on the server (see lib/store/partner-settings-store).
 *
 * What is ticked here is what that partner's OWN login sees and may do. The
 * admin's Reports are never affected.
 */

import * as React from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import {
  partnerKey,
  usePartnerSettingsStore,
  type CatalogueItem,
  type PartnerKind,
} from "@/lib/store/partner-settings-store";

/** Load the catalogue and this partner's saved settings once the box is shown. */
export function usePartnerSettings(kind: PartnerKind, id: string) {
  const catalogue = usePartnerSettingsStore((s) => s.catalogue);
  const settings = usePartnerSettingsStore((s) => s.byPartner[partnerKey(kind, id)]);
  const status = usePartnerSettingsStore((s) => s.status[partnerKey(kind, id)]);
  const fetchCatalogue = usePartnerSettingsStore((s) => s.fetchCatalogue);
  const fetchSettings = usePartnerSettingsStore((s) => s.fetchSettings);
  React.useEffect(() => {
    void fetchCatalogue();
    void fetchSettings(kind, id);
  }, [kind, id, fetchCatalogue, fetchSettings]);
  return { catalogue, settings, status };
}

/** The translated text when the dictionary has it, else the backend's English. */
function useLabel() {
  const { t } = useTranslation();
  return React.useCallback(
    (key: string, fallback: string) => {
      const out = t(key);
      return out && out !== key ? out : fallback;
    },
    [t],
  );
}

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function PartnerReportingVisibility({
  kind,
  id,
  title,
  description,
  idPrefix,
}: {
  kind: PartnerKind;
  id: string;
  title: string;
  /** With {visible} and {total} placeholders. */
  description: string;
  /** Keeps checkbox ids unique when the box is on screen twice. */
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const label = useLabel();
  const { catalogue, settings, status } = usePartnerSettings(kind, id);
  const toggleColumn = usePartnerSettingsStore((s) => s.toggleColumn);
  const columns: CatalogueItem[] = catalogue?.reportColumns ?? [];
  const visible = new Set(settings?.visibleColumns ?? []);
  const visibleCount = columns.filter((c) => visible.has(c.key)).length;

  const onToggle = async (key: string) => {
    try {
      await toggleColumn(kind, id, key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("x2.partnerAccess.saveVisibilityFailed"));
    }
  };

  return (
    <Section
      title={title}
      description={description
        .replace("{visible}", String(visibleCount))
        .replace("{total}", String(columns.length))}
    >
      {status === "error" && !settings ? (
        <p className="px-4 pb-4 text-xs text-destructive">{t("x2.partnerAccess.loadFailed")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1 px-2 py-2 sm:grid-cols-2">
          {columns.map((col) => {
            const cid = `${idPrefix}-${col.key}`;
            const k = camel(col.key);
            return (
              <li key={col.key}>
                <label
                  htmlFor={cid}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/40"
                >
                  <Checkbox
                    id={cid}
                    checked={visible.has(col.key)}
                    disabled={!settings}
                    onCheckedChange={() => void onToggle(col.key)}
                    // Clearly visible box: a thicker, lighter border when empty and
                    // a filled accent box with a white tick when ticked. The default
                    // border nearly disappeared on the dark card.
                    className="mt-0.5 size-[18px] border-2 border-muted-foreground/70 dark:bg-transparent data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white dark:data-[state=checked]:bg-accent"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      {col.labelKey ? t(col.labelKey) : label(`sharedUI.reportingVisibility.columns.${k}.label`, col.label)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {col.descriptionKey
                        ? t(col.descriptionKey)
                        : label(`sharedUI.reportingVisibility.columns.${k}.description`, col.description)}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function PartnerPermissions({
  kind,
  id,
  title,
  description,
  only,
  toggleAria,
}: {
  kind: PartnerKind;
  id: string;
  title: string;
  description: string;
  /** Show only these backend permission keys (e.g. a buyer gets fewer). */
  only?: string[];
  /** With a {label} placeholder. */
  toggleAria: string;
}) {
  const { t } = useTranslation();
  const { catalogue, settings } = usePartnerSettings(kind, id);
  const togglePermission = usePartnerSettingsStore((s) => s.togglePermission);
  const items = (catalogue?.permissions ?? []).filter((p) => !only || only.includes(p.key));

  const onToggle = async (key: string) => {
    try {
      await togglePermission(kind, id, key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("x2.partnerAccess.savePermissionFailed"));
    }
  };

  return (
    <Section title={title} description={description}>
      <ul className="divide-y divide-border">
        {items.map((p) => {
          const pLabel = p.labelKey ? t(p.labelKey) : p.label;
          return (
            <li key={p.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium leading-tight">{pLabel}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {p.descriptionKey ? t(p.descriptionKey) : p.description}
                </div>
              </div>
              <Switch
                checked={settings ? settings.permissions[p.key] ?? p.default : false}
                disabled={!settings}
                onCheckedChange={() => void onToggle(p.key)}
                aria-label={toggleAria.replace("{label}", pLabel)}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* Same sub-card shell as the rest of the settings page. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background/30">
      <header className="px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}