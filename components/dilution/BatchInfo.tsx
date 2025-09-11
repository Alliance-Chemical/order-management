'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  UserIcon, 
  TagIcon, 
  DocumentTextIcon,
  PrinterIcon,
  ArrowDownTrayIcon 
} from '@heroicons/react/24/outline'

interface BatchInfoProps {
  completedBy: string
  setCompletedBy: (value: string) => void
  batchNumber: string
  setBatchNumber: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  onSave: () => void
  onPrint: () => void
  onExport: () => void
  canSave: boolean
}

export function BatchInfo({
  completedBy,
  setCompletedBy,
  batchNumber,
  setBatchNumber,
  notes,
  setNotes,
  onSave,
  onPrint,
  onExport,
  canSave
}: BatchInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5" />
          Batch Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completed By */}
        <div className="space-y-2">
          <Label htmlFor="completed-by" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Completed By
          </Label>
          <Input
            id="completed-by"
            value={completedBy}
            onChange={(e) => setCompletedBy(e.target.value)}
            placeholder="Enter operator name"
          />
        </div>

        {/* Batch Number */}
        <div className="space-y-2">
          <Label htmlFor="batch-number" className="flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            Batch Number
          </Label>
          <Input
            id="batch-number"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            placeholder="e.g., BATCH-2025-001"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or observations..."
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onSave}
            disabled={!canSave}
            className="flex-1 sm:flex-none"
          >
            Save Batch
          </Button>
          <Button
            onClick={onPrint}
            variant="outline"
            disabled={!canSave}
            className="flex-1 sm:flex-none"
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            Print Report
          </Button>
          <Button
            onClick={onExport}
            variant="outline"
            disabled={!canSave}
            className="flex-1 sm:flex-none"
          >
            <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}