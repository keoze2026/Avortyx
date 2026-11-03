import { Skeleton } from "@/components/ui/skeleton";

export default function ActiveBotsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
