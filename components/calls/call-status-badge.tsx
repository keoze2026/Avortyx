import { CheckCircle2, Phone, PhoneIncoming, PhoneMissed, XCircle, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";
import type { CallStatus } from "@/lib/types";

const META: Record<CallStatus, {
  icon: LucideIcon;
  variant: React.ComponentProps<typeof Badge>["variant"];
  labelKey: string;
}> = {
  ringing: { icon: PhoneIncoming, variant: "default", labelKey: "toolsUI.callLogs.statusBadge.ringing" },
  "in-progress": { icon: Phone, variant: "default", labelKey: "toolsUI.callLogs.statusBadge.live" },
  completed: { icon: CheckCircle2, variant: "success", labelKey: "toolsUI.callLogs.statusBadge.won" },
  missed: { icon: PhoneMissed, variant: "destructive", labelKey: "toolsUI.callLogs.statusBadge.missed" },
  rejected: { icon: XCircle, variant: "destructive", labelKey: "toolsUI.callLogs.statusBadge.rejected" },
  failed: { icon: XCircle, variant: "destructive", labelKey: "toolsUI.callLogs.statusBadge.failed" },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const { t } = useTranslation();
  const meta = META[status];
  const Icon = meta.icon;
  const live = status === "ringing" || status === "in-progress";
  return (
    <Badge variant={meta.variant} className="gap-1">
      {live ? (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {t(meta.labelKey)}
    </Badge>
  );
}
