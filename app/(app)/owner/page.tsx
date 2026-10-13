"use client";

/**
 * Owner — M1: Organizations.
 *
 * The system owner's client list: every workspace with its balance, rates,
 * headcount and today's traffic, plus the four actions that matter — edit
 * rates & fees, credit, debit, suspend/activate. Renders only for
 * is_superuser; everyone else is turned away in plain words even if they
 * type the URL. Backend: /api/owner/organizations (CH-113).
 */

import { useCallback, useEffect, useState } from "react";
import { Crown, MoreHorizontal, Plus, Search, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { useAuthStore } from "@/lib/store/auth-store";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  users: number;
  balance: string | null;
  per_minute_rate: string | null;
  markup_percent: string | null;
  billing_status: string | null;
  calls_today: number;
  revenue_today: string;
}

const FEE_FIELDS = [
  "per_minute_rate",
  "markup_percent",
  "recording_fee_per_minute",
  "voip_shield_fee_per_call",
  "rejected_call_fee",
  "tfn_purchase_fee",
  "monthly_portal_fee",
  "credit_limit",
] as const;
type FeeField = (typeof FEE_FIELDS)[number];

function errText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Try again.";
}

export default function OwnerPage() {
  const { t } = useTranslation();
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);

  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state: which org (null = closed), and the form values.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", admin_email: "", per_minute_rate: "" });
  const [feesFor, setFeesFor] = useState<OrgRow | null>(null);
  const [feeForm, setFeeForm] = useState<Record<FeeField, string>>(
    Object.fromEntries(FEE_FIELDS.map((f) => [f, ""])) as Record<FeeField, string>,
  );
  const [moneyFor, setMoneyFor] = useState<{ org: OrgRow; direction: "credit" | "debit" } | null>(null);
  const [moneyForm, setMoneyForm] = useState({ amount: "", note: "" });
  const [suspendFor, setSuspendFor] = useState<OrgRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      const r = await http.get<{ items: OrgRow[] }>(
        `/api/owner/organizations?search=${encodeURIComponent(q)}&page_size=200`,
      );
      setRows(r.items);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperuser) return;
    const h = setTimeout(() => load(search), search ? 250 : 0);
    return () => clearTimeout(h);
  }, [isSuperuser, search, load]);

  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{t("owner.notYours.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("owner.notYours.body")}</p>
      </div>
    );
  }

  const money = (v: string | null) => (v == null ? "—" : `$${v}`);

  async function submitCreate() {
    setBusy(true);
    try {
      await http.post(`/api/owner/organizations`, {
        body: {
          name: createForm.name,
          admin_email: createForm.admin_email || null,
          per_minute_rate: createForm.per_minute_rate || null,
        },
      });
      toast.success(t("owner.orgs.created"));
      setCreateOpen(false);
      setCreateForm({ name: "", admin_email: "", per_minute_rate: "" });
      load(search);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function openFees(org: OrgRow) {
    setFeesFor(org);
    try {
      const d = await http.get<{ billing: Record<string, string> }>(
        `/api/owner/organizations/${org.id}`,
      );
      setFeeForm(
        Object.fromEntries(FEE_FIELDS.map((f) => [f, d.billing[f] ?? ""])) as Record<FeeField, string>,
      );
    } catch (e) {
      toast.error(errText(e));
      setFeesFor(null);
    }
  }

  async function submitFees() {
    if (!feesFor) return;
    setBusy(true);
    try {
      await http.patch(`/api/owner/organizations/${feesFor.id}`, { body: feeForm });
      toast.success(t("owner.orgs.saved"));
      setFeesFor(null);
      load(search);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitMoney() {
    if (!moneyFor) return;
    setBusy(true);
    try {
      const r = await http.post<{ balance: string }>(
        `/api/owner/organizations/${moneyFor.org.id}/${moneyFor.direction}`,
        { body: { amount: moneyForm.amount, note: moneyForm.note } },
      );
      toast.success(`${t("owner.orgs.moved")} — $${r.balance}`);
      setMoneyFor(null);
      setMoneyForm({ amount: "", note: "" });
      load(search);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitSuspend() {
    if (!suspendFor) return;
    setBusy(true);
    try {
      await http.post(
        `/api/owner/organizations/${suspendFor.id}/${suspendFor.is_active ? "suspend" : "activate"}`,
        { body: {} },
      );
      toast.success(t("owner.orgs.saved"));
      setSuspendFor(null);
      load(search);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <PageHeader title={t("owner.orgs.title")} description={t("owner.description")} />

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("owner.orgs.searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("owner.orgs.newOrg")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("owner.orgs.name")}</TableHead>
                <TableHead>{t("owner.orgs.status")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.balance")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.rate")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.markup")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.users")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.callsToday")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.revenueToday")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id} className={o.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.is_active ? "secondary" : "destructive"}>
                      {o.is_active ? t("owner.orgs.active") : t("owner.orgs.suspended")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.per_minute_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.markup_percent == null ? "—" : `${o.markup_percent}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.users}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.calls_today}</TableCell>
                  <TableCell className="text-right tabular-nums">${o.revenue_today}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openFees(o)}>
                          {t("owner.orgs.editRates")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMoneyFor({ org: o, direction: "credit" })}>
                          {t("owner.orgs.credit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMoneyFor({ org: o, direction: "debit" })}>
                          {t("owner.orgs.debit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={o.is_active ? "text-destructive" : ""}
                          onClick={() => setSuspendFor(o)}
                        >
                          {o.is_active ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {t("owner.orgs.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={(v) => !busy && setCreateOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4" /> {t("owner.orgs.newOrg")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("owner.orgs.orgName")}</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("owner.orgs.adminEmail")}</Label>
              <Input
                type="email"
                value={createForm.admin_email}
                onChange={(e) => setCreateForm({ ...createForm, admin_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("owner.orgs.fees.per_minute_rate")}</Label>
              <Input
                inputMode="decimal"
                placeholder="0.4500"
                value={createForm.per_minute_rate}
                onChange={(e) => setCreateForm({ ...createForm, per_minute_rate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy || !createForm.name.trim()} onClick={submitCreate}>
              {t("owner.orgs.newOrg")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rates & fees */}
      <Dialog open={feesFor != null} onOpenChange={(v) => !busy && !v && setFeesFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("owner.orgs.editRates")} — {feesFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {FEE_FIELDS.map((f) => (
              <div key={f} className="space-y-1.5">
                <Label className="text-xs">{t(`owner.orgs.fees.${f}`)}</Label>
                <Input
                  inputMode="decimal"
                  value={feeForm[f]}
                  onChange={(e) => setFeeForm({ ...feeForm, [f]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={submitFees}>
              {t("owner.orgs.saved")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit / debit */}
      <Dialog open={moneyFor != null} onOpenChange={(v) => !busy && !v && setMoneyFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {moneyFor?.direction === "credit" ? t("owner.orgs.credit") : t("owner.orgs.debit")} —{" "}
              {moneyFor?.org.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("owner.orgs.amount")}</Label>
              <Input
                inputMode="decimal"
                placeholder="25.00"
                value={moneyForm.amount}
                onChange={(e) => setMoneyForm({ ...moneyForm, amount: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("owner.orgs.note")}</Label>
              <Input
                value={moneyForm.note}
                onChange={(e) => setMoneyForm({ ...moneyForm, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy || !moneyForm.amount.trim()} onClick={submitMoney}>
              {moneyFor?.direction === "credit" ? t("owner.orgs.credit") : t("owner.orgs.debit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / activate */}
      <AlertDialog open={suspendFor != null} onOpenChange={(v) => !busy && !v && setSuspendFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendFor?.is_active
                ? t("owner.orgs.suspendTitle")
                : `${t("owner.orgs.activate")} — ${suspendFor?.name}`}
            </AlertDialogTitle>
            {suspendFor?.is_active && (
              <AlertDialogDescription>{t("owner.orgs.suspendBody")}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={submitSuspend}>
              {suspendFor?.is_active ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
