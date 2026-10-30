"use client";

import { NodeFrame } from "./node-frame";
import { NODE_META } from "../node-meta";
import type { RFNodeProps } from "./types";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { LocalName } from "@/lib/i18n/local-name";

export function InboundNode({ data, selected }: RFNodeProps<"inbound">) {
  const { t } = useTranslation();
  const meta = NODE_META.inbound;
  const cfg = data.inbound;
  const campaign = useCampaignsStore((s) =>
    cfg?.campaignId ? s.campaigns.find((c) => c.id === cfg.campaignId) : undefined,
  );

  return (
    <NodeFrame
      icon={meta.icon}
      title={t("trafficUI.routing.nodes.inbound.label")}
      tone={meta.tone}
      selected={selected}
      hasInput={false}
      outputs={[{ id: "out" }]}
    >
      <div className="text-[11px] text-muted-foreground">
        {campaign ? (
          <>
            <div className="truncate font-medium text-foreground"><LocalName name={campaign.name} /></div>
            <div className="mt-0.5 font-mono text-[10px]">{campaign.vertical}</div>
          </>
        ) : (
          <span className="italic">{t("trafficUI.routing.nodes.inbound.notBound")}</span>
        )}
      </div>
    </NodeFrame>
  );
}
