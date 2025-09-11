'use client';

import { Button } from '@/components/ui/button';
import { PrinterIcon } from '@heroicons/react/24/solid';

interface PrintModalActionsProps {
  onClose: () => void;
  onPrint: () => void;
  printing: boolean;
  loading: boolean;
}

export default function PrintModalActions({
  onClose,
  onPrint,
  printing,
  loading
}: PrintModalActionsProps) {
  return (
    <div className="bg-gray-100 p-6 flex justify-end gap-4">
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
        {printing ? 'PRINTING...' : 'PRINT ALL LABELS'}
      </Button>
    </div>
  );
}