"use client";

/**
 * White Label admin — branding (company name / logo / colors / support
 * contacts) + custom domain management. Domains move pending → verifying →
 * verified once DNS records are in place.
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  ShieldQuestion,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  whiteLabelService,
  type DomainStatus,
  type WhiteLabel,
  type WhiteLabelDomain,
} from "@/lib/api/services/white-label.service";
import { formatLocalDate } from "@/lib/format";

const STATUS_TONE: Record<DomainStatus, { variant: "success" | "outline" | "destructive" | "warning"; icon: typeof CheckCircle2 }> = {
  verified: { variant: "success", icon: CheckCircle2 },
  pending: { variant: "outline", icon: ShieldQuestion },
  verifying: { variant: "warning", icon: Loader2 },
  failed: { variant: "destructive", icon: XCircle },
};

export default function WhiteLabelPage() {
  const [config, setConfig] = useState<WhiteLabel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<WhiteLabel>>({});
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const wl = await whiteLabelService.get();
        if (cancelled) return;
        setConfig(wl);
        if (wl) {
          setDraft({
            companyName: wl.companyName,
            logoUrl: wl.logoUrl,
            faviconUrl: wl.faviconUrl,
            supportEmail: wl.supportEmail,
            supportPhone: wl.supportPhone,
            websiteUrl: wl.websiteUrl,
            primaryColor: wl.primaryColor,
            secondaryColor: wl.secondaryColor,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveBranding = async () => {
    setSaving(true);
    try {
      const updated = await whiteLabelService.update(draft);
      setConfig(updated);
      toast.success("Branding saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addDomain = async () => {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const added = await whiteLabelService.addDomain({ domain: trimmed });
      setConfig((c) =>
        c ? { ...c, domains: [added, ...c.domains] } : { id: "", companyName: "", domains: [added] },
      );
      setNewDomain("");
      toast.success(`Domain ${trimmed} added — verify DNS to activate`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add domain");
    }
  };

  const verifyDomain = async (d: WhiteLabelDomain) => {
    try {
      const updated = await whiteLabelService.verifyDomain(d.id);
      setConfig((c) =>
        c
          ? {
              ...c,
              domains: c.domains.map((x) => (x.id === updated.id ? updated : x)),
            }
          : c,
      );
      toast.success(
        updated.status === "verified"
          ? `${d.domain} verified`
          : `${d.domain} — verification in progress`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    }
  };

  const removeDomain = async (d: WhiteLabelDomain) => {
    try {
      await whiteLabelService.removeDomain(d.id);
      setConfig((c) =>
        c ? { ...c, domains: c.domains.filter((x) => x.id !== d.id) } : c,
      );
      toast.success(`${d.domain} removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  return (
    <>
      <PageHeader
        title="White Label"
        description="Custom branding and domains for your workspace."
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ─── Branding ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Branding</CardTitle>
              <p className="text-xs text-muted-foreground">
                Company identity and support contacts shown in customer-facing surfaces.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Company name"
                value={draft.companyName ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, companyName: v }))}
              />
              <Field
                label="Website URL"
                value={draft.websiteUrl ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, websiteUrl: v }))}
                placeholder="https://yourbrand.com"
              />
              <Field
                label="Logo URL"
                value={draft.logoUrl ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, logoUrl: v }))}
                placeholder="https://…/logo.svg"
              />
              <Field
                label="Favicon URL"
                value={draft.faviconUrl ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, faviconUrl: v }))}
                placeholder="https://…/favicon.ico"
              />
              <Field
                label="Support email"
                type="email"
                value={draft.supportEmail ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, supportEmail: v }))}
                placeholder="support@yourbrand.com"
              />
              <Field
                label="Support phone"
                type="tel"
                value={draft.supportPhone ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, supportPhone: v }))}
                placeholder="+1 555 123 4567"
              />
              <Field
                label="Primary color"
                value={draft.primaryColor ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, primaryColor: v }))}
                placeholder="#5266E0"
              />
              <Field
                label="Secondary color"
                value={draft.secondaryColor ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, secondaryColor: v }))}
                placeholder="#818CF8"
              />
              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button onClick={saveBranding} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save branding"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Domains ─────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Custom domains</CardTitle>
              <p className="text-xs text-muted-foreground">
                Point a CNAME at <span className="font-mono">cname.avortyx.io</span> and verify to activate.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="portal.yourbrand.com"
                  className="sm:flex-1"
                />
                <Button onClick={addDomain} disabled={!newDomain.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Add domain
                </Button>
              </div>

              {config && config.domains.length > 0 ? (
                <ul className="space-y-2">
                  {config.domains.map((d) => {
                    const tone = STATUS_TONE[d.status];
                    const Icon = tone.icon;
                    return (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
                            <Globe className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{d.domain}</span>
                              {d.isPrimary && (
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {d.verifiedAt
                                ? `Verified ${formatLocalDate(d.verifiedAt)}`
                                : "Awaiting DNS verification"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={tone.variant} className="gap-1.5 text-[10px] uppercase tracking-wider">
                            <Icon
                              className={`h-3 w-3 ${d.status === "verifying" ? "animate-spin" : ""}`}
                            />
                            {d.status}
                          </Badge>
                          {d.status !== "verified" && (
                            <Button size="sm" variant="outline" onClick={() => verifyDomain(d)}>
                              Verify
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDomain(d)}
                            aria-label={`Remove ${d.domain}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={Globe}
                  tone="cyan"
                  title="No custom domains yet"
                  description="Add a domain to white-label the operator portal."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
