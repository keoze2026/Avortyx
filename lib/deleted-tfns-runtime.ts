"use client";

import * as React from "react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDeletedTfnsStore } from "@/lib/store/deleted-tfns-store";

const REFRESH_MS = 60_000;
const TOAST_ID = "deleted-tfns";

/**
 * Keeps the "TFNs deleted" notice current (backend CH-179) and raises it as a
 * banner that stays until it is dismissed. Dismissing the banner does not
 * acknowledge it: the notice stays pinned in the bell menu until Seen is
 * clicked (Sir, 21 Oct: "that notification remain unless user sees").
 * Employees only - buyer and publisher logins have no TFNs to replace.
 */
export function useDeletedTfnsRuntime() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isStaff = !!user && user.role !== "buyer" && user.role !== "publisher";
  const load = useDeletedTfnsStore((s) => s.load);
  const count = useDeletedTfnsStore((s) => s.count);
  const numbers = useDeletedTfnsStore((s) => s.numbers);
  const newestAt = useDeletedTfnsStore((s) => s.newestAt);
  const markSeen = useDeletedTfnsStore((s) => s.markSeen);
  const bannerFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isStaff) return;
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [isStaff, user?.id, load]);

  React.useEffect(() => {
    if (!isStaff) return;
    if (count === 0) {
      toast.dismiss(TOAST_ID);
      bannerFor.current = null;
      return;
    }
    // One banner per batch: a new retirement raises it again.
    if (bannerFor.current === newestAt) return;
    bannerFor.current = newestAt;
    const shown = numbers.slice(0, 5).map((n) => n.number).join(", ");
    const more = count > 5 ? " " + t("deletedTfns.more").replace("{count}", String(count - 5)) : "";
    toast.warning(
      count === 1 ? t("deletedTfnsOne.title") : t("deletedTfns.title").replace("{count}", String(count)),
      {
        id: TOAST_ID,
        duration: Infinity,
        description: `${t("deletedTfns.body")} ${shown}${more}`,
        action: {
          label: t("deletedTfns.seen"),
          onClick: () => {
            markSeen().catch(() => toast.error(t("deletedTfns.seenFailed")));
          },
        },
      },
    );
  }, [isStaff, count, numbers, newestAt, markSeen, t]);
}
