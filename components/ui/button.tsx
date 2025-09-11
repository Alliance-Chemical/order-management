import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Warehouse variants based on safety standards (full names)
        "warehouse-go": 
          "bg-[#00873E] text-white hover:bg-[#00873E]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#00873E]/70 active:scale-95",
        "warehouse-stop": 
          "bg-[#CC0000] text-white hover:bg-[#CC0000]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#CC0000]/70 active:scale-95",
        "warehouse-caution": 
          "bg-[#F5A623] text-black hover:bg-[#F5A623]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#F5A623]/70 active:scale-95",
        "warehouse-info": 
          "bg-[#0052CC] text-white hover:bg-[#0052CC]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#0052CC]/70 active:scale-95",
        // Short aliases for warehouse variants
        go: "bg-[#00873E] text-white hover:bg-[#00873E]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#00873E]/70 active:scale-95",
        stop: "bg-[#CC0000] text-white hover:bg-[#CC0000]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#CC0000]/70 active:scale-95",
        caution: "bg-[#F5A623] text-black hover:bg-[#F5A623]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#F5A623]/70 active:scale-95",
        info: "bg-[#0052CC] text-white hover:bg-[#0052CC]/90 font-bold uppercase tracking-wider shadow-lg border-b-4 border-[#0052CC]/70 active:scale-95",
        neutral: "bg-gray-500 text-white hover:bg-gray-600 font-bold uppercase tracking-wider shadow-lg border-b-4 border-gray-600 active:scale-95",
        primary: "bg-blue-600 text-white hover:bg-blue-700 font-bold uppercase tracking-wider shadow-lg border-b-4 border-blue-700 active:scale-95",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Warehouse sizes for glove-friendly interaction
        warehouse: "h-20 px-8 py-4 text-lg min-w-[200px]",
        "warehouse-xl": "h-24 px-10 py-6 text-xl min-w-[250px]",
        // Additional size aliases
        base: "h-10 px-4 py-2",
        small: "h-9 rounded-md px-3",
        medium: "h-12 px-5 py-3",
        large: "h-14 px-6 py-3 text-lg",
        xlarge: "h-16 px-8 py-4 text-lg",
        md: "h-12 px-5 py-3",
        xl: "h-16 px-8 py-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }