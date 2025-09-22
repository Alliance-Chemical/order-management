import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border-gray-200 bg-white text-gray-950",
        destructive: "border-red-500 bg-red-500 text-white",
        // Warehouse variants
        success: "border-warehouse-go bg-warehouse-go-light text-warehouse-go border-l-4",
        warning: "border-warehouse-caution bg-warehouse-caution-light text-warehouse-caution border-l-4",
        error: "border-warehouse-stop bg-warehouse-stop-light text-warehouse-stop border-l-4",
        info: "border-warehouse-info bg-warehouse-info-light text-warehouse-info border-l-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof toastVariants> & {
    progress?: number
    showProgress?: boolean
  }
>(({ className, variant = "default", progress, showProgress, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        toastVariants({ variant }),
        // Warehouse-friendly toast styling
        "rounded-lg p-6 shadow-warehouse-lg min-h-[80px]",
        "border-2",
        className
      )}
      {...props}
    >
      {props.children}
      {showProgress && progress !== undefined && (
        <div className="absolute bottom-0 left-0 h-1 bg-current/20 w-full">
          <div
            className="h-full bg-current transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
})
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-white transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        // Warehouse-friendly action button
        "h-10 px-4 font-semibold border-current text-current hover:bg-current/10 focus:ring-current/20",
        "rounded-md transition-all duration-200",
        className
      )}
      {...props}
    />
  )
})
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-gray-950/50 opacity-0 transition-opacity hover:text-gray-950 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
        className
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
})
ToastClose.displayName = "ToastClose"

const ToastTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  )
})
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
  )
})
ToastDescription.displayName = "ToastDescription"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const ToastViewport = React.forwardRef<
  HTMLOListElement,
  React.HTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => {
  return (
    <ol
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
})
ToastViewport.displayName = "ToastViewport"

// Warehouse-specific toast helpers
interface WarehouseToastProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  progress?: number
  showProgress?: boolean
}

const WarehouseToast = {
  success: ({ title, description, action, progress, showProgress }: WarehouseToastProps) => (
    <Toast variant="success" progress={progress} showProgress={showProgress}>
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <ToastTitle className="text-base font-bold">{title}</ToastTitle>
          {description && (
            <ToastDescription className="text-sm mt-1">{description}</ToastDescription>
          )}
        </div>
        {action && (
          <ToastAction onClick={action.onClick}>{action.label}</ToastAction>
        )}
      </div>
    </Toast>
  ),

  warning: ({ title, description, action, progress, showProgress }: WarehouseToastProps) => (
    <Toast variant="warning" progress={progress} showProgress={showProgress}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <ToastTitle className="text-base font-bold">{title}</ToastTitle>
          {description && (
            <ToastDescription className="text-sm mt-1">{description}</ToastDescription>
          )}
        </div>
        {action && (
          <ToastAction onClick={action.onClick}>{action.label}</ToastAction>
        )}
      </div>
    </Toast>
  ),

  error: ({ title, description, action, progress, showProgress }: WarehouseToastProps) => (
    <Toast variant="error" progress={progress} showProgress={showProgress}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <ToastTitle className="text-base font-bold">{title}</ToastTitle>
          {description && (
            <ToastDescription className="text-sm mt-1">{description}</ToastDescription>
          )}
        </div>
        {action && (
          <ToastAction onClick={action.onClick}>{action.label}</ToastAction>
        )}
      </div>
    </Toast>
  ),

  info: ({ title, description, action, progress, showProgress }: WarehouseToastProps) => (
    <Toast variant="info" progress={progress} showProgress={showProgress}>
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <ToastTitle className="text-base font-bold">{title}</ToastTitle>
          {description && (
            <ToastDescription className="text-sm mt-1">{description}</ToastDescription>
          )}
        </div>
        {action && (
          <ToastAction onClick={action.onClick}>{action.label}</ToastAction>
        )}
      </div>
    </Toast>
  ),
}

export {
  type ToastProps,
  type ToastActionElement,
  Toast,
  ToastAction,
  ToastClose,
  ToastTitle,
  ToastDescription,
  ToastProvider,
  ToastViewport,
  WarehouseToast,
  toastVariants,
}