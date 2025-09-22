'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface QualityCheckButtonProps {
  workspaceId: string;
  defaultCheckType?: string;
  onQualityRecorded?: () => void;
}

const CHECK_TYPES = {
  'concentration_verify': 'Concentration Verification',
  'container_inspect': 'Container Inspection',
  'label_check': 'Label Check',
  'pre_ship_inspection': 'Pre-Ship Inspection',
  'batch_quality': 'Batch Quality Check',
};

const RESULTS = {
  'pass': { label: 'Pass', icon: CheckCircle, color: 'text-green-600' },
  'fail': { label: 'Fail', icon: XCircle, color: 'text-red-600' },
  'conditional': { label: 'Conditional', icon: AlertCircle, color: 'text-yellow-600' },
};

export default function QualityCheckButton({
  workspaceId,
  defaultCheckType = 'pre_ship_inspection',
  onQualityRecorded
}: QualityCheckButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkType, setCheckType] = useState(defaultCheckType);
  const [result, setResult] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!result) {
      toast.error('Please select a result');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/quality?type=quality-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          checkType,
          result,
          checkedBy: 'Warehouse User', // TODO: Get from auth context
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record quality check');
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Quality check recorded successfully');
        setIsOpen(false);
        setResult('');
        setNotes('');
        onQualityRecorded?.();
      } else {
        throw new Error(data.error || 'Failed to record quality check');
      }
    } catch (error) {
      console.error('Error recording quality check:', error);
      toast.error('Failed to record quality check');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ResultIcon = result ? RESULTS[result as keyof typeof RESULTS]?.icon : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CheckCircle className="h-4 w-4" />
          Record Quality Check
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Quality Check</DialogTitle>
          <DialogDescription>
            Document quality verification for ISO 9001 compliance
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="checkType">Check Type</Label>
            <Select value={checkType} onValueChange={setCheckType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHECK_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="result">Result</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger>
                <SelectValue placeholder="Select result..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESULTS).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <config.icon className={`h-4 w-4 ${config.color}`} />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about the quality check..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {result && (
            <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {ResultIcon && (
                  <ResultIcon className={`h-5 w-5 ${RESULTS[result as keyof typeof RESULTS].color}`} />
                )}
                <span className="font-medium">
                  {RESULTS[result as keyof typeof RESULTS]?.label}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!result || isSubmitting}
          >
            {isSubmitting ? 'Recording...' : 'Record Check'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}