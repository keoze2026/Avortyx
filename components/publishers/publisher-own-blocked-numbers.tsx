"use client";

/**
 * Blocked Numbers for a PUBLISHER login (sidebar > Blocked Numbers).
 *
 * Shown only when the admin turned Block Numbers on for the publisher. It is
 * the same card the admin sees on the publisher's Edit page, scoped to this
 * login's own publisher: a caller blocked here is rejected on this publisher's
 * numbers only.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";

import { PublisherBlockedNumbers } from "@/components/publishers/publisher-blocked-numbers";
import { PageHeader } from "@/components/shared/page-header";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { usePublishersStore } from "@/lib/store/publishers-store";

export function PublisherOwnBlockedNumbers() {
  const { t } = useTranslation();
  const { can } = usePartnerPermissions();
  const publishers = usePublishersStore((s) => s.publishers);
  const hydrated = usePublishersStore((s) => s.hydrated);
  const loading = usePublishersStore((s) => s.loading);
  const fetchPublishers = usePublishersStore((s) => s.fetch);

  // One load attempt per visit; a failed load must not retry in a loop.
  const tried = React.useRef(false);
  React.useEffect(() => {
    if (!hydrated && !loading && !tried.current) {
      tried.current = true;
      void fetchPublishers();
    }
  }, [hydrated, loading, fetchPublishers]);

  // The permission is read from the server a moment after the page opens, and
  // until it arrives it reads as "off". Say "not turned on" only after a wait,
  // so the message never flashes for a login that does have it.
  const allowed = can("block_numbers");
  const [waited, setWaited] = React.useState(false);
  React.useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2000);
    return () => window.clearTimeout(id);
  }, []);

  // The list a publisher login gets is scoped to its own record.
  const own = publishers[0];

  let body: React.ReactNode;
  if (!allowed) {
    body = waited ? (
      <p className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        {t("publisherBlocks.notEnabled")}
      </p>
    ) : (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    );
  } else if (!own) {
    body = hydrated && !loading ? (
      <p className="text-sm text-muted-foreground">{t("publisherBlocks.noPublisher")}</p>
    ) : (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    );
  } else {
    body = <PublisherBlockedNumbers publisherId={own.id} />;
  }

  return (
    <div className="mx-auto w-full max-w-[928px]">
      <PageHeader title={t("nav.blockedNumbers")} description={t("publisherBlocks.pageDescription")} />
      {body}
    </div>
  );
}
