"use client";

/**
 * CH-675: the owner's actions on one organization - Edit rates & fees (with
 * the account type and the call limit), Adjust balance (credit / debit),
 * Suspend / Activate, Delete, and the new Message client - as one hook, so
 * the Organizations list and the account page offer exactly the same ones.
 *
 * Moved here unchanged from app/(app)/owner/page.tsx (the list page before
 * CH-675); only Message client and the credit / debit choice inside "Adjust
 * balance" are new. Backend: /api/owner/organizations/{id}/...
 */

import { useState } from "react";
import { Crown, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { formatLocalDate } from "@/lib/format";
import { tFor } from "@/lib/i18n";
import { useLocalName } from "@/lib/i18n/local-name";
import { useLocaleStore } from "@/lib/store/locale-store";

/** The least an action needs to know about the organization. */
export interface OrgRef {
  id: string;
  name: string;
  isActive: boolean;
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

/**
 * CH-665 (Sir, 11 Nov): the prices an account's type fills in, one time,
 * until changed - the same as the backend's CUSTOMER_TFN_PRICES. Picking a
 * type puts them in the form; they can still be edited before saving.
 */
const TYPE_PRICES: Record<"high" | "low", { tfn_purchase_fee: string; per_minute_rate: string }> = {
  high: { tfn_purchase_fee: "20.00", per_minute_rate: "0.0400" },
  low: { tfn_purchase_fee: "10.00", per_minute_rate: "0.0350" },
};

export const FEE_FIELDS = [
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
export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function errText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return tFor(useLocaleStore.getState().locale, "x1.carrierCosts.genericError");
}

const money = (v: string | null | undefined) => (v == null ? "—" : `$${v}`);

/**
 * `onDone` runs after any change was saved (reload the list or the page).
 * `onDeleted` runs after a delete (the account page leaves for the list).
 */
export function useOrgActions(onDone: () => void, onDeleted?: () => void) {
  const { t } = useTranslation();
  const localName = useLocalName();

  const [feesFor, setFeesFor] = useState<OrgRef | null>(null);
  const [feeForm, setFeeForm] = useState<Record<FeeField, string>>(
    Object.fromEntries(FEE_FIELDS.map((f) => [f, ""])) as Record<FeeField, string>,
  );
  // CH-655 (customer accounts point 6): the account's limit on live calls
  // (0 = no limit). Our own account is never limited, so it shows no field.
  const [callLimit, setCallLimit] = useState("");
  const [limitIsOurs, setLimitIsOurs] = useState(false);
  // CH-665: the account's type ("none" = not set; Select items cannot be "").
  const [tfnRisk, setTfnRisk] = useState("none");
  const [moneyFor, setMoneyFor] = useState<{ org: OrgRef; direction: "credit" | "debit" } | null>(null);
  const [moneyForm, setMoneyForm] = useState({ amount: "", note: "" });
  const [suspendFor, setSuspendFor] = useState<OrgRef | null>(null);
  const [deleteFor, setDeleteFor] = useState<OrgRef | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [messageFor, setMessageFor] = useState<OrgRef | null>(null);
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState(false);

  async function openFees(org: OrgRef) {
    setFeesFor(org);
    try {
      const d = await http.get<{
        billing: Record<string, string>;
        maxConcurrentCalls?: number;
        isMainAccount?: boolean;
        tfnRisk?: string;
      }>(`/api/owner/organizations/${org.id}`);
      setCallLimit(String(d.maxConcurrentCalls ?? 0));
      setLimitIsOurs(d.isMainAccount === true);
      setTfnRisk(d.tfnRisk || "none");
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
      await http.patch(`/api/owner/organizations/${feesFor.id}`, {
        body: limitIsOurs
          ? feeForm
          : {
              ...feeForm,
              max_concurrent_calls: callLimit.trim() || "0",
              tfn_risk: tfnRisk === "none" ? "" : tfnRisk,
            },
      });
      toast.success(t("owner.orgs.saved"));
      setFeesFor(null);
      onDone();
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
      onDone();
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
      onDone();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function openDelete(org: OrgRef) {
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
      (onDeleted ?? onDone)();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!messageFor) return;
    setBusy(true);
    try {
      await http.post(`/api/owner/organizations/${messageFor.id}/message`, {
        body: { text: messageText.trim() },
      });
      toast.success(t("x675.message.sent"));
      setMessageFor(null);
      setMessageText("");
      onDone();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  function pickType(v: string) {
    setTfnRisk(v);
    if (v === "high" || v === "low") setFeeForm((f) => ({ ...f, ...TYPE_PRICES[v] }));
  }

  const canDelete =
    deleteFor != null &&
    deletePreview != null &&
    !deletePreview.blocked &&
    deleteTyped.trim() === deleteFor.name;

  const dialogs = (
    <>
      {/* Rates & fees */}
      <Dialog open={feesFor != null} onOpenChange={(v) => !busy && !v && setFeesFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("owner.orgs.editRates")} — {localName(feesFor?.name)}
            </DialogTitle>
          </DialogHeader>
          {!limitIsOurs && (
            <div className="space-y-1.5 border-b pb-3">
              <Label className="text-xs">{t("x665.owner.type")}</Label>
              <Select value={tfnRisk} onValueChange={pickType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("x665.type.none")}</SelectItem>
                  <SelectItem value="high">{t("x665.type.high")}</SelectItem>
                  <SelectItem value="low">{t("x665.type.low")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("x665.owner.typeHint")}</p>
            </div>
          )}
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
          {!limitIsOurs && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs">{t("x655.callLimit")}</Label>
              <Input
                inputMode="numeric"
                value={callLimit}
                onChange={(e) => setCallLimit(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">{t("x655.callLimitHint")}</p>
            </div>
          )}
          <DialogFooter>
            <Button disabled={busy} onClick={submitFees}>
              {t("owner.orgs.saved")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust balance: credit / debit */}
      <Dialog open={moneyFor != null} onOpenChange={(v) => !busy && !v && setMoneyFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("x675.adjustBalance")} — {localName(moneyFor?.org.name)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["credit", "debit"] as const).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={moneyFor?.direction === d ? "default" : "outline"}
                  onClick={() => moneyFor && setMoneyFor({ ...moneyFor, direction: d })}
                >
                  {d === "credit" ? t("owner.orgs.credit") : t("owner.orgs.debit")}
                </Button>
              ))}
            </div>
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
                : `${t("owner.orgs.activate")} — ${localName(suspendFor?.name)}`}
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
              <Trash2 className="h-4 w-4" /> {t("owner.orgs.deleteTitle")} — {localName(deleteFor?.name)}
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
                  {deletePreview.lastCall ? formatLocalDate(deletePreview.lastCall) : "—"}
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

      {/* CH-675: Message client - shown at the top of their portal until they click Seen */}
      <Dialog open={messageFor != null} onOpenChange={(v) => !busy && !v && setMessageFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> {t("x675.message.title")} — {localName(messageFor?.name)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              rows={5}
              maxLength={1000}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t("x675.message.placeholder")}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t("x675.message.hint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setMessageFor(null)}>
              {t("y.common.cancel")}
            </Button>
            <Button disabled={busy || !messageText.trim()} onClick={submitMessage}>
              {t("x675.message.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return {
    openFees,
    openMoney: (org: OrgRef, direction: "credit" | "debit" = "credit") => setMoneyFor({ org, direction }),
    openSuspend: (org: OrgRef) => setSuspendFor(org),
    openDelete,
    openMessage: (org: OrgRef) => {
      setMessageText("");
      setMessageFor(org);
    },
    dialogs,
  };
}

/** The Create dialog, unchanged from the list page before CH-675. */
export function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [createForm, setCreateForm] = useState({ name: "", admin_email: "", per_minute_rate: "" });
  const [busy, setBusy] = useState(false);

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
      onOpenChange(false);
      setCreateForm({ name: "", admin_email: "", per_minute_rate: "" });
      onCreated();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
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
  );
}
