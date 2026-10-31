"use client";

/* CH-461: New number pool - Sir's 5-step design.
 *   1 Lander      pages & numbers to swap (the server reads the page)
 *   2 Numbers     pool size & source (TFNs from Phone Numbers)
 *   3 Routing     campaign & timing (idle limit, closed-browser delay, cool-down)
 *   4 Protection  spam attack rules
 *   5 Install     the snippet & live checks
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAPTURE_OPTIONS,
  displayNumber,
  poolSnippet,
  ProtectionFields,
  useAgo,
} from "@/components/numbers/pool-design";
import { useTranslation } from "@/hooks/use-translation";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { DEFAULT_PROTECTION, poolsService } from "@/lib/api/services/numbers.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { FoundNumber, NumberPool, PoolProtection } from "@/lib/types";

const DRAFT_KEY = "avx_new_pool_draft";
const DEFAULT_CAPTURE = ["gclid", "msclkid", "utm_source", "utm_campaign", "utm_term"];

interface LanderDraft {
  url: string;
  found: FoundNumber[];
  swap: string[];
}

interface Draft {
  step: number;
  landers: LanderDraft[];
  capture: string[];
  name: string;
  country: string;
  fallback: string;
  numberIds: string[];
  campaignId: string;
  idleMin: number;
  closedSec: number;
  cooldownSec: number;
  domains: string;
  protection: PoolProtection;
}

const EMPTY: Draft = {
  step: 1,
  landers: [],
  capture: DEFAULT_CAPTURE,
  name: "",
  country: "US",
  fallback: "",
  numberIds: [],
  campaignId: "",
  idleMin: 5,
  closedSec: 30,
  cooldownSec: 120,
  domains: "",
  protection: { ...DEFAULT_PROTECTION },
};

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    /* no saved draft */
  }
  return EMPTY;
}

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const STEPS = [
  { title: "x461.step.lander", hint: "x461.step.landerHint" },
  { title: "x461.step.numbers", hint: "x461.step.numbersHint" },
  { title: "x461.step.routing", hint: "x461.step.routingHint" },
  { title: "x461.step.protection", hint: "x461.step.protectionHint" },
  { title: "x461.step.install", hint: "x461.step.installHint" },
];

