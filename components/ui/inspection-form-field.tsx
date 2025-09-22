"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle, Camera, FileText } from "lucide-react"

interface BaseInspectionFieldProps {
  label: string
  description?: string
  required?: boolean
  priority?: "normal" | "high" | "critical"
  className?: string
}

// Checkbox field with warehouse styling
interface InspectionCheckboxProps extends BaseInspectionFieldProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  warningText?: string
}

const InspectionCheckbox = ({
  label,
  description,
  required,
  priority = "normal",
  checked,
  onCheckedChange,
  warningText,
  className,
}: InspectionCheckboxProps) => {
  const getPriorityStyles = () => {
    switch (priority) {
      case "critical":
        return "border-warehouse-stop bg-warehouse-stop-light/30"
      case "high":
        return "border-warehouse-caution bg-warehouse-caution-light/30"
      default:
        return "border-slate-200 dark:border-slate-700"
    }
  }

  const getPriorityIcon = () => {
    switch (priority) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-warehouse-stop" />
      case "high":
        return <AlertTriangle className="h-4 w-4 text-warehouse-caution" />
      default:
        return null
    }
  }

  return (
    <FormItem className={cn(
      "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4",
      getPriorityStyles(),
      className
    )}>
      <FormControl>
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none flex-1">
        <FormLabel className="flex items-center gap-2">
          {getPriorityIcon()}
          {label}
          {required && <span className="text-warehouse-stop">*</span>}
        </FormLabel>
        {description && (
          <FormDescription className="text-sm">
            {description}
          </FormDescription>
        )}
        {warningText && !checked && priority !== "normal" && (
          <div className="text-sm text-warehouse-caution bg-warehouse-caution-light px-2 py-1 rounded mt-2">
            ⚠️ {warningText}
          </div>
        )}
      </div>
      <FormMessage />
    </FormItem>
  )
}

// Radio group field for warehouse options
interface InspectionRadioProps extends BaseInspectionFieldProps {
  options: Array<{
    value: string
    label: string
    description?: string
  }>
  value?: string
  onValueChange?: (value: string) => void
}

