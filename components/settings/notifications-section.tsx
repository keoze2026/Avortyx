"use client";

import { motion } from "framer-motion";
import { Bell, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { SectionShell } from "./profile-section";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  type NotificationChannel,
  useNotificationsRulesStore,
} from "@/lib/store/notifications-rules-store";

/**
 * The events the backend accepts on a notification rule. Creating a rule
 * validates both `event` and `channel` and answers 400 with the valid list
 * for anything else — so this is the full set, not a suggestion. Events we
 * used to offer that don't exist (`publisher.spike`, `webhook.failing`,
 * `billing.invoice`, `ai.recommendation`, `buyer.capped`) were accepted
 * silently by the old API and delivered nothing.
 */
const EVENT_CATALOG: Array<{
  key: string;
  fallbackLabel: string;
  fallbackDesc: string;
  labelKey: string;
  descKey: string;
}> = [
  {
    key: "call.started",
    fallbackLabel: "Call started",
    fallbackDesc: "When a call begins routing.",
    labelKey: "workspaceUI.notifications.events.callStarted",
    descKey: "workspaceUI.notifications.events.callStartedDesc",
  },
  {
    key: "call.completed",
    fallbackLabel: "Call completed",
    fallbackDesc: "When a call settles and pays out.",
    labelKey: "workspaceUI.notifications.events.callCompleted",
    descKey: "workspaceUI.notifications.events.callCompletedDesc",
  },
  {
    key: "call.missed",
    fallbackLabel: "Call missed",
    fallbackDesc: "When a call isn't answered.",
    labelKey: "workspaceUI.notifications.events.callMissed",
    descKey: "workspaceUI.notifications.events.callMissedDesc",
  },
  {
    key: "campaign.cap_reached",
    fallbackLabel: "Campaign reached cap",
    fallbackDesc: "At 80% and again at 100% of a campaign cap.",
    labelKey: "workspaceUI.notifications.events.campaignCap",
    descKey: "workspaceUI.notifications.events.campaignCapDesc",
  },
  {
    key: "buyer.cap_reached",
    fallbackLabel: "Buyer reached cap",
    fallbackDesc: "At 80% and again at 100% of a buyer cap.",
    labelKey: "workspaceUI.notifications.events.buyerCap",
    descKey: "workspaceUI.notifications.events.buyerCapDesc",
  },
  {
    key: "publisher.cap_reached",
    fallbackLabel: "Publisher reached cap",
    fallbackDesc: "At 80% and again at 100% of a publisher cap.",
    labelKey: "workspaceUI.notifications.events.publisherCap",
    descKey: "workspaceUI.notifications.events.publisherCapDesc",
  },
  {
    key: "destination.cap_reached",
    fallbackLabel: "Destination reached cap",
    fallbackDesc: "At 80% and again at 100% of a destination cap.",
    labelKey: "workspaceUI.notifications.events.destinationCap",
    descKey: "workspaceUI.notifications.events.destinationCapDesc",
  },
  {
    key: "buyer.missed",
    fallbackLabel: "Buyer missing calls",
    fallbackDesc: "When a buyer stops answering routed calls.",
    labelKey: "workspaceUI.notifications.events.buyerMissed",
    descKey: "workspaceUI.notifications.events.buyerMissedDesc",
  },
  {
    key: "aht.low",
    fallbackLabel: "Handle time dropped",
    fallbackDesc: "Average handle time below its normal range.",
    labelKey: "workspaceUI.notifications.events.ahtLow",
    descKey: "workspaceUI.notifications.events.ahtLowDesc",
  },
  {
    key: "low.balance",
    fallbackLabel: "Low balance",
    fallbackDesc: "When the account balance runs low.",
    labelKey: "workspaceUI.notifications.events.lowBalance",
    descKey: "workspaceUI.notifications.events.lowBalanceDesc",
  },
  {
    key: "campaign.paused",
    fallbackLabel: "Campaign paused",
    fallbackDesc: "When a campaign stops taking traffic.",
    labelKey: "workspaceUI.notifications.events.campaignPaused",
    descKey: "workspaceUI.notifications.events.campaignPausedDesc",
  },
  {
    key: "daily.summary",
    fallbackLabel: "Daily summary",
    fallbackDesc: "End-of-day totals for the account.",
    labelKey: "workspaceUI.notifications.events.dailySummary",
    descKey: "workspaceUI.notifications.events.dailySummaryDesc",
  },
];

export function NotificationsSection() {
  const { t } = useTranslation();
  const rules = useNotificationsRulesStore((s) => s.rules);
  const setEnabled = useNotificationsRulesStore((s) => s.setEnabled);
  const userEmail = useAuthStore((s) => s.user?.email ?? "");

  // Subscribing to `rules` re-renders the section whenever any toggle flips
  // (locally or via another tab). We compute isActive per render from the
  // current rules array — cheap, since there are at most a few dozen rules.
  const isOn = (event: string, channel: NotificationChannel) => {
    const rule = rules.find((r) => r.event === event && r.channel === channel);
    return !!rule && rule.isActive;
  };

  const toggle = async (event: string, channel: NotificationChannel) => {
    if (!userEmail) {
      toast.error("Sign-in required to update notification preferences.");
      return;
    }
    const next = !isOn(event, channel);
    try {
      await setEnabled(event, channel, next, userEmail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save preference");
    }
  };

  return (
    <SectionShell
      eyebrow={t("settings.notificationsSection.eyebrow")}
      title={t("settings.notificationsSection.title")}
      description={t("settings.notificationsSection.description")}
    >
      <Card className="overflow-hidden">
        {/* Email and SMS only — `in_app` is not a delivery channel the
            backend accepts (rules saved against it were stored and then
            delivered nothing). In-app banners are configured separately,
            under the bell menu's "Pop-up alerts". */}
        <div className="hidden border-b border-border/60 bg-secondary/30 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_5rem]">
          <span>{t("workspaceUI.notifications.columnEvent")}</span>
          <span className="text-center">{t("workspaceUI.notifications.columnEmail")}</span>
          <span className="text-center">{t("workspaceUI.notifications.columnSms")}</span>
        </div>

        <CardContent className="divide-y divide-border/60 p-0">
          {EVENT_CATALOG.map((p, i) => {
            // Use the translated label if it resolves to something other than
            // the key itself (i.e. the key exists in the locale file); fall
            // back to the canonical English label so adding a new event
            // doesn't require an i18n PR before it renders.
            const labelT = t(p.labelKey);
            const descT = t(p.descKey);
            const label = labelT === p.labelKey ? p.fallbackLabel : labelT;
            const description = descT === p.descKey ? p.fallbackDesc : descT;
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_5rem_5rem]"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-3 w-3 text-accent" />
                    {label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
                </div>
                <Cell label={t("workspaceUI.notifications.columnEmail")} icon={Mail} on={isOn(p.key, "email")} onToggle={() => toggle(p.key, "email")} />
                <Cell label={t("workspaceUI.notifications.columnSms")} icon={Smartphone} on={isOn(p.key, "sms")} onToggle={() => toggle(p.key, "sms")} />
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </SectionShell>
  );
}

function Cell({
  label,
  icon: Icon,
  on,
  onToggle,
}: {
  label: string;
  icon: typeof Bell;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between sm:justify-center">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:hidden">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <Switch checked={on} onCheckedChange={onToggle} />
    </div>
  );
}
