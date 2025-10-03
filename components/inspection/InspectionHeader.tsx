'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ProgressBar from '@/components/ui/ProgressBar'
import StatusLight from '@/components/ui/StatusLight'

interface InspectionHeaderProps {
  orderNumber: string
  customerName: string
  currentIndex: number
  totalItems: number
  progress: number
  networkStatus: boolean
  queueLength: number
  canUndo: boolean
  onBack: () => void
  onUndo: () => void
  onSwitchToSupervisor: () => void
}

export function InspectionHeader({
  orderNumber,
  customerName,
  currentIndex,
  totalItems,
  progress,
  networkStatus,
  queueLength,
  canUndo,
  onBack,
  onUndo,
  onSwitchToSupervisor
}: InspectionHeaderProps) {
  return (
    <>
      {/* Network Status Bar */}
      {!networkStatus && (
        <div className="bg-yellow-500 text-white px-4 py-2 flex items-center justify-center gap-3">
          <StatusLight status="caution" size="base" />
          <span>
            <span className="font-semibold">Offline Mode</span> - Changes will sync when connection restored
            {queueLength > 0 && (
              <span className="ml-2">({queueLength} pending)</span>
            )}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              ← Back to Dashboard
            </Link>
            <Button
              onClick={onBack}
              disabled={currentIndex === 0}
              variant="neutral"
              size="base"
            >
              ← Back
            </Button>
          </div>

          <div className="flex gap-2">
            {canUndo && (
              <Button
                onClick={onUndo}
                variant="info"
                size="base"
              >
                Undo
              </Button>
            )}
            
            <Button
              onClick={onSwitchToSupervisor}
              variant="info"
              size="base"
            >
              Supervisor View
            </Button>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold">Order #{orderNumber}</h1>
        <p className="text-blue-100">{customerName}</p>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <ProgressBar
            value={progress}
            label={`Step ${currentIndex + 1} of ${totalItems}`}
            showPercentage={true}
            variant="default"
            animated={true}
          />
        </div>
      </div>
    </>
  )
}
