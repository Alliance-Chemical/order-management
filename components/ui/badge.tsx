import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  color?: 'default' | 'success' | 'warning' | 'failure' | 'info' | 'gray' | 'blue'
  size?: 'xs' | 'sm' | 'md'
}

function Badge({ className, variant, color, size, ...props }: BadgeProps) {
  const colorClass = (() => {
    switch (color) {
      case 'success':
        return 'border-emerald-200 bg-emerald-100 text-emerald-800'
      case 'warning':
        return 'border-amber-200 bg-amber-100 text-amber-800'
      case 'failure':
        return 'border-rose-200 bg-rose-100 text-rose-800'
      case 'info':
      case 'blue':
        return 'border-sky-200 bg-sky-100 text-sky-800'
      case 'gray':
        return 'border-gray-200 bg-gray-100 text-gray-700'
      default:
        return undefined
    }
  })()

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : undefined

  return (
    <div className={cn(badgeVariants({ variant }), colorClass, sizeClass, className)} {...props} />
  )
}

export { Badge, badgeVariants }
