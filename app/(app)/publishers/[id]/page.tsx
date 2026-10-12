"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Users } from "lucide-react";

import { PublisherDetailHeader } from "@/components/publishers/publisher-detail-header";
import { PublisherSettingsTab } from "@/components/publishers/publisher-settings-tab";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { usePublishersStore } from "@/lib/store/publishers-store";

function DetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[928px] space-y-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}

export default function PublisherDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const publisher = usePublishersStore((s) => s.getById(params.id));
  const hydrated = usePublishersStore((s) => s.hydrated);
  const loading = usePublishersStore((s) => s.loading);
  const fetchPublishers = usePublishersStore((s) => s.fetch);

  useBreadcrumbOverride(publisher?.name);

  const triedLoad = useRef(false);
  // After a hard refresh (Ctrl+Shift+R) the list isn't loaded yet, so the
  // record isn't found for a moment. The page used to give up after 600 ms
  // and jump back to the list. Now it loads the list and only leaves once it
  // has really loaded and the record truly doesn't exist.
  useEffect(() => {
    if (!hydrated) {
      // One load attempt per visit; a failed load must not retry in a loop.
      if (!loading && !triedLoad.current) {
        triedLoad.current = true;
        void fetchPublishers();
      }
      return;
    }
    if (!publisher) {
      const t = setTimeout(() => router.replace("/publishers"), 600);
      return () => clearTimeout(t);
    }
  }, [hydrated, loading, publisher, fetchPublishers, router]);

  if (!publisher && !hydrated && (loading || !triedLoad.current)) return <DetailLoading />;

  if (!publisher) {
    return (
      <EmptyState
        icon={Users}
        tone="violet"
        title={t("networkUI.publishers.empty.notFound")}
        description={t("networkUI.publishers.empty.notFoundDesc")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[928px] space-y-6">
      <PublisherDetailHeader publisher={publisher} />
      <PublisherSettingsTab publisher={publisher} />
    </div>
  );
}