const InspectionRadio = ({
  label,
  description,
  required,
  priority = "normal",
  options,
  value,
  onValueChange,
  className,
}: InspectionRadioProps) => {
  return (
    <FormItem className={cn("space-y-3", className)}>
      <FormLabel className="text-base font-semibold flex items-center gap-2">
        {priority === "critical" && <AlertTriangle className="h-5 w-5 text-warehouse-stop" />}
        {priority === "high" && <AlertTriangle className="h-4 w-4 text-warehouse-caution" />}
        {label}
        {required && <span className="text-warehouse-stop">*</span>}
      </FormLabel>
      {description && (
        <FormDescription className="text-base">
          {description}
        </FormDescription>
      )}
      <FormControl>
        <RadioGroup
          onValueChange={onValueChange}
          value={value}
          className="flex flex-col space-y-2"
        >
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <div className="flex-1">
                <Label htmlFor={option.value} className="text-base font-medium cursor-pointer">
                  {option.label}
                </Label>
                {option.description && (
                  <div className="text-sm text-warehouse-text-secondary">
                    {option.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

// Text input field for warehouse forms
interface InspectionInputProps extends BaseInspectionFieldProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  type?: "text" | "number" | "email"
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    message?: string
  }
}

const InspectionInput = ({
  label,
  description,
  required,
  priority = "normal",
  placeholder,
  value,
  onChange,
  type = "text",
  validation,
  className,
}: InspectionInputProps) => {
  return (
    <FormItem className={cn("space-y-2", className)}>
      <FormLabel className="text-base font-semibold flex items-center gap-2">
        {priority === "critical" && <AlertTriangle className="h-5 w-5 text-warehouse-stop" />}
        {priority === "high" && <AlertTriangle className="h-4 w-4 text-warehouse-caution" />}
        {label}
        {required && <span className="text-warehouse-stop">*</span>}
      </FormLabel>
      {description && (
        <FormDescription className="text-base">
          {description}
        </FormDescription>
      )}
      <FormControl>
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="text-lg h-12"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

// Textarea field for warehouse forms
interface InspectionTextareaProps extends BaseInspectionFieldProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  rows?: number
}

const InspectionTextarea = ({
  label,
  description,
  required,
  priority = "normal",
  placeholder,
  value,
  onChange,
  rows = 4,
  className,
}: InspectionTextareaProps) => {
  return (
    <FormItem className={cn("space-y-2", className)}>
      <FormLabel className="text-base font-semibold flex items-center gap-2">
        {priority === "critical" && <AlertTriangle className="h-5 w-5 text-warehouse-stop" />}
        {priority === "high" && <AlertTriangle className="h-4 w-4 text-warehouse-caution" />}
        {label}
        {required && <span className="text-warehouse-stop">*</span>}
      </FormLabel>
      {description && (
        <FormDescription className="text-base">
          {description}
        </FormDescription>
      )}
      <FormControl>
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          rows={rows}
          className="text-lg resize-none"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}

// Photo capture field for inspections
interface InspectionPhotoProps extends BaseInspectionFieldProps {
  photos?: Array<{ url: string; name: string; timestamp: string }>
  onPhotoCapture?: (photo: File) => void
  onPhotoRemove?: (index: number) => void
  maxPhotos?: number
}

const InspectionPhoto = ({
  label,
  description,
  required,
  priority = "normal",
  photos = [],
  onPhotoCapture,
  onPhotoRemove,
  maxPhotos = 5,
  className,
}: InspectionPhotoProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onPhotoCapture) {
      onPhotoCapture(file)
    }
  }

  return (
    <FormItem className={cn("space-y-3", className)}>
      <FormLabel className="text-base font-semibold flex items-center gap-2">
        <Camera className="h-5 w-5" />
        {priority === "critical" && <AlertTriangle className="h-5 w-5 text-warehouse-stop" />}
        {priority === "high" && <AlertTriangle className="h-4 w-4 text-warehouse-caution" />}
        {label}
        {required && <span className="text-warehouse-stop">*</span>}
      </FormLabel>
      {description && (
        <FormDescription className="text-base">
          {description}
        </FormDescription>
      )}

      <div className="space-y-3">
        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => onPhotoRemove?.(index)}
                  className="absolute top-2 right-2 bg-warehouse-stop text-white rounded-full p-1 hover:bg-warehouse-stop/90"
                >
                  ×
                </button>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {photo.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add photo button */}
        {photos.length < maxPhotos && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-warehouse-info hover:bg-warehouse-info-light/20 transition-colors"
            >
              <Camera className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                Capture Photo ({photos.length}/{maxPhotos})
              </span>
            </button>
          </>
        )}
      </div>
      <FormMessage />
    </FormItem>
  )
}

// Section divider for organizing inspection forms
interface InspectionSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  priority?: "normal" | "high" | "critical"
  collapsible?: boolean
  defaultExpanded?: boolean
}

const InspectionSection = ({
  title,
  description,
  children,
  priority = "normal",
  collapsible = false,
  defaultExpanded = true,
}: InspectionSectionProps) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const getPriorityStyles = () => {
    switch (priority) {
      case "critical":
        return "border-warehouse-stop bg-warehouse-stop-light/10"
      case "high":
        return "border-warehouse-caution bg-warehouse-caution-light/10"
      default:
        return "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
    }
  }

  const getPriorityIcon = () => {
    switch (priority) {
      case "critical":
        return <AlertTriangle className="h-6 w-6 text-warehouse-stop" />
      case "high":
        return <AlertTriangle className="h-5 w-5 text-warehouse-caution" />
      default:
        return <FileText className="h-5 w-5 text-slate-600" />
    }
  }

  return (
    <div className={cn(
      "border rounded-lg p-6 space-y-6",
      getPriorityStyles()
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getPriorityIcon()}
          <div>
            <h3 className="text-xl font-bold text-warehouse-text-primary">
              {title}
            </h3>
            {description && (
              <p className="text-base text-warehouse-text-secondary mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 hover:text-slate-700"
          >
            {isExpanded ? "−" : "+"}
          </button>
        )}
      </div>

      {(!collapsible || isExpanded) && (
        <div className="space-y-6">
          {children}
        </div>
      )}
    </div>
  )
}

export {
  InspectionCheckbox,
  InspectionRadio,
  InspectionInput,
  InspectionTextarea,
  InspectionPhoto,
  InspectionSection,
  type InspectionCheckboxProps,
  type InspectionRadioProps,
  type InspectionInputProps,
  type InspectionTextareaProps,
  type InspectionPhotoProps,
  type InspectionSectionProps,
}