export default function NewPoolPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPartner } = usePartnerPermissions();
  const [d, setD] = React.useState<Draft>(EMPTY);
  const [created, setCreated] = React.useState<NumberPool | null>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setD(readDraft()), []);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  if (isPartner) {
    return <p className="text-sm text-muted-foreground">{t("trafficUI.numbers.poolDetail.notFoundDescription")}</p>;
  }

  const saveDraftAndExit = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      toast.success(t("x461.draftSaved"));
    } catch {
      /* storage blocked: nothing to keep */
    }
    router.push(ROUTES.numbers);
  };

  const canContinue =
    d.step === 1 ? true
      : d.step === 2 ? d.name.trim().length > 0
        : true;

  const create = async () => {
    setSaving(true);
    try {
      const domains = d.domains.split(",").map((x) => x.trim()).filter(Boolean);
      const pool = await poolsService.createFull({
        name: d.name.trim(),
        campaignId: d.campaignId || undefined,
        country: d.country,
        fallbackNumber: d.fallback.trim(),
        allowedDomains: domains,
        attachedNumberIds: d.numberIds,
        idleTimeSec: Math.max(1, d.idleMin) * 60,
        closedBrowserDelaySeconds: d.closedSec,
        cooldownSeconds: d.cooldownSec,
        captureParams: d.capture,
        protection: d.protection,
        landers: d.landers,
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nothing saved */
      }
      setCreated(pool);
      void useNumbersStore.getState().fetch();
      toast.success(t("trafficUI.numbers.pools.toast.created").replace("{name}", d.name.trim()));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={ROUTES.numbers} className="hover:text-foreground">{t("x461.numberPools")}</Link>
          <span>/</span>
          <span className="text-foreground">{t("x461.newPool")}</span>
        </div>
        {!created && (
          <button type="button" onClick={saveDraftAndExit} className="text-xs text-muted-foreground hover:text-foreground">
            {t("x461.saveDraftExit")}
          </button>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside>
          <h1 className="mb-5 text-lg font-semibold">{t("x461.newNumberPool")}</h1>
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = d.step === n;
              const done = d.step > n || created !== null;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    disabled={created !== null || n > d.step}
                    onClick={() => set({ step: n })}
                    className={`flex w-full items-start gap-3 rounded-md px-2 py-2 text-left ${active ? "bg-secondary" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                      }`}
                    >
                      {done && !active ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span>
                      <span className="block text-sm">{t(s.title)}</span>
                      <span className="block text-[11px] text-muted-foreground">{t(s.hint)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="min-w-0">
          {d.step === 1 && <StepLander d={d} set={set} />}
          {d.step === 2 && <StepNumbers d={d} set={set} />}
          {d.step === 3 && <StepRouting d={d} set={set} />}
          {d.step === 4 && (
            <div>
              <StepTitle title={t("x461.protection.title")} hint={t("x461.protection.hint")} />
              <Card className="px-4 py-1">
                <ProtectionFields value={d.protection} onChange={(protection) => set({ protection })} />
              </Card>
            </div>
          )}
          {d.step === 5 && <StepInstall d={d} created={created} />}
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {t("x461.stepOf").replace("{n}", String(d.step)).replace("{total}", "5")}
        </span>
        <div className="flex gap-2">
          {created ? (
            <Button onClick={() => router.push(`${ROUTES.numbers}/pools/${created.id}`)}>{t("x461.openPool")}</Button>
          ) : (
            <>
              <Button variant="outline" disabled={d.step === 1} onClick={() => set({ step: d.step - 1 })}>
                {t("x461.back")}
              </Button>
              {d.step < 5 ? (
                <Button disabled={!canContinue} onClick={() => set({ step: d.step + 1 })}>
                  {t("x461.continue")}
                </Button>
              ) : (
                <Button disabled={saving || !d.name.trim()} onClick={create}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {t("x461.createPool")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

/* ─── 1. Lander ─────────────────────────────────────────────────────── */

function StepLander({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = React.useState("");
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<LanderDraft | null>(null);
  const [error, setError] = React.useState("");

  const scan = async (target = url) => {
    if (!target.trim()) return;
    setScanning(true);
    setError("");
    try {
      const r = await poolsService.scan(target.trim());
      const full = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${target.trim()}`;
      setResult({ url: full, found: r.found, swap: Array.from(new Set(r.found.map((f) => f.number))) });
    } catch (e) {
      setResult(null);
      setError(friendlyErrorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const addResult = () => {
    if (!result) return;
    const others = d.landers.filter((l) => l.url !== result.url);
    const host = hostOf(result.url);
    const domains = d.domains.split(",").map((x) => x.trim()).filter(Boolean);
    set({
      landers: [...others, result],
      domains: host && !domains.includes(host) ? [...domains, host].join(", ") : d.domains,
    });
    setResult(null);
    setUrl("");
  };

  const toggleSwap = (number: string) => {
    if (!result) return;
    const swap = result.swap.includes(number) ? result.swap.filter((x) => x !== number) : [...result.swap, number];
    setResult({ ...result, swap });
  };

  return (
    <div>
      <StepTitle title={t("x461.lander.title")} hint={t("x461.lander.hint")} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="https://bing-landing.com/offer"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void scan();
            }}
          />
        </div>
        <Button variant="outline" disabled={scanning || !url.trim()} onClick={() => scan()}>
          {scanning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          {result ? t("x461.lander.rescan") : t("x461.lander.scan")}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {result && (
        <Card className="mt-3 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">{hostOf(result.url) + (new URL(result.url).pathname !== "/" ? new URL(result.url).pathname : "")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("x461.lander.foundCount").replace("{n}", String(result.found.length))}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t("x461.lander.waiting")}
            </span>
          </div>
          {result.found.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">{t("x461.lander.noneFound")}</p>
          ) : (
            result.found.map((f, i) => (
              <label key={`${f.number}-${i}`} className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                <Checkbox checked={result.swap.includes(f.number)} onCheckedChange={() => toggleSwap(f.number)} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{t(`x461.where.${f.label.replace(/\s+/g, "")}`)}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{f.where}</div>
                </div>
                <span className="font-mono text-xs tabular-nums">{f.display}</span>
              </label>
            ))
          )}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] text-muted-foreground">{t("x461.lander.checkedNote")}</span>
            <Button size="sm" onClick={addResult}>{t("x461.lander.add")}</Button>
          </div>
        </Card>
      )}

      <SectionLabel>{t("x461.lander.all")}</SectionLabel>
      <Card className="p-0">
        {d.landers.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">{t("x461.lander.noneYet")}</p>
        ) : (
          d.landers.map((l) => (
            <div key={l.url} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0">
              <span className="truncate font-mono text-xs">{l.url}</span>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {t("x461.lander.numbersN").replace("{n}", String(l.found.length))}
                <button
                  type="button"
                  aria-label={t("x461.remove")}
                  onClick={() => set({ landers: d.landers.filter((x) => x.url !== l.url) })}
                  className="hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))
        )}
      </Card>

      <SectionLabel>{t("x461.capture.title")}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {CAPTURE_OPTIONS.map((c) => {
          const on = d.capture.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => set({ capture: on ? d.capture.filter((x) => x !== c) : [...d.capture, c] })}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${
                on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("x461.capture.hint")}</p>
    </div>
  );
}

/* ─── 2. Numbers ────────────────────────────────────────────────────── */

function StepNumbers({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { t } = useTranslation();
  const numbers = useNumbersStore((s) => s.numbers);
  const [q, setQ] = React.useState("");
  // A TFN can be in one pool only (CH-456).
  const free = numbers.filter((n) => !n.poolId);
  const shown = free.filter((n) => !q || n.number.includes(q.replace(/\D/g, "")) || (n.campaignName ?? "").toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) =>
    set({ numberIds: d.numberIds.includes(id) ? d.numberIds.filter((x) => x !== id) : [...d.numberIds, id] });

  return (
    <div>
      <StepTitle title={t("x461.numbers.title")} hint={t("x461.numbers.hint")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">{t("x461.numbers.name")}</Label>
          <Input className="mt-1" value={d.name} placeholder="Bing — Main" onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">{t("x461.numbers.country")}</Label>
          <Select value={d.country} onValueChange={(country) => set({ country })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["US", "CA", "GB", "AU"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">{t("x456.fallback")}</Label>
          <Input className="mt-1 font-mono" value={d.fallback} placeholder="+18005550000" onChange={(e) => set({ fallback: e.target.value })} />
          <p className="mt-1 text-[11px] text-muted-foreground">{t("x456.fallbackHint")}</p>
        </div>
      </div>

      <SectionLabel>
        {t("x461.numbers.pick").replace("{n}", String(d.numberIds.length))}
      </SectionLabel>
      <Input className="mb-2" placeholder={t("trafficUI.numbers.poolDetail.attach.dialog.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="max-h-[320px] overflow-auto p-0">
        {shown.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">{t("x461.numbers.noneFree")}</p>
        ) : (
          shown.map((n) => (
            <label key={n.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2 last:border-0">
              <Checkbox checked={d.numberIds.includes(n.id)} onCheckedChange={() => toggle(n.id)} />
              <span className="font-mono text-xs tabular-nums">{displayNumber(n.number)}</span>
              <span className="truncate text-xs text-muted-foreground">{n.campaignName || ""}</span>
            </label>
          ))
        )}
      </Card>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("x461.numbers.sizeHint")}</p>
    </div>
  );
}

/* ─── 3. Routing ────────────────────────────────────────────────────── */

function StepRouting({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const field = (label: string, hint: string, value: number, onChange: (n: number) => void, max: number, unit: string) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={max}
          className="h-8 w-24 text-right font-mono tabular-nums"
          value={String(value)}
          onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        />
        <span className="w-8 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
  return (
    <div>
      <StepTitle title={t("x461.routing.title")} hint={t("x461.routing.hint")} />
      <Label className="text-xs">{t("trafficUI.numbers.pools.headers.campaign")}</Label>
      <Select value={d.campaignId || "none"} onValueChange={(v) => set({ campaignId: v === "none" ? "" : v })}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("x461.routing.noCampaign")}</SelectItem>
          {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("x461.routing.campaignHint")}</p>

      <SectionLabel>{t("x461.routing.timing")}</SectionLabel>
      <Card className="divide-y divide-border px-4 py-1">
        {field(t("x461.routing.idle"), t("x461.routing.idleHint"), d.idleMin, (idleMin) => set({ idleMin: Math.max(1, idleMin) }), 120, t("x461.unit.minShort"))}
        {field(t("x461.routing.closed"), t("x461.routing.closedHint"), d.closedSec, (closedSec) => set({ closedSec }), 3600, t("x461.unit.secShort"))}
        {field(t("x461.routing.cooldown"), t("x461.routing.cooldownHint"), d.cooldownSec, (cooldownSec) => set({ cooldownSec }), 3600, t("x461.unit.secShort"))}
      </Card>

      <SectionLabel>{t("x456.websites")}</SectionLabel>
      <Input value={d.domains} placeholder="bing-landing.com" onChange={(e) => set({ domains: e.target.value })} />
      <p className="mt-1 text-[11px] text-muted-foreground">{t("x456.websitesHint")}</p>
    </div>
  );
}

/* ─── 5. Install ────────────────────────────────────────────────────── */

function StepInstall({ d, created }: { d: Draft; created: NumberPool | null }) {
  const { t } = useTranslation();
  const ago = useAgo();
  const [live, setLive] = React.useState<NumberPool | null>(null);
  const campaigns = useCampaignsStore((s) => s.campaigns);

  // Live check: ask the server every 5 s whether the script has called in.
  React.useEffect(() => {
    if (!created) return;
    let stop = false;
    const tick = async () => {
      try {
        const p = await poolsService.get(created.id);
        if (!stop) setLive(p);
      } catch {
        /* try again on the next tick */
      }
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [created]);

  const pool = live ?? created;
  const snippet = pool?.design?.publicKey ? poolSnippet(pool.design.publicKey) : "";
  const seen = pool?.design?.snippetSeenAt;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );

  return (
    <div>
      <StepTitle title={t("x461.install.title")} hint={created ? t("x461.install.hintCreated") : t("x461.install.hint")} />
      {!created ? (
        <Card className="divide-y divide-border px-4 py-1">
          {row(t("x461.numbers.name"), d.name || "—")}
          {row(t("x461.install.landers"), d.landers.length)}
          {row(t("x461.install.numbers"), d.numberIds.length)}
          {row(t("trafficUI.numbers.pools.headers.campaign"), campaigns.find((c) => c.id === d.campaignId)?.name ?? "—")}
          {row(t("x461.routing.idle"), `${d.idleMin} ${t("x461.unit.minShort")}`)}
          {row(t("x461.routing.closed"), `${d.closedSec} ${t("x461.unit.secShort")}`)}
          {row(t("x461.routing.cooldown"), `${d.cooldownSec} ${t("x461.unit.secShort")}`)}
          {row(t("x456.fallback"), d.fallback || "—")}
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("x461.install.onPage")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  toast.success(t("x461.snippetCopied"));
                } catch {
                  toast.error(t("trafficUI.common.copyFailed"));
                }
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t("trafficUI.common.copy")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("x461.install.paste")}</p>
          <pre className="mt-3 overflow-auto rounded-md border border-border bg-secondary/30 p-3 font-mono text-[11px]">{snippet}</pre>
          <div className="mt-3 space-y-1.5 text-xs">
            <Check1 ok={Boolean(seen)} text={seen ? t("x461.install.seen").replace("{host}", pool?.design?.snippetSeenHost || "").replace("{ago}", ago(seen)) : t("x461.install.waiting")} />
            <Check1 ok={(pool?.numberCount ?? 0) > 0} text={t("x461.install.numbersReady").replace("{n}", String(pool?.numberCount ?? 0))} />
            <Check1 ok={Boolean(pool?.fallbackNumber)} text={pool?.fallbackNumber ? t("x461.install.fallbackSet") : t("x461.install.fallbackMissing")} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Check1({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Plus className="h-3.5 w-3.5 rotate-45 text-amber-500" />}
      <span className={ok ? "" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}
