"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      // Warehouse-friendly checkbox styling - larger and more visible
      "h-6 w-6 border-2 border-slate-400 rounded-md transition-all duration-200",
      "hover:border-slate-600 focus:border-warehouse-info focus:ring-2 focus:ring-warehouse-info/20",
      "data-[state=checked]:bg-warehouse-go data-[state=checked]:border-warehouse-go data-[state=checked]:text-white",
      "data-[state=indeterminate]:bg-warehouse-caution data-[state=indeterminate]:border-warehouse-caution",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      // Better touch target for gloved hands
      "min-h-[24px] min-w-[24px]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current",
        // Warehouse-friendly indicator styling
        "h-full w-full"
      )}
    >
      <Check className="h-4 w-4 font-bold stroke-[3px]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }