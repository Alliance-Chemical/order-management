import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> & {
      color?: 'info' | 'warning' | 'success' | 'danger'
      icon?: React.ReactNode
      additionalContent?: React.ReactNode
    }
>((
  { className, variant, color, icon, additionalContent, children, ...props },
  ref
) => {
  const colorClass = (() => {
    switch (color) {
      case 'info':
        return 'border-sky-200 bg-sky-50 text-sky-900'
      case 'warning':
        return 'border-amber-300 bg-amber-50 text-amber-900'
      case 'success':
        return 'border-emerald-300 bg-emerald-50 text-emerald-900'
      case 'danger':
        return 'border-rose-300 bg-rose-50 text-rose-900'
      default:
        return undefined
    }
  })()

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), colorClass, className)}
      {...props}
    >
      <div className="flex gap-3">
        {icon ? <span className="mt-0.5 text-current">{icon}</span> : null}
        <div className="flex-1">
          {children}
          {additionalContent}
        </div>
      </div>
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
