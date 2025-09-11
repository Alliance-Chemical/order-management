'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface PreShipActionButtonsProps {
  onPass: () => void;
  onFail: (note: string) => void;
  noteError: string | null;
}

export function PreShipActionButtons({ onPass, onFail, noteError }: PreShipActionButtonsProps) {
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [failureNote, setFailureNote] = useState('');

  const handleFailClick = () => {
    setShowFailDialog(true);
    setFailureNote('');
  };

  const handleConfirmFail = () => {
    if (failureNote.trim()) {
      onFail(failureNote.trim());
      setShowFailDialog(false);
    }
  };

  return (
    <>
      <div className="p-4 flex gap-4">
        <Button
          onClick={handleFailClick}
          variant="stop"
          size="xlarge"
          className="flex-1"
        >
          <XMarkIcon className="w-12 h-12 mr-2" />
          <span className="text-2xl font-bold">FAIL</span>
        </Button>
        <Button
          onClick={onPass}
          variant="go"
          size="xlarge"
          className="flex-1"
        >
          <CheckIcon className="w-12 h-12 mr-2" />
          <span className="text-2xl font-bold">PASS</span>
        </Button>
      </div>
      
      {noteError && (
        <div className="p-4 text-center text-yellow-300">{noteError}</div>
      )}

      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="What's wrong? (required)"
              value={failureNote}
              onChange={(e) => setFailureNote(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFailDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmFail}
              disabled={!failureNote.trim()}
            >
              Report Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}