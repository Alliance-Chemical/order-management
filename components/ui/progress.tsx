import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorClassName?: string
  progress?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, progress, size = 'md', color = 'primary', ...props }, ref) => {
    const resolvedValue = progress !== undefined ? progress : value ?? 0
    const percentage = Math.min(100, Math.max(0, (resolvedValue / max) * 100))

    const sizeClass = {
      sm: 'h-2',
      md: 'h-4',
      lg: 'h-6',
    }[size]

    const colorClass = {
      primary: 'bg-primary',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      info: 'bg-sky-500',
      danger: 'bg-rose-500',
    }[color]
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary",
          sizeClass,
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all",
            colorClass,
            indicatorClassName
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
