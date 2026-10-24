import { Skeleton } from "@/components/ui/skeleton";

export default function AutomatedReportsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <Skeleton className="h-9 w-80" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
