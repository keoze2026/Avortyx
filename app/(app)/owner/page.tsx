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
import { Crown, MoreHorizontal, Plus, Search, ShieldX, Trash2 } from "lucide-react";
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
  DropdownMenuSeparator,
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

// The http client turns every response key into camelCase, so the row is typed
// the way it arrives. It was typed snake_case before, which read every field
// as undefined: every organization showed Suspended, and the rate, markup and
// today's figures were blank.
interface OrgRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  users: number;
  balance: string | null;
  perMinuteRate: string | null;
  markupPercent: string | null;
  billingStatus: string | null;
  callsToday: number;
  revenueToday: string;
}

/** What deleting an organization would remove, and whether it is allowed. */
interface DeletePreview {
  id: string;
  name: string;
  slug: string;
  blocked: string | null;
  users: number;
  phoneNumbers: number;
  campaigns: number;
  calls: number;
  lastCall: string | null;
  balance: string | null;
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

/** per_minute_rate -> perMinuteRate, to read a response the client camelCased. */
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

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
  const [deleteFor, setDeleteFor] = useState<OrgRow | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");
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
      // The billing keys arrive camelCased; read them that way or the form opens blank.
      setFeeForm(
        Object.fromEntries(FEE_FIELDS.map((f) => [f, d.billing[camel(f)] ?? ""])) as Record<FeeField, string>,
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
        `/api/owner/organizations/${suspendFor.id}/${suspendFor.isActive ? "suspend" : "activate"}`,
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

  async function openDelete(org: OrgRow) {
    setDeleteFor(org);
    setDeletePreview(null);
    setDeleteTyped("");
    try {
      setDeletePreview(await http.get<DeletePreview>(`/api/owner/organizations/${org.id}/delete-preview`));
    } catch (e) {
      toast.error(errText(e));
      setDeleteFor(null);
    }
  }

  async function submitDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await http.delete(
        `/api/owner/organizations/${deleteFor.id}?confirm=${encodeURIComponent(deleteTyped.trim())}`,
      );
      toast.success(t("owner.orgs.deleted"));
      setDeleteFor(null);
      setDeletePreview(null);
      load(search);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const canDelete =
    deleteFor != null &&
    deletePreview != null &&
    !deletePreview.blocked &&
    deleteTyped.trim() === deleteFor.name;

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
                <TableRow key={o.id} className={o.isActive ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.isActive ? "secondary" : "destructive"}>
                      {o.isActive ? t("owner.orgs.active") : t("owner.orgs.suspended")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.perMinuteRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.markupPercent == null ? "—" : `${o.markupPercent}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.users}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.callsToday}</TableCell>
                  <TableCell className="text-right tabular-nums">${o.revenueToday}</TableCell>
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
                          className={o.isActive ? "text-destructive" : ""}
                          onClick={() => setSuspendFor(o)}
                        >
                          {o.isActive ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => openDelete(o)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("owner.orgs.delete")}
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
              {suspendFor?.isActive
                ? t("owner.orgs.suspendTitle")
                : `${t("owner.orgs.activate")} — ${suspendFor?.name}`}
            </AlertDialogTitle>
            {suspendFor?.isActive && (
              <AlertDialogDescription>{t("owner.orgs.suspendBody")}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("y.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={submitSuspend}>
              {suspendFor?.isActive ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: permanent, so it shows what goes and asks for the name back */}
      <Dialog open={deleteFor != null} onOpenChange={(v) => !busy && !v && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> {t("owner.orgs.deleteTitle")} — {deleteFor?.name}
            </DialogTitle>
          </DialogHeader>
          {!deletePreview ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("owner.orgs.deleteBody")}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
                <dt className="text-muted-foreground">{t("owner.orgs.users")}</dt>
                <dd className="text-right tabular-nums">{deletePreview.users}</dd>
                <dt className="text-muted-foreground">{t("owner.orgs.numbers")}</dt>
                <dd className="text-right tabular-nums">{deletePreview.phoneNumbers}</dd>
                <dt className="text-muted-foreground">{t("owner.orgs.campaigns")}</dt>
                <dd className="text-right tabular-nums">{deletePreview.campaigns}</dd>
                <dt className="text-muted-foreground">{t("owner.orgs.calls")}</dt>
                <dd className="text-right tabular-nums">{deletePreview.calls}</dd>
                <dt className="text-muted-foreground">{t("owner.orgs.lastCall")}</dt>
                <dd className="text-right tabular-nums">
                  {deletePreview.lastCall ? new Date(deletePreview.lastCall).toLocaleDateString() : "—"}
                </dd>
                <dt className="text-muted-foreground">{t("owner.orgs.balance")}</dt>
                <dd className="text-right tabular-nums">{money(deletePreview.balance)}</dd>
              </dl>
              {deletePreview.blocked ? (
                <p className="text-sm font-medium text-destructive">{deletePreview.blocked}</p>
              ) : (
                <div className="space-y-1.5">
                  <Label>
                    {t("owner.orgs.deleteType")} <span className="font-semibold">{deleteFor?.name}</span>
                  </Label>
                  <Input
                    value={deleteTyped}
                    onChange={(e) => setDeleteTyped(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleteFor(null)}>
              {t("y.common.cancel")}
            </Button>
            <Button variant="destructive" disabled={busy || !canDelete} onClick={submitDelete}>
              {t("owner.orgs.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
