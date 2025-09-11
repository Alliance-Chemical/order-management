'use client'

import { Button } from '@/components/ui/button'

interface InspectionActionsProps {
  requiresQRScan: boolean
  onScanQR: () => void
  onSkipQR: () => void
  onPass: () => void
  onFail: () => void
}

export function InspectionActions({
  requiresQRScan,
  onScanQR,
  onSkipQR,
  onPass,
  onFail
}: InspectionActionsProps) {
  if (requiresQRScan) {
    return (
      <div className="space-y-4">
        <Button
          onClick={onScanQR}
          variant="info"
          size="xlarge"
          fullWidth
          haptic="light"
          icon={
            <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          <span className="text-2xl">Scan QR Code</span>
        </Button>
        
        <Button
          onClick={() => {
            const reason = prompt('Why are you skipping the QR scan?')
            if (reason && reason.trim()) {
              onSkipQR()
            }
          }}
          variant="neutral"
          size="large"
          fullWidth
        >
          Skip QR Scan
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        onClick={onPass}
        variant="go"
        size="xlarge"
        fullWidth
        haptic="success"
        icon={
          <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        }
      >
        <span className="text-2xl">Pass</span>
      </Button>
      
      <Button
        onClick={onFail}
        variant="stop"
        size="xlarge"
        fullWidth
        haptic="error"
        icon={
          <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        }
      >
        <span className="text-2xl">Fail</span>
      </Button>
    </div>
  )
}