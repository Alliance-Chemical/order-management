import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function FreightOrderSkeleton() {
  return (
    <Card className="p-4 transition-shadow duration-200 hover:shadow-md animate-fade-in">
      <div className="flex flex-col space-y-4">
        {/* Header with order number and status */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" /> {/* Order number */}
          <Skeleton className="h-6 w-20 rounded-full" /> {/* Status badge */}
        </div>

        {/* Customer name */}
        <Skeleton className="h-5 w-48" />

        {/* Order details */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" /> {/* Date */}
          <Skeleton className="h-4 w-16" /> {/* Item count */}
        </div>

        {/* Measurements or totals */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
      </div>
    </Card>
  );
}

export function FreightOrderListSkeleton() {
  return (
    <Card className="mt-4 w-full md:max-w-screen-lg">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <FreightOrderSkeleton key={index} />
        ))}
      </div>
    </Card>
  );
}
