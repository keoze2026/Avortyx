"use client";

/**
 * The Members table shared by the Publisher and Buyer settings tabs.
 *
 * Status shows "Invited" (grey) until the person has accepted the invitation
 * and signed in, then "Registered" in blue - so the main account can see at a
 * glance who has actually joined. The status comes from
 * lib/partner-registration.ts and refreshes by itself.
 *
 * Removing a member ends their access on the server (after a confirmation);
 * if the server cannot do that yet, the row is removed and the user is told
 * plainly that the person's login still works.
 */

import * as React from "react";
import { Filter, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { friendlyErrorMessage } from "@/lib/api/errors";
import type { RemoveOutcome } from "@/lib/partner-access";
import type { InviteStatus } from "@/lib/partner-registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PartnerMemberRow {
  id: string;
  email: string;
  /** The person accepted the invitation and has signed in. */
  registered: boolean;
  /** "revoked" = their access was removed (shown as "Access removed"). */
  status?: InviteStatus;
  /** Their most recent login (ms since epoch), if known. */
  lastLoginAt: number | null;
  /** The partner's own contact email can't be removed from this list. */
  canRemove: boolean;
}

/** Every piece of text the table shows, so each caller can supply its own wording. */
export interface PartnerMembersLabels {
  title: string;
  description: string;
  searchAria: string;
  searchPlaceholder: string;
  filterAria: string;
  filterSoon: string;
  invite: string;
  invitePlaceholder: string;
  sendInvite: string;
  cancel: string;
  email: string;
  status: string;
  actions: string;
  noData: string;
  invalidEmail: string;
  invitedToast: (email: string) => string;
  removedToast: (email: string) => string;
  removeAria: (email: string) => string;
}

interface Props {
  rows: PartnerMemberRow[];
  labels: PartnerMembersLabels;
  /** Send the invitation. Throw to report a failure. */
  onInvite: (email: string) => Promise<void>;
  /** Remove this person's access. Throw to report a failure. */
  onRemove: (id: string) => Promise<RemoveOutcome | void> | RemoveOutcome | void;
}

export function PartnerMembersSection({ rows, labels, onInvite, onRemove }: Props) {
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  /** Row waiting for "Remove access?" confirmation, and the row being removed. */
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const confirmRemove = async (m: PartnerMemberRow) => {
    setRemovingId(m.id);
    try {
      const outcome = await onRemove(m.id);
      if (outcome === "local-only") {
        toast.warning(`Removed ${m.email} from this list`, {
          description: "Their sign-in still works: the server cannot remove access yet.",
        });
      } else {
        toast.success(labels.removedToast(m.email));
      }
      setConfirmId(null);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, `Couldn't remove ${m.email}. Please try again.`));
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((m) => m.email.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const submitInvite = async () => {
    const trimmed = inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error(labels.invalidEmail);
      return;
    }
    setSending(true);
    try {
      await onInvite(trimmed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the invite");
      return;
    } finally {
      setSending(false);
    }
    toast.success(labels.invitedToast(trimmed));
    setInviteEmail("");
    setInviteOpen(false);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background/30">
      <header className="px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {labels.title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{labels.description}</p>
      </header>

      <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={labels.searchAria}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => toast.info(labels.filterSoon)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={labels.filterAria}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
        <Button size="sm" variant="default" onClick={() => setInviteOpen((v) => !v)}>
          {labels.invite}
        </Button>
      </div>

      {searchOpen && (
        <div className="px-4 pb-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="h-8"
          />
        </div>
      )}

      {inviteOpen && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-border bg-secondary/30 p-2">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitInvite();
              }
            }}
            placeholder={labels.invitePlaceholder}
            className="h-8"
            autoFocus
          />
          <Button size="sm" onClick={() => void submitInvite()} disabled={sending}>
            {labels.sendInvite}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setInviteOpen(false);
              setInviteEmail("");
            }}
          >
            {labels.cancel}
          </Button>
        </div>
      )}

      <div className="overflow-hidden border-t border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 text-left">{labels.email}</TableHead>
              <TableHead className="text-left">{labels.status}</TableHead>
              <TableHead className="pr-4 text-right">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  {labels.noData}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4 text-left font-medium">{m.email}</TableCell>
                  <TableCell className="text-left">
                    {m.status === "revoked" ? (
                      <Badge
                        variant="outline"
                        data-status="revoked"
                        title="Their access was removed. Invite them again to give it back."
                        className="border-destructive/40 bg-destructive/10 font-medium text-destructive"
                      >
                        Access removed
                      </Badge>
                    ) : m.registered ? (
                      <Badge
                        variant="outline"
                        data-status="registered"
                        title={
                          m.lastLoginAt
                            ? `Accepted the invitation. Last login: ${new Date(m.lastLoginAt).toLocaleString()}`
                            : "Accepted the invitation"
                        }
                        className="border-accent/40 bg-accent/10 font-medium text-accent"
                      >
                        Registered
                      </Badge>
                    ) : (
                      <Badge variant="outline" data-status="invited" title="Invitation sent, not accepted yet">
                        Invited
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {m.canRemove && confirmId === m.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Remove access?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-[11px]"
                          disabled={removingId === m.id}
                          onClick={() => void confirmRemove(m)}
                        >
                          {removingId === m.id ? "Removing…" : "Remove"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          disabled={removingId === m.id}
                          onClick={() => setConfirmId(null)}
                        >
                          Keep
                        </Button>
                      </span>
                    ) : m.canRemove ? (
                      <button
                        type="button"
                        onClick={() => setConfirmId(m.id)}
                        aria-label={labels.removeAria(m.email)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Shows <span className="font-medium text-accent">Registered</span> once the person has accepted their
        latest invitation and signed in. This list checks for that by itself. Inviting someone again starts them
        from scratch.
      </p>
    </section>
  );
}
