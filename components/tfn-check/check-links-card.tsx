"use client";

/**
 * Share links for TFN Check (CH-214). Each link opens the public check page
 * with no login, like XOLO's lookup link. A link made for a publisher only
 * answers for that publisher's numbers. Cancelling a link stops it at once.
 * The same link is the API: POST the numbers to it and read the JSON back.
 */
import * as React from "react";
import { Ban, Code2, Copy, ExternalLink, Link2, Loader2, Plus } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { API_BASE_URL } from "@/lib/api/env";
import { ApiError } from "@/lib/api/errors";
import { tfnCheckService, type TfnCheckLink } from "@/lib/api/services/tfn-check.service";
import { formatRelativeTime } from "@/lib/format";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/** The backend's public check URL for a link (what scripts POST to). */
function apiUrlFor(link: TfnCheckLink): string {
  return `${API_BASE_URL}/api/public/tfn-check/${link.token}`;
}

export function CheckLinksCard({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [links, setLinks] = React.useState<TfnCheckLink[] | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<TfnCheckLink | null>(null);
  const [apiFor, setApiFor] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLinks(await tfnCheckService.listLinks());
    } catch {
      setLinks([]);
      toast.error(t("tfnCheck.links.loadFailed"));
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("tfnCheck.links.copied"));
    } catch {
      toast.error(t("tfnCheck.copyFailed"));
    }
  };

  const revoke = async (link: TfnCheckLink) => {
    try {
      const updated = await tfnCheckService.revokeLink(link.id);
      setLinks((ls) => (ls ?? []).map((l) => (l.id === link.id ? updated : l)));
      toast.success(t("tfnCheck.links.revoked").replace("{name}", link.name));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.friendlyMessage : t("tfnCheck.links.revokeFailed"));
    } finally {
      setRevoking(null);
    }
  };

  const apiLink = links?.find((l) => l.id === apiFor) ?? null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("tfnCheck.links.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("tfnCheck.links.description")}</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("tfnCheck.links.create")}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {links === null ? (
          <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("tfnCheck.public.loading")}
          </div>
        ) : links.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            <Link2 className="mx-auto mb-2 h-5 w-5" />
            {t("tfnCheck.links.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 text-[10px] uppercase tracking-wider">{t("tfnCheck.links.name")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{t("tfnCheck.links.scope")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{t("tfnCheck.links.created")}</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">{t("tfnCheck.links.lastUsed")}</TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("tfnCheck.links.uses")}</TableHead>
                  <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("tfnCheck.links.status")}</TableHead>
                  <TableHead className="pr-5 text-right text-[10px] uppercase tracking-wider">{t("tfnCheck.links.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id} className={cn(!l.active && "opacity-60")}>
                    <TableCell className="pl-5 text-xs font-medium">{l.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.publisherName ?? t("tfnCheck.links.allNumbers")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatRelativeTime(new Date(l.createdAt).getTime())}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {l.lastUsedAt ? formatRelativeTime(new Date(l.lastUsedAt).getTime()) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{l.useCount}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                          l.active
                            ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                            : "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {l.active ? t("tfnCheck.links.active") : t("tfnCheck.links.cancelled")}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-0.5">
                        {l.active && (
                          <>
                            <Button variant="ghost" size="icon-sm" title={t("tfnCheck.links.copy")} onClick={() => void copy(l.url)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" title={t("tfnCheck.links.open")} asChild>
                              <a href={l.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={t("tfnCheck.links.api")}
                              onClick={() => setApiFor((id) => (id === l.id ? null : l.id))}
                            >
                              <Code2 className="h-3.5 w-3.5" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                title={t("tfnCheck.links.revoke")}
                                onClick={() => setRevoking(l)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {apiLink && apiLink.active && (
          <div className="space-y-2 border-t border-border bg-muted/20 px-5 py-4">
            <div className="text-xs font-medium">
              {t("tfnCheck.links.apiTitle").replace("{name}", apiLink.name)}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("tfnCheck.links.apiBody")}</p>
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
{`curl -X POST '${apiUrlFor(apiLink)}' \\
  -H 'Content-Type: application/json' \\
  -d '{"numbers": ["+18888910563", "+18888910564"]}'`}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void copy(
                  `curl -X POST '${apiUrlFor(apiLink)}' -H 'Content-Type: application/json' -d '{"numbers": ["+18888910563"]}'`,
                )
              }
            >
              <Copy className="h-3.5 w-3.5" /> {t("tfnCheck.links.copyCurl")}
            </Button>
          </div>
        )}
      </Card>

      <CreateLinkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(link) => {
          setLinks((ls) => [link, ...(ls ?? [])]);
          void copy(link.url);
        }}
      />

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tfnCheck.links.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tfnCheck.links.revokeBody").replace("{name}", revoking?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("tfnCheck.links.keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => revoking && void revoke(revoking)}
            >
              {t("tfnCheck.links.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CreateLinkDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: TfnCheckLink) => void;
}) {
  const { t } = useTranslation();
  const publishers = usePublishersStore((s) => s.publishers);
  const fetchPublishers = usePublishersStore((s) => s.fetch);
  const [name, setName] = React.useState("");
  const [publisherId, setPublisherId] = React.useState<string>(ALL);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setPublisherId(ALL);
      if (publishers.length === 0) void fetchPublishers();
    }
  }, [open, publishers.length, fetchPublishers]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t("tfnCheck.links.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const link = await tfnCheckService.createLink({
        name: name.trim(),
        publisherId: publisherId === ALL ? null : publisherId,
      });
      onCreated(link);
      toast.success(t("tfnCheck.links.createdToast"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.friendlyMessage : t("tfnCheck.links.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tfnCheck.links.createTitle")}</DialogTitle>
          <DialogDescription>{t("tfnCheck.links.createBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tfn-link-name" className="text-xs">{t("tfnCheck.links.name")}</Label>
            <Input
              id="tfn-link-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("tfnCheck.links.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("tfnCheck.links.scope")}</Label>
            <Select value={publisherId} onValueChange={setPublisherId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("tfnCheck.links.allNumbers")}</SelectItem>
                {publishers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t("tfnCheck.links.scopeHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("tfnCheck.links.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("tfnCheck.links.createAndCopy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
