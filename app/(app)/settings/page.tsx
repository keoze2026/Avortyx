"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { ApiKeysSection } from "@/components/settings/api-keys-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { ScheduledReportsSection } from "@/components/settings/scheduled-reports-section";
import { MyTelegramReport } from "@/components/settings/my-telegram-report";
import { SecuritySection } from "@/components/settings/security-section";
import { SessionsSection } from "@/components/settings/sessions-section";
import {
  SETTINGS_SECTIONS,
  SettingsRail,
  useCanSeeAdvancedRouting,
  useCanSeeApiKeys,
  type SettingsSection,
} from "@/components/settings/settings-rail";
import { AdvancedRoutingSection } from "@/components/routing/advanced-routing-section";
import { PageHeader } from "@/components/shared/page-header";
import { useTranslation } from "@/hooks/use-translation";
import { Locked } from "@/components/shared/can";
import { useAuthStore } from "@/lib/store/auth-store";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<SettingsSection>("profile");
  const canSeeAdvanced = useCanSeeAdvancedRouting();
  const canSeeApiKeys = useCanSeeApiKeys();
  const isBuyer = useAuthStore((s) => s.user?.role === "buyer");

  // Open the section named in the link, e.g. /settings?section=advanced-routing
  // (the Routing page and a routing plan's "All plans" button link there).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("section") as SettingsSection | null;
    if (wanted && SETTINGS_SECTIONS.includes(wanted)) setSection(wanted);
  }, []);

  /** Keep the address in step with the open section, so refresh / back keep it. */
  const select = (next: SettingsSection) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "profile") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  return (
    <>
      <PageHeader
        title={t("page.settings.title")}
        description={t("page.settings.description")}
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[5.5rem] lg:self-start">
          <SettingsRail active={section} onSelect={select} />
        </div>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {section === "profile" && <ProfileSection />}
              {section === "security" && <SecuritySection />}
              {section === "api-keys" && canSeeApiKeys && <ApiKeysSection />}
              {section === "notifications" && <NotificationsSection />}
              {section === "sessions" && <SessionsSection />}
              {section === "scheduled-reports" && (
                isBuyer ? (
                  // A buyer login: its own switch for the daily Telegram
                  // report (CH-259), nothing goes out until it is on.
                  <MyTelegramReport />
                ) : (
                  <Locked area="reporting" action="edit">
                    <ScheduledReportsSection />
                  </Locked>
                )
              )}
              {section === "advanced-routing" && canSeeAdvanced && <AdvancedRoutingSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
