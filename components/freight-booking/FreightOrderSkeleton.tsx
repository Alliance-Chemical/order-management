import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "flowbite-react";

export function FreightOrderSkeleton() {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="text-right">
          <Skeleton className="ml-auto h-4 w-16" />
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
