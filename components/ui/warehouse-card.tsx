"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const warehouseCardVariants = cva(
  "rounded-lg border transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
        success: "border-warehouse-go bg-warehouse-go-light border-l-4",
        warning: "border-warehouse-caution bg-warehouse-caution-light border-l-4",
        error: "border-warehouse-stop bg-warehouse-stop-light border-l-4",
        info: "border-warehouse-info bg-warehouse-info-light border-l-4",
        elevated: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-warehouse-lg hover:shadow-warehouse-xl",
      },
      size: {
        default: "p-6",
        sm: "p-4",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface WarehouseCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof warehouseCardVariants> {
  icon?: React.ReactNode
  title: string
  description?: string
  status?: {
    label: string
    variant: "success" | "warning" | "error" | "info" | "neutral"
  }
  metadata?: Array<{
    label: string
    value: string
  }>
  actions?: React.ReactNode
  children?: React.ReactNode
}

const statusVariants = {
  success: "bg-warehouse-go text-warehouse-go-light",
  warning: "bg-warehouse-caution text-warehouse-caution-light",
  error: "bg-warehouse-stop text-warehouse-stop-light",
  info: "bg-warehouse-info text-warehouse-info-light",
  neutral: "bg-slate-500 text-white",
}

const WarehouseCard = React.forwardRef<HTMLDivElement, WarehouseCardProps>(
  ({ className, variant, size, icon, title, description, status, metadata, actions, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(warehouseCardVariants({ variant, size, className }))}
        {...props}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {icon}
                </div>
              )}
              <div>
                <CardTitle className="text-xl font-bold text-warehouse-text-primary tracking-wide">
                  {title}
                </CardTitle>
                {description && (
                  <CardDescription className="text-base text-warehouse-text-secondary mt-1">
                    {description}
                  </CardDescription>
                )}
              </div>
            </div>
            {status && (
              <Badge className={cn(
                "font-bold text-sm px-3 py-1",
                statusVariants[status.variant]
              )}>
                {status.label}
              </Badge>
            )}
          </div>
        </CardHeader>

        {(children || metadata) && (
          <CardContent className="py-4">
            {metadata && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {metadata.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="text-sm font-medium text-warehouse-text-secondary">
                      {item.label}
                    </div>
                    <div className="text-base font-bold text-warehouse-text-primary">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {children}
          </CardContent>
        )}

        {actions && (
          <CardFooter className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-3 w-full">
              {actions}
            </div>
          </CardFooter>
        )}
      </Card>
    )
  }
)
WarehouseCard.displayName = "WarehouseCard"

// Specialized warehouse card variants
interface OrderCardProps extends Omit<WarehouseCardProps, 'icon' | 'metadata'> {
  orderId: string
  customerName: string
  itemCount: number
  weight: string
  orderStatus: "ready" | "in_progress" | "pending" | "completed"
  priority?: "high" | "medium" | "low"
}

const OrderCard = ({ orderId, customerName, itemCount, weight, orderStatus, priority, ...props }: OrderCardProps) => {
  const { title: _title, ...forwardProps } = props
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ready": return { label: "Ready", variant: "success" as const }
      case "in_progress": return { label: "In Progress", variant: "warning" as const }
      case "pending": return { label: "Pending", variant: "error" as const }
      case "completed": return { label: "Completed", variant: "info" as const }
      default: return { label: status, variant: "neutral" as const }
    }
  }

  const getPriorityVariant = () => {
    if (priority === "high") return "error"
    if (priority === "medium") return "warning"
    return "default"
  }

  return (
    <WarehouseCard
      variant={getPriorityVariant()}
      title={orderId}
      description={customerName}
      status={getStatusConfig(orderStatus)}
      metadata={[
        { label: "Items", value: `${itemCount} items` },
        { label: "Weight", value: weight },
        ...(priority ? [{ label: "Priority", value: priority.charAt(0).toUpperCase() + priority.slice(1) }] : [])
      ]}
      {...forwardProps}
    />
  )
}

interface InspectionCardProps extends Omit<WarehouseCardProps, 'icon' | 'metadata'> {
  inspectionType: string
  inspector: string
  completedAt?: string
  itemsChecked: number
  issuesFound: number
}

const InspectionCard = ({ inspectionType, inspector, completedAt, itemsChecked, issuesFound, ...props }: InspectionCardProps) => {
  const { title: _title, ...forwardProps } = props
  const getVariant = () => {
    if (issuesFound > 0) return "warning"
    if (completedAt) return "success"
    return "default"
  }

  return (
    <WarehouseCard
      variant={getVariant()}
      title={inspectionType}
      description={`Inspector: ${inspector}`}
      status={{
        label: completedAt ? "Completed" : "In Progress",
        variant: completedAt ? "success" : "warning"
      }}
      metadata={[
        { label: "Items Checked", value: itemsChecked.toString() },
        { label: "Issues Found", value: issuesFound.toString() },
        ...(completedAt ? [{ label: "Completed", value: new Date(completedAt).toLocaleDateString() }] : [])
      ]}
      {...forwardProps}
    />
  )
}

export {
  WarehouseCard,
  OrderCard,
  InspectionCard,
  warehouseCardVariants,
  type WarehouseCardProps,
  type OrderCardProps,
  type InspectionCardProps,
}
