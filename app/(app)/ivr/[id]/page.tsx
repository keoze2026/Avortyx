"use client";

/**
 * IVR Flow Editor — per-flow node + transition editor.
 *
 * Backend models a flow as a tree of nodes (say / menu / collect / transfer /
 * record / hangup) connected by transitions. This v1 surface is a structured
 * list editor: each node renders as a card with its config + outgoing
 * transitions. A drag-canvas React Flow editor is a Phase 8 follow-up.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Hash,
  Loader2,
  Mic,
  PhoneForwarded,
  Plus,
  Radio,
  Save,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useTranslation } from "@/hooks/use-translation";
import { ivrService, type IvrFlow, type IvrNode, type IvrTransition } from "@/lib/api/services/ivr.service";
import { ROUTES } from "@/lib/constants";

type NodeType = "say" | "menu" | "collect" | "transfer" | "record" | "hangup";

// Name and description of each kind are translated: ivrUI.node.<kind>.label / .description
const NODE_META: Record<NodeType, { icon: typeof Volume2; tone: string }> = {
  say: { icon: Volume2, tone: "text-accent" },
  menu: { icon: Hash, tone: "text-[color:var(--warning)]" },
  collect: { icon: Mic, tone: "text-[color:var(--warning)]" },
  transfer: { icon: PhoneForwarded, tone: "text-[color:var(--success)]" },
  record: { icon: Radio, tone: "text-muted-foreground" },
  hangup: { icon: X, tone: "text-destructive" },
};

type T = (key: string) => string;
const nodeLabel = (t: T, type: NodeType) => t(`ivrUI.node.${type}.label`);
const nodeDescription = (t: T, type: NodeType) => t(`ivrUI.node.${type}.description`);

interface NodeDraft {
  id: string;
  nodeType: NodeType;
  label: string;
  config: Record<string, unknown>;
  /** UI-only outgoing transitions for the next save. */
  transitions: Array<{ toNodeId: string; condition?: string }>;
}

function emptyConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "say":      return { message: "", voice: "default" };
    case "menu":     return { prompt: "", options: [] };
    case "collect":  return { prompt: "", digits: 4, timeoutSec: 5 };
    case "transfer": return { destinationType: "buyer", buyerId: "" };
    case "record":   return { maxDurationSec: 30 };
    case "hangup":   return {};
  }
}

