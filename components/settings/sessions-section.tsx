"use client";

import { motion } from "framer-motion";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { SectionShell } from "./profile-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatRelativeTime } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";
import { useWorkspaceMetaStore } from "@/lib/store/workspace-meta-store";

export function SessionsSection() {
  const { t } = useTranslation();
  const sessions = useWorkspaceMetaStore((s) => s.sessions);
  const revokeSession = useWorkspaceMetaStore((s) => s.revokeSession);
  const myId = useAuthStore((s) => s.user?.id);
  // The server only marks the current sign-in when it can tell which one it
  // is. Without that, "revoke all others" would end every listed sign-in -
  // for the workspace admin, everybody's, including their own (CH-266).
  const knowsCurrent = sessions.some((s) => s.current);

  const revoke = async (id: string) => {
    try {
      await revokeSession(id);
      toast.success(t("settings.sessionsSection.sessionRevoked"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.sessionRevoke"));
    }
  };

  const revokeAllOthers = async () => {
    const others = sessions.filter((s) => !s.current && (!s.userId || !myId || s.userId === myId));
    if (others.length === 0) return;
    try {
      await Promise.all(others.map((s) => revokeSession(s.id)));
      toast.success(t("settings.sessionsSection.allOthersRevoked"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.sessionsRevoke"));
    }
  };

  return (
    <SectionShell
      eyebrow={t("settings.sessionsSection.eyebrow")}
      title={t("settings.sessionsSection.title")}
      description={t("settings.sessionsSection.description")}
    >
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {sessions.map((s, i) => {
            const Icon = s.device.toLowerCase().includes("iphone") || s.device.toLowerCase().includes("ios")
              ? Smartphone
              : Monitor;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/20"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-secondary/60 text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.device}</span>
                    {s.current && (
                      <Badge variant="success">{t("workspaceUI.sessions.thisDevice")}</Badge>
                    )}
                    {/* The workspace admin sees everyone's sign-ins: say whose. */}
                    {s.userName && s.userId && myId && s.userId !== myId && (
                      <span className="truncate text-xs text-muted-foreground">{s.userName}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                    {s.browser} · {s.ip}
                    {s.city && <span> · {s.city}</span>}
                  </div>
                </div>
                <div className="hidden text-right text-[11px] text-muted-foreground sm:block">
                  {t("workspaceUI.sessions.activeRelative").replace("{time}", formatRelativeTime(s.lastActiveAt))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={s.current}
                  onClick={() => revoke(s.id)}
                >
                  <LogOut className="h-3 w-3" />
                  {t("settings.sessionsSection.revoke")}
                </Button>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {knowsCurrent && (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={revokeAllOthers}
        >
          {t("settings.sessionsSection.revokeAllOthers")}
        </Button>
      </div>
      )}
    </SectionShell>
  );
}
