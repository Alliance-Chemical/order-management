'use client';

import { Button } from '@/components/ui/button';
import { PrinterIcon } from '@heroicons/react/24/solid';

interface PrintModalActionsProps {
  onClose: () => void;
  onPrint: () => void;
  printing: boolean;
  loading: boolean;
  mode?: 'reprint' | 'generate';
  onModeChange?: (mode: 'reprint' | 'generate') => void;
}

export default function PrintModalActions({
  onClose,
  onPrint,
  printing,
  loading,
  mode = 'reprint',
  onModeChange,
}: PrintModalActionsProps) {
  return (
    <div className="bg-gray-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Mode:</span>
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-300">
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('reprint')}
            className={`px-3 py-2 text-sm font-medium ${mode === 'reprint' ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600'}`}
          >
            Reprint Existing
          </button>
          <button
            type="button"
            onClick={() => onModeChange && onModeChange('generate')}
            className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${mode === 'generate' ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600'}`}
          >
            Generate New
          </button>
        </div>
      </div>

      {/* Actions */}
      <Button
        onClick={onClose}
        variant="neutral"
        size="large"
      >
        CANCEL
      </Button>
      <Button
        onClick={onPrint}
        disabled={printing || loading}
        variant="go"
        size="xlarge"
        loading={printing}
        icon={<PrinterIcon className="h-8 w-8" />}
        haptic="success"
      >
        {printing ? 'PRINTING...' : mode === 'generate' ? 'GENERATE & PRINT' : 'PRINT ALL LABELS'}
      </Button>
    </div>
  );
}
