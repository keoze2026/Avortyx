"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitFork } from "lucide-react";

import { RoutingCanvas } from "@/components/routing/routing-canvas";
import { RoutingInspector } from "@/components/routing/routing-inspector";
import { RoutingPalette } from "@/components/routing/routing-palette";
import { RoutingToolbar } from "@/components/routing/routing-toolbar";
import { TestCallerDialog } from "@/components/routing/test-caller-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useRoutingStore } from "@/lib/store/routing-store";
import type { RoutingEdge, RoutingNode, RoutingNodeData } from "@/lib/types";
import { ROUTES } from "@/lib/constants";

export default function RoutingEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const plan = useRoutingStore((s) => s.getById(params.id));
  const fetchOne = useRoutingStore((s) => s.fetchOne);
  const setGraph = useRoutingStore((s) => s.setGraph);
  const setStatus = useRoutingStore((s) => s.setStatus);
  const remove = useRoutingStore((s) => s.remove);
  const patchNodeData = useRoutingStore((s) => s.patchNodeData);

  useBreadcrumbOverride(plan?.name);

  // Working copy held in the canvas; we sync to the store on Save.
  const [workingNodes, setWorkingNodes] = useState<RoutingNode[]>(plan?.nodes ?? []);
  const [workingEdges, setWorkingEdges] = useState<RoutingEdge[]>(plan?.edges ?? []);
  const [selected, setSelected] = useState<RoutingNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  // Tracks which plan id `workingNodes`/`workingEdges` currently reflect, so
  // a re-render that doesn't change the id (e.g. the detail fetch below
  // resolving) doesn't stomp in-progress edits.
  const syncedIdRef = useRef<string | null>(null);

  // Track patches pushed into the canvas (inspector edits).
  const [patchVersion, setPatchVersion] = useState(0);
  const [patchedNode, setPatchedNode] = useState<{ id: string; data: Partial<RoutingNodeData> } | null>(null);

  // `fetch()` (called once at app boot) hydrates the store from the
  // paginated LIST endpoint, which many backends serialize slim — omitting
  // the nested conditions/destinations a specific rule needs to render its
  // graph. Re-fetch this one rule from the detail endpoint every time the
  // editor opens, so it never renders (or saves over) a slimmer snapshot
  // than what's actually on the backend record.
  const [detailLoading, setDetailLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    fetchOne(params.id)
      .catch(() => {
        // Non-fatal — fall back to whatever the list hydration already
        // produced (or "Plan not found" if that came up empty too).
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, fetchOne]);

  // Sync the working copy once the plan's full detail is in — not on every
  // render, so it doesn't overwrite edits already in progress.
  useEffect(() => {
    if (!plan || detailLoading) return;
    if (syncedIdRef.current === plan.id) return;
    setWorkingNodes(plan.nodes);
    setWorkingEdges(plan.edges);
    syncedIdRef.current = plan.id;
  }, [plan, detailLoading]);

  const dirty = useMemo(() => {
    if (!plan) return false;
    return (
      JSON.stringify(workingNodes) !== JSON.stringify(plan.nodes) ||
      JSON.stringify(workingEdges) !== JSON.stringify(plan.edges)
    );
  }, [plan, workingNodes, workingEdges]);

  // Hold the canvas until the per-rule detail fetch resolves — `plan` can
  // already be non-null here from the list hydration (slim, per the backend
  // contract's list/detail split) by the time this page mounts via in-app
  // navigation. Rendering the canvas off that snapshot would seed React
  // Flow's one-time `initialNodes` with it, and the subsequent `fetchOne`
  // resolving can't correct it after the fact — so wait for both here
  // instead of gating on `!plan` alone.
  if (detailLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 p-4 sm:p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-full flex-1 rounded-xl" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <EmptyState
          icon={GitFork}
          tone="amber"
          title="Plan not found"
          description="It may have been deleted. Sending you back to the routing list…"
        />
      </div>
    );
  }

  const inboundOnCanvas = workingNodes.some((n) => n.type === "inbound");

  // NOTE — these MUST be stable across renders. React Flow watches the
  // `onSelectionChange` callback identity inside the canvas; if these change
  // every render, the canvas re-fires the handler → setSelected → new render
  // → new handler → infinite loop (React error #185).
  const onSelectNode = useCallback((n: RoutingNode | null) => setSelected(n), []);

  const onChange = useCallback(
    (ns: RoutingNode[], es: RoutingEdge[]) => {
      setWorkingNodes(ns);
      setWorkingEdges(es);
    },
    [],
  );

  const onPatch = useCallback(
    (patch: Partial<RoutingNodeData>) => {
      setSelected((s) => {
        if (!s) return s;
        setPatchedNode({ id: s.id, data: patch });
        setPatchVersion((v) => v + 1);
        return { ...s, data: { ...s.data, ...patch } };
      });
    },
    [],
  );

  const onDeleteNode = useCallback(() => {
    setSelected((s) => {
      if (!s) return s;
      setWorkingNodes((ns) => ns.filter((n) => n.id !== s.id));
      setWorkingEdges((es) =>
        es.filter((e) => e.source !== s.id && e.target !== s.id),
      );
      return null;
    });
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await setGraph(plan.id, workingNodes, workingEdges);
      toast.success("Plan saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onPublishToggle = async () => {
    const next = plan.status === "published" ? "draft" : "published";
    try {
      await setStatus(plan.id, next);
      toast.success(next === "published" ? "Plan published" : "Plan unpublished");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update status");
    }
  };

  const onDelete = async () => {
    try {
      await remove(plan.id);
      toast.success(`${plan.name} deleted`);
      router.replace(ROUTES.routing);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onTest = () => {
    if (dirty) {
      toast.warning("Save your changes first", {
        description: "Simulation runs against the published rule, so unsaved edits won't be exercised.",
      });
      return;
    }
    setTestOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col p-4 sm:p-6">
      <div className="mb-3">
        <RoutingToolbar
          plan={plan}
          dirty={dirty}
          saving={saving}
          onSave={onSave}
          onPublishToggle={onPublishToggle}
          onDelete={onDelete}
          onTest={onTest}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        {/* Palette */}
        <div className="rounded-xl border border-border bg-card p-3 lg:overflow-hidden">
          <RoutingPalette inboundExists={inboundOnCanvas} />
        </div>

        {/* Canvas */}
        <div className="relative min-h-[500px] overflow-hidden rounded-xl border border-border bg-background">
          {/* Patch the canvas only when patches actually exist; otherwise pass null */}
          {plan && (
            <RoutingCanvas
              key={plan.id}
              initialNodes={plan.nodes}
              initialEdges={plan.edges}
              onChange={onChange}
              onSelectNode={onSelectNode}
              patchVersion={patchVersion}
              patchedNode={patchedNode}
              className="h-full w-full"
            />
          )}
        </div>

        {/* Inspector */}
        <div className="rounded-xl border border-border bg-card p-3 lg:overflow-hidden">
          <RoutingInspector selected={selected} onPatch={onPatch} onDelete={onDeleteNode} />
        </div>
      </div>

      <TestCallerDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        ruleId={plan.id}
        ruleName={plan.name}
      />
    </div>
  );
}
