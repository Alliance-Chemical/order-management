import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        // Warehouse-friendly skeleton styling
        "bg-slate-200 dark:bg-slate-700 rounded-lg",
        "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

// Warehouse-specific skeleton variants
const WarehouseOrderSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-4 p-6 border rounded-lg", className)} {...props}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-24" /> {/* Order ID */}
      <Skeleton className="h-8 w-20 rounded-full" /> {/* Status badge */}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-5 w-48" /> {/* Customer name */}
      <Skeleton className="h-4 w-32" /> {/* Items count */}
      <Skeleton className="h-4 w-28" /> {/* Weight */}
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-10 w-24" /> {/* Action button */}
      <Skeleton className="h-10 w-24" /> {/* Action button */}
    </div>
  </div>
)

const WarehouseCardSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 border rounded-lg space-y-4", className)} {...props}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-full" /> {/* Icon */}
      <Skeleton className="h-6 w-32" /> {/* Title */}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <div className="flex justify-between items-center pt-4 border-t">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
)

const WarehouseTableSkeleton = ({
  rows = 5,
  columns = 4,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) => (
  <div className={cn("space-y-4", className)} {...props}>
    {/* Header */}
    <div className="flex gap-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-5 flex-1" />
      ))}
    </div>
    {/* Rows */}
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
)

const WarehouseFormSkeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-6", className)} {...props}>
    {/* Form title */}
    <Skeleton className="h-8 w-48" />

    {/* Form fields */}
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" /> {/* Label */}
        <Skeleton className="h-12 w-full" /> {/* Input */}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" /> {/* Label */}
        <Skeleton className="h-12 w-full" /> {/* Input */}
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" /> {/* Checkbox */}
        <Skeleton className="h-4 w-40" /> {/* Checkbox label */}
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex gap-4 pt-4">
      <Skeleton className="h-12 w-24" />
      <Skeleton className="h-12 w-32" />
    </div>
  </div>
)

export {
  Skeleton,
  WarehouseOrderSkeleton,
  WarehouseCardSkeleton,
  WarehouseTableSkeleton,
  WarehouseFormSkeleton
}