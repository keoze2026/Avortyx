"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ExpiredTfnsToast } from "@/components/app-shell/expired-tfns-toast";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDeletedTfnsStore } from "@/lib/store/deleted-tfns-store";

const REFRESH_MS = 60_000;
const TOAST_ID = "deleted-tfns";

// CH-640 (Sir, 7 Nov: "once X out yellow pop up should close"): the batch
// whose pop-up this login closed, kept in the browser so a page refresh does
// not raise it again. A new batch (a different newestAt) raises it again.
const closedKey = (userId: string | number) => `avx:tfn-toast-closed:${userId}`;

function closedBatch(userId: string | number): string | null {
  try {
    return window.localStorage.getItem(closedKey(userId));
  } catch {
    return null;
  }
}

function rememberClosed(userId: string | number, batch: string | null) {
  if (!batch) return;
  try {
    window.localStorage.setItem(closedKey(userId), batch);
  } catch {
    // Storage blocked: the pop-up still closes, it may come back on refresh.
  }
}

/**
 * Keeps the "TFNs deleted" notice current (backend CH-179) and raises it as a
 * banner that stays until it is dismissed. Dismissing the banner does not
 * acknowledge it: the notice stays pinned in the bell menu until Seen is
 * clicked (Sir, 21 Oct: "that notification remain unless user sees").
 * Employees only - buyer and publisher logins have no TFNs to replace.
 *
 * CH-639: the banner is Sir's new design (7 Nov, components/app-shell/
 * expired-tfns-toast.tsx). "Add replacements" opens the Numbers page and
 * counts as Seen (the person is acting on it); the close button only closes
 * the banner, as before.
 *
 * CH-640: closing it is remembered for that batch, in this browser, so a
 * refresh no longer brings it back. The bell keeps the numbers until Seen.
 */
export function useDeletedTfnsRuntime() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isStaff = !!user && user.role !== "buyer" && user.role !== "publisher";
  const load = useDeletedTfnsStore((s) => s.load);
  // Only numbers not yet Seen raise the banner (backend CH-182).
  const count = useDeletedTfnsStore((s) => s.unseenCount);
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
    const userId = user?.id ?? "";
    if (newestAt && closedBatch(userId) === newestAt) return;
    const unseen = numbers.filter((n) => !n.seen).map((n) => n.number);
    toast.custom(
      () =>
        React.createElement(ExpiredTfnsToast, {
          numbers: unseen,
          onAddReplacements: () => {
            toast.dismiss(TOAST_ID);
            markSeen().catch(() => toast.error(t("deletedTfns.seenFailed")));
            router.push(ROUTES.numbers);
          },
          onClose: () => {
            rememberClosed(userId, newestAt);
            toast.dismiss(TOAST_ID);
          },
        }),
      { id: TOAST_ID, duration: Infinity },
    );
  }, [isStaff, user?.id, count, numbers, newestAt, markSeen, router, t]);
}
