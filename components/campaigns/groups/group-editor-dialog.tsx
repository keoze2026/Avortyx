"use client";

/**
 * CH-328: create or edit a Campaign Group - its name and which campaigns are
 * in it. A campaign already in another group is shown but cannot be ticked:
 * one group per campaign, so two groups never set different priorities for
 * the same campaign's destination.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup } from "@/lib/api/services/campaign-groups.service";
import { useLocalName } from "@/lib/i18n/local-name";
import type { Campaign } from "@/lib/types/campaign";
import { fill, StatusDot } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new group. */
  group: CampaignGroup | null;
  groups: CampaignGroup[];
  campaigns: Campaign[];
  onSaved: () => void;
}

export function GroupEditorDialog({ open, onOpenChange, group, groups, campaigns, onSaved }: Props) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setNote(group?.description ?? "");
    setQuery("");
    setPicked(new Set(group?.campaigns.map((c) => c.id) ?? []));
  }, [open, group]);

  // Which other group each campaign is in.
  const owner = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      if (g.id === group?.id) continue;
      for (const c of g.campaigns) m.set(c.id, g.name);
    }
    return m;
  }, [groups, group]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .filter((c) => c.status !== "archived")
      .filter((c) => !q || c.name.toLowerCase().includes(q) || localName(c.name).toLowerCase().includes(q))
      .sort((a, b) => Number(owner.has(a.id)) - Number(owner.has(b.id)) || a.name.localeCompare(b.name));
  }, [campaigns, query, owner, localName]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    const clean = name.trim();
    if (!clean) {
      toast.error(t("cg.editor.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const body = { name: clean, description: note.trim(), campaignIds: [...picked] };
      if (group) await campaignGroups.update(group.id, body);
      else await campaignGroups.create(body);
      toast.success(fill(t("cg.editor.saved"), { name: clean }));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>
                {group ? fill(t("cg.editor.editTitle"), { name: group.name }) : t("cg.editor.newTitle")}
              </DialogTitle>
              <DialogDescription>{t("cg.editor.desc")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cg-name" className="text-xs font-medium">
              {t("cg.editor.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cg-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cg.editor.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-note" className="text-xs font-medium">{t("cg.editor.note")}</Label>
            <Input id="cg-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-medium">{t("cg.editor.campaigns")}</Label>
          <span className="text-xs text-muted-foreground">{fill(t("cg.editor.selected"), { n: picked.size })}</span>
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("cg.editor.search")} />
        <div className="min-h-[220px] flex-1 overflow-y-auto rounded-md border">
          {list.map((c) => {
            const other = owner.get(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 ${
                  other ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={picked.has(c.id)}
                  disabled={Boolean(other)}
                  onCheckedChange={() => toggle(c.id)}
                  aria-label={localName(c.name)}
                />
                <StatusDot status={c.status} />
                <span className="flex-1 truncate font-medium">{localName(c.name)}</span>
                {other && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {fill(t("cg.editor.inOther"), { name: other })}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cg.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {group ? t("cg.editor.save") : t("cg.editor.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