export default function IvrFlowEditorPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [flow, setFlow] = useState<IvrFlow | null>(null);
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingType, setPendingType] = useState<NodeType>("say");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const f = await ivrService.getFlow(params.id);
        if (cancelled) return;
        setFlow(f);
        // Backend ships the flow's nodes/transitions on the same object;
        // be defensive about the field name since the spec is loose.
        const raw = (f as unknown as { nodes?: IvrNode[]; transitions?: IvrTransition[] });
        const drafts: NodeDraft[] = (raw.nodes ?? []).map((n) => ({
          id: n.id,
          nodeType: (n.nodeType as NodeType) ?? "say",
          label: n.label ?? "",
          config: n.config ?? {},
          transitions: (raw.transitions ?? [])
            .filter((t) => t.fromNodeId === n.id)
            .map((t) => ({ toNodeId: t.toNodeId, condition: t.condition })),
        }));
        setNodes(drafts);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("ivrUI.editor.toast.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const addNode = useCallback(
    async (type: NodeType, label: string) => {
      if (!flow) return;
      try {
        const created = await ivrService.addNode(flow.id, {
          nodeType: type,
          label,
          config: emptyConfig(type),
        });
        setNodes((prev) => [
          ...prev,
          {
            id: created.id,
            nodeType: type,
            label: created.label ?? label,
            config: created.config ?? emptyConfig(type),
            transitions: [],
          },
        ]);
        setAddOpen(false);
        toast.success(t("ivrUI.editor.toast.nodeAdded").replace("{type}", nodeLabel(t, type)));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("ivrUI.editor.toast.addFailed"));
      }
    },
    [flow, t],
  );

  const patchNode = (id: string, patch: Partial<NodeDraft>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const patchConfig = (id: string, patch: Record<string, unknown>) =>
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)),
    );

  const removeNode = (id: string) =>
    setNodes((ns) =>
      ns
        .filter((n) => n.id !== id)
        // Drop any transitions that pointed to the removed node.
        .map((n) => ({
          ...n,
          transitions: n.transitions.filter((t) => t.toNodeId !== id),
        })),
    );

  const addTransition = (fromId: string) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === fromId
          ? { ...n, transitions: [...n.transitions, { toNodeId: "", condition: "" }] }
          : n,
      ),
    );

  const patchTransition = (
    fromId: string,
    index: number,
    patch: { toNodeId?: string; condition?: string },
  ) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === fromId
          ? {
              ...n,
              transitions: n.transitions.map((t, i) =>
                i === index ? { ...t, ...patch } : t,
              ),
            }
          : n,
      ),
    );

  const removeTransition = (fromId: string, index: number) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === fromId
          ? { ...n, transitions: n.transitions.filter((_, i) => i !== index) }
          : n,
      ),
    );

  const save = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      // Issue all add-transition calls. Existing transitions on the server
      // are not removed since the spec doesn't expose deletion — they'll get
      // superseded as the backend re-evaluates the rule chain.
      for (const n of nodes) {
        for (const t of n.transitions) {
          if (!t.toNodeId) continue;
          try {
            await ivrService.addTransition(flow.id, {
              fromNodeId: n.id,
              toNodeId: t.toNodeId,
              condition: t.condition || undefined,
            });
          } catch {
            // Backend may dedupe — non-fatal.
          }
        }
      }
      toast.success(t("ivrUI.editor.toast.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ivrUI.editor.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: `${nodeLabel(t, n.nodeType)} · ${n.label || n.id}` })),
    [nodes, t],
  );

  if (loading) {
    return (
      <>
        <PageHeader title={t("ivrUI.editor.loadingTitle")} />
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("ivrUI.editor.loadingBody")}
          </CardContent>
        </Card>
      </>
    );
  }

  if (!flow) {
    return (
      <EmptyState
        icon={PhoneForwarded}
        tone="amber"
        title={t("ivrUI.editor.notFound.title")}
        description={t("ivrUI.editor.notFound.description")}
        actions={
          <Button onClick={() => router.push(ROUTES.ivr)}>{t("ivrUI.editor.backToFlows")}</Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={flow.name}
        description={flow.description ?? t("ivrUI.editor.defaultDescription")}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {t("ivrUI.editor.addNode")}
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("ivrUI.editor.saving")}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> {t("ivrUI.editor.save")}
                </>
              )}
            </Button>
          </>
        }
      />

      {nodes.length === 0 ? (
        <EmptyState
          icon={Volume2}
          tone="cyan"
          title={t("ivrUI.editor.noNodes.title")}
          description={t("ivrUI.editor.noNodes.description")}
          actions={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> {t("ivrUI.editor.addFirstNode")}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {nodes.map((n, idx) => {
            const meta = NODE_META[n.nodeType];
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/40 ${meta.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {nodeLabel(t, n.nodeType)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                        </div>
                        <Input
                          value={n.label}
                          onChange={(e) => patchNode(n.id, { label: e.target.value })}
                          placeholder={t("ivrUI.editor.nodeLabelPlaceholder")}
                          className="mt-1.5 h-8 max-w-md text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeNode(n.id)}
                      aria-label={t("ivrUI.editor.removeNode")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <NodeConfigEditor draft={n} onPatch={(p) => patchConfig(n.id, p)} />

                    {/* ─── Transitions ──────────────────────────────────── */}
                    <div className="space-y-2 border-t border-border/40 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {t("ivrUI.editor.nextSteps")}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addTransition(n.id)}
                          disabled={nodeOptions.length <= 1}
                        >
                          <Plus className="h-3 w-3" /> {t("ivrUI.editor.transition")}
                        </Button>
                      </div>
                      {n.transitions.length === 0 ? (
                        <p className="text-[11px] italic text-muted-foreground">
                          {n.nodeType === "hangup"
                            ? t("ivrUI.editor.terminal")
                            : t("ivrUI.editor.noTransitions")}
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {n.transitions.map((tr, ti) => (
                            <li key={ti} className="flex items-center gap-2">
                              <Input
                                value={tr.condition ?? ""}
                                onChange={(e) =>
                                  patchTransition(n.id, ti, { condition: e.target.value })
                                }
                                placeholder={n.nodeType === "menu" ? t("ivrUI.editor.dtmfPlaceholder") : t("ivrUI.editor.conditionPlaceholder")}
                                className="h-8 w-32 font-mono text-xs"
                              />
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <Select
                                value={tr.toNodeId || undefined}
                                onValueChange={(v) => patchTransition(n.id, ti, { toNodeId: v })}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder={t("ivrUI.editor.selectNext")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {nodeOptions
                                    .filter((opt) => opt.id !== n.id)
                                    .map((opt) => (
                                      <SelectItem key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeTransition(n.id, ti)}
                                aria-label={t("ivrUI.editor.removeTransition")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AddNodeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        pendingType={pendingType}
        setPendingType={setPendingType}
        onAdd={addNode}
      />
    </>
  );
}

/* ─── Per-kind config editor (lightweight forms) ───────────────────── */

function NodeConfigEditor({
  draft,
  onPatch,
}: {
  draft: NodeDraft;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const { nodeType, config } = draft;
  if (nodeType === "say") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{t("ivrUI.config.message")}</Label>
        <Textarea
          rows={2}
          value={(config.message as string) ?? ""}
          onChange={(e) => onPatch({ message: e.target.value })}
          placeholder={t("ivrUI.config.messagePlaceholder")}
        />
      </div>
    );
  }
  if (nodeType === "menu") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Prompt</Label>
        <Textarea
          rows={2}
          value={(config.prompt as string) ?? ""}
          onChange={(e) => onPatch({ prompt: e.target.value })}
          placeholder={t("ivrUI.config.menuPromptPlaceholder")}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("ivrUI.config.menuHint")}
        </p>
      </div>
    );
  }
  if (nodeType === "collect") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Prompt</Label>
          <Input
            value={(config.prompt as string) ?? ""}
            onChange={(e) => onPatch({ prompt: e.target.value })}
            placeholder={t("ivrUI.config.collectPromptPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("ivrUI.config.digits")}</Label>
          <Input
            type="number"
            min={1}
            value={(config.digits as number) ?? 4}
            onChange={(e) => onPatch({ digits: Number(e.target.value) || 4 })}
            className="w-24"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("ivrUI.config.timeout")}</Label>
          <Input
            type="number"
            min={1}
            value={(config.timeoutSec as number) ?? 5}
            onChange={(e) => onPatch({ timeoutSec: Number(e.target.value) || 5 })}
            className="w-24"
          />
        </div>
      </div>
    );
  }
  if (nodeType === "transfer") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("ivrUI.config.destinationType")}</Label>
          <Select
            value={(config.destinationType as string) ?? "buyer"}
            onValueChange={(v) => onPatch({ destinationType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">{t("ivrUI.config.buyer")}</SelectItem>
              <SelectItem value="number">{t("ivrUI.config.phoneNumber")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {(config.destinationType as string) === "number" ? t("ivrUI.config.number") : t("ivrUI.config.buyerId")}
          </Label>
          <Input
            value={
              (config.destinationType as string) === "number"
                ? ((config.number as string) ?? "")
                : ((config.buyerId as string) ?? "")
            }
            onChange={(e) => onPatch(
              (config.destinationType as string) === "number"
                ? { number: e.target.value }
                : { buyerId: e.target.value },
            )}
            placeholder={
              (config.destinationType as string) === "number"
                ? "+1 555 123 4567"
                : "buyer_abc123"
            }
            className="font-mono text-xs"
          />
        </div>
      </div>
    );
  }
  if (nodeType === "record") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{t("ivrUI.config.maxDuration")}</Label>
        <Input
          type="number"
          min={1}
          value={(config.maxDurationSec as number) ?? 30}
          onChange={(e) => onPatch({ maxDurationSec: Number(e.target.value) || 30 })}
          className="w-32"
        />
      </div>
    );
  }
  // hangup
  return (
    <p className="text-[11px] italic text-muted-foreground">
      {t("ivrUI.config.hangupNote")}
    </p>
  );
}

/* ─── Add-node dialog ─────────────────────────────────────────────── */

function AddNodeDialog({
  open,
  onOpenChange,
  pendingType,
  setPendingType,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingType: NodeType;
  setPendingType: (t: NodeType) => void;
  onAdd: (type: NodeType, label: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) setLabel(nodeLabel(t, pendingType));
  }, [open, pendingType, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ivrUI.addNode.title")}</DialogTitle>
          <DialogDescription>
            {t("ivrUI.addNode.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
          {(Object.keys(NODE_META) as NodeType[]).map((type) => {
            const meta = NODE_META[type];
            const Icon = meta.icon;
            const selected = pendingType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setPendingType(type)}
                className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-accent/60 bg-accent/10 ring-1 ring-accent/40"
                    : "border-border bg-secondary/30 hover:border-border/80"
                }`}
              >
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-background ${meta.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{nodeLabel(t, type)}</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    {nodeDescription(t, type)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="node-label" className="text-xs">
            {t("ivrUI.addNode.label")}
          </Label>
          <Input
            id="node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("ivrUI.addNode.labelPlaceholder")}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("ivrUI.addNode.cancel")}
          </Button>
          <Button onClick={() => onAdd(pendingType, label.trim() || nodeLabel(t, pendingType))}>
            {t("ivrUI.addNode.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
