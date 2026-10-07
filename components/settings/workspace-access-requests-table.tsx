"use client";

/**
 * Workspace > Access Requests — admin queue for the invite-only signup flow.
 *
 * Lists pending requests submitted via the marketing-site contact form.
 * Approving a request creates the user on the backend and triggers a setup
 * email (synchronous, may take a moment). Rejecting marks the request closed
 * and is recoverable via an optional reason.
 */

import * as React from "react";
import { Check, Inbox, Loader2, Mail, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/http";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  accessRequestsService,
  type AccessRequest,
  type AccessRequestStatus,
} from "@/lib/api/services/access-requests.service";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatLocalDate, formatLocalDateTime } from "@/lib/format";

/** True if the backend rejected an approve/reject call because the request is
 *  already in a terminal state. We treat this as success — the desired
 *  outcome (request closed) already exists on the backend. */
function isAlreadyDecidedError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status !== 400 && e.status !== 409) return false;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("already approved") || msg.includes("already rejected");
}

const STATUS_FILTERS: Array<{ id: AccessRequestStatus | "all"; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "buyer", label: "Buyer" },
  { value: "publisher", label: "Publisher" },
];

export function WorkspaceAccessRequestsTable() {
  const [filter, setFilter] = React.useState<AccessRequestStatus | "all">("pending");
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Synchronous double-submit guard. React state updates are async, so a
  // user clicking the dialog button twice in the same render frame could
  // fire two POSTs before `busyId` re-disables the button.
  const inFlightRef = React.useRef(false);

  // Reject confirmation dialog state.
  const [rejecting, setRejecting] = React.useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  // Approve dialog state — admin picks the role to provision before sending.
  const [approving, setApproving] = React.useState<AccessRequest | null>(null);
  const [approveRole, setApproveRole] = React.useState<Role>("buyer");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await accessRequestsService.list(
        filter === "all" ? undefined : { status: filter },
      );
      setRequests(list);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't load access requests."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onApprove = async () => {
    if (!approving || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusyId(approving.id);
    const target = approving;
    try {
      await accessRequestsService.approve(target.id, approveRole);
      toast.success(`${target.email} approved — setup email sent.`);
      setApproving(null);
      void load();
    } catch (e) {
      if (isAlreadyDecidedError(e)) {
        // Backend says the request is already approved — desired state already
        // exists, so treat it as success and refresh the list so the row
        // moves out of the pending bucket.
        toast.success("This request was already approved. Refreshing list.");
        setApproving(null);
        void load();
      } else {
        toast.error(friendlyErrorMessage(e, "Couldn't approve this request."));
      }
    } finally {
      setBusyId(null);
      inFlightRef.current = false;
    }
  };

  const onReject = async () => {
    if (!rejecting || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusyId(rejecting.id);
    const target = rejecting;
    try {
      await accessRequestsService.reject(target.id, rejectReason.trim() || undefined);
      toast.success(`${target.email} rejected.`);
      setRejecting(null);
      setRejectReason("");
      void load();
    } catch (e) {
      if (isAlreadyDecidedError(e)) {
        toast.success("This request was already closed. Refreshing list.");
        setRejecting(null);
        setRejectReason("");
        void load();
      } else {
        toast.error(friendlyErrorMessage(e, "Couldn't reject this request."));
      }
    } finally {
      setBusyId(null);
      inFlightRef.current = false;
    }
  };

  return (
    <>
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3 space-y-0">
          <div>
            <CardTitle className="text-base">Access requests</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Review and approve people requesting access to Avortyx. Approving
              creates the user and emails them a one-time setup link.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>

        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-border/80 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <CardContent className="p-0">
          {loading && requests.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading access requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Inbox className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-sm font-semibold">
                  No {filter === "all" ? "" : filter} requests
                </h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Prospects who submit the access form will appear here for
                  review.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-left">Person</TableHead>
                    <TableHead className="text-left">Company</TableHead>
                    <TableHead className="text-left">Use case</TableHead>
                    <TableHead className="text-left">Submitted</TableHead>
                    <TableHead className="text-left">Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{r.name || "—"}</div>
                        <a
                          href={`mailto:${r.email}`}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent"
                        >
                          <Mail className="h-3 w-3" />
                          {r.email}
                        </a>
                        {r.phone && (
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {r.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <span className="text-sm">{r.company || "—"}</span>
                      </TableCell>
                      <TableCell className="text-left">
                        <p className="line-clamp-2 max-w-[26ch] text-[12px] text-muted-foreground">
                          {r.useCase || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-left">
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {formatLocalDateTime(r.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={r.status} />
                        {r.status === "rejected" && r.rejectionReason && (
                          <p className="mt-1 max-w-[20ch] truncate text-[10px] text-muted-foreground">
                            {r.rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {r.status === "pending" ? (
                          <div className="inline-flex gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              disabled={busyId === r.id}
                              onClick={() => {
                                setRejecting(r);
                                setRejectReason("");
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={busyId === r.id}
                              onClick={() => {
                                setApproving(r);
                                setApproveRole("buyer");
                              }}
                            >
                              {busyId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                            {r.reviewedAt
                              ? formatLocalDate(r.reviewedAt)
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Approve dialog ─────────────────────────────────────────── */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve access request</DialogTitle>
            <DialogDescription>
              We&apos;ll create the user account and email{" "}
              <span className="font-mono text-foreground">{approving?.email}</span>{" "}
              a one-time link to set their password. The email is sent
              immediately and the link expires in 48 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Assign role</Label>
            <Select value={approveRole} onValueChange={(v) => setApproveRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              You can change this later from Workspace &gt; Members.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button onClick={onApprove} disabled={busyId !== null}>
              {busyId === approving?.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending email…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Approve &amp; send setup email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject dialog ──────────────────────────────────────────── */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject access request</DialogTitle>
            <DialogDescription>
              Mark this request as rejected. The reason is optional but useful
              if you reopen it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Outside of supported verticals, duplicate request, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={busyId !== null}
            >
              {busyId === rejecting?.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Rejecting…
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" />
                  Reject request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: AccessRequestStatus }) {
  const map: Record<AccessRequestStatus, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className:
        "bg-[oklch(0.82_0.16_75)]/15 text-[oklch(0.82_0.16_75)] border-[oklch(0.82_0.16_75)]/30",
    },
    approved: {
      label: "Approved",
      className:
        "bg-[oklch(0.78_0.18_155)]/15 text-[oklch(0.78_0.18_155)] border-[oklch(0.78_0.18_155)]/30",
    },
    rejected: {
      label: "Rejected",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const p = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        p.className,
      )}
    >
      {p.label}
    </span>
  );
}
