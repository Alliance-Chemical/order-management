"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Truck,
  X,
  Loader2
} from "lucide-react"

const orderStatusVariants = cva(
  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wider transition-all duration-200",
  {
    variants: {
      status: {
        // Order statuses
        pending: "bg-warehouse-caution-light text-warehouse-caution border border-warehouse-caution/30",
        confirmed: "bg-warehouse-info-light text-warehouse-info border border-warehouse-info/30",
        processing: "bg-blue-100 text-blue-700 border border-blue-200 animate-pulse",
        ready: "bg-warehouse-go-light text-warehouse-go border border-warehouse-go/30",
        shipped: "bg-green-100 text-green-700 border border-green-200",
        delivered: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        cancelled: "bg-warehouse-stop-light text-warehouse-stop border border-warehouse-stop/30",

        // Inspection statuses
        "not_started": "bg-gray-100 text-gray-600 border border-gray-200",
        "in_progress": "bg-warehouse-caution-light text-warehouse-caution border border-warehouse-caution/30 animate-pulse",
        "completed": "bg-warehouse-go-light text-warehouse-go border border-warehouse-go/30",
        "failed": "bg-warehouse-stop-light text-warehouse-stop border border-warehouse-stop/30",

        // Quality statuses
        "passed": "bg-warehouse-go-light text-warehouse-go border border-warehouse-go/30",
        "warning": "bg-warehouse-caution-light text-warehouse-caution border border-warehouse-caution/30",
        "rejected": "bg-warehouse-stop-light text-warehouse-stop border border-warehouse-stop/30",

        // Freight statuses
        "quote_requested": "bg-gray-100 text-gray-600 border border-gray-200",
        "quoted": "bg-warehouse-info-light text-warehouse-info border border-warehouse-info/30",
        "booked": "bg-warehouse-caution-light text-warehouse-caution border border-warehouse-caution/30",
        "in_transit": "bg-blue-100 text-blue-700 border border-blue-200 animate-pulse",
        "out_for_delivery": "bg-orange-100 text-orange-700 border border-orange-200",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        default: "px-3 py-1 text-sm",
        lg: "px-4 py-2 text-base",
        xl: "px-6 py-3 text-lg",
      },
      priority: {
        normal: "",
        high: "ring-2 ring-warehouse-caution/50 shadow-lg",
        critical: "ring-2 ring-warehouse-stop/50 shadow-lg animate-pulse",
      }
    },
    defaultVariants: {
      status: "pending",
      size: "default",
      priority: "normal",
    },
  }
)

const statusIcons = {
  // Order statuses
  pending: Clock,
  confirmed: CheckCircle,
  processing: Loader2,
  ready: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: X,

  // Inspection statuses
  not_started: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: X,

  // Quality statuses
  passed: CheckCircle,
  warning: AlertTriangle,
  rejected: X,

  // Freight statuses
  quote_requested: Clock,
  quoted: CheckCircle,
  booked: Package,
  in_transit: Truck,
  out_for_delivery: Truck,
}

const statusLabels = {
  // Order statuses
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",

  // Inspection statuses
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",

  // Quality statuses
  passed: "Passed",
  warning: "Warning",
  rejected: "Rejected",

  // Freight statuses
  quote_requested: "Quote Requested",
  quoted: "Quoted",
  booked: "Booked",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
}

interface OrderStatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof orderStatusVariants> {
  showIcon?: boolean
  customLabel?: string
  animated?: boolean
  pulse?: boolean
}

const OrderStatusBadge = React.forwardRef<HTMLDivElement, OrderStatusBadgeProps>(
  ({
    className,
    status,
    size,
    priority,
    showIcon = true,
    customLabel,
    animated = true,
    pulse = false,
    ...props
  }, ref) => {
    const IconComponent = status ? statusIcons[status] : Clock
    const label = customLabel || (status ? statusLabels[status] : 'Unknown')

    const isAnimatedStatus = status === 'processing' || status === 'in_progress' || status === 'in_transit'
    const shouldAnimate = animated && isAnimatedStatus
    const shouldPulse = pulse || priority === 'critical'

    return (
      <div
        ref={ref}
        className={cn(
          orderStatusVariants({ status, size, priority }),
          shouldPulse && "animate-pulse",
          className
        )}
        {...props}
      >
        {showIcon && IconComponent && (
          <IconComponent
            className={cn(
              "h-4 w-4",
              size === "sm" && "h-3 w-3",
              size === "lg" && "h-5 w-5",
              size === "xl" && "h-6 w-6",
              shouldAnimate && "animate-spin"
            )}
          />
        )}
        {label}
      </div>
    )
  }
)
OrderStatusBadge.displayName = "OrderStatusBadge"

// Specialized badge components
interface ProgressBadgeProps extends Omit<OrderStatusBadgeProps, 'status'> {
  current: number
  total: number
  label?: string
}

const ProgressBadge = ({ current, total, label = "Progress", className, ...props }: ProgressBadgeProps) => {
  const percentage = Math.round((current / total) * 100)
  const getStatus = () => {
    if (percentage === 100) return "completed"
    if (percentage > 0) return "in_progress"
    return "not_started"
  }

  return (
    <div className={cn("relative", className)}>
      <OrderStatusBadge
        status={getStatus()}
        customLabel={`${label}: ${current}/${total} (${percentage}%)`}
        {...props}
      />
      <div className="absolute bottom-0 left-0 h-1 bg-current/20 w-full rounded-full overflow-hidden">
        <div
          className="h-full bg-current transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface TimestampBadgeProps extends Omit<OrderStatusBadgeProps, 'status'> {
  timestamp: string | Date
  format?: "relative" | "absolute"
  prefix?: string
}

const TimestampBadge = ({
  timestamp,
  format = "relative",
  prefix = "",
  className,
  ...props
}: TimestampBadgeProps) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  const getRelativeTime = () => {
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    const hours = Math.floor(diffInMinutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getStatus = () => {
    if (diffInMinutes < 30) return "completed"
    if (diffInMinutes < 120) return "warning"
    return "pending"
  }

  const displayTime = format === "relative" ? getRelativeTime() : date.toLocaleDateString()
  const label = prefix ? `${prefix} ${displayTime}` : displayTime

  return (
    <OrderStatusBadge
      status={getStatus()}
      customLabel={label}
      showIcon={false}
      className={className}
      {...props}
    />
  )
}

interface PriorityBadgeProps extends Omit<OrderStatusBadgeProps, 'status'> {
  level: "low" | "medium" | "high" | "critical"
}

const PriorityBadge = ({ level, className, ...props }: PriorityBadgeProps) => {
  const getStatus = () => {
    switch (level) {
      case "critical": return "failed"
      case "high": return "warning"
      case "medium": return "pending"
      default: return "not_started"
    }
  }

  const getPriority = () => {
    switch (level) {
      case "critical": return "critical"
      case "high": return "high"
      default: return "normal"
    }
  }

  return (
    <OrderStatusBadge
      status={getStatus()}
      priority={getPriority()}
      customLabel={level.charAt(0).toUpperCase() + level.slice(1)}
      className={className}
      {...props}
    />
  )
}

export {
  OrderStatusBadge,
  ProgressBadge,
  TimestampBadge,
  PriorityBadge,
  orderStatusVariants,
  statusIcons,
  statusLabels,
  type OrderStatusBadgeProps,
  type ProgressBadgeProps,
  type TimestampBadgeProps,
  type PriorityBadgeProps,
}
