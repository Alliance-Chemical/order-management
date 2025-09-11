'use client';

import React, { useState } from 'react';
import { IssueModalProps, InspectionItem } from '@/lib/types/agent-view';
import { Button } from '@/components/ui/button';
import { notifyWorkspace } from '@/app/actions/workspace';

export default function IssueModal({ 
  isOpen, 
  onClose, 
  orderId, 
  item, 
  workflowPhase,
  onIssueReported 
}: IssueModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const commonReasons = [
    { id: 'leaking', label: 'LEAKING', icon: '💧' },
    { id: 'wrong_label', label: 'WRONG LABEL', icon: '🏷️' },
    { id: 'damaged', label: 'DAMAGED', icon: '⚠️' },
    { id: 'contaminated', label: 'CONTAMINATED', icon: '☣️' },
    { id: 'missing_seal', label: 'MISSING SEAL', icon: '🔓' },
    { id: 'wrong_quantity', label: 'WRONG QUANTITY', icon: '📦' },
    { id: 'other', label: 'OTHER ISSUE', icon: '❓' },
  ];

  const handleReasonClick = async (reason: { id: string; label: string }) => {
    setIsSubmitting(true);
    
    const phaseLabel = workflowPhase === 'pre_mix' ? 'Pre-Mix' : 'Pre-Ship';
    const notes = `${phaseLabel} Failure: ${item.label} - ${reason.label}`;
    
    try {
      // Send notification to supervisor using server action
      const result = await notifyWorkspace(orderId, {
        type: 'issue_reported',
        status: 'failed',
        notes: notes,
      });

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          onIssueReported(notes);
        }, 1500);
      } else {
        // Even if notification fails, still record the issue
        console.error('Failed to send notification, but recording issue');
        onIssueReported(notes);
      }
    } catch (error) {
      console.error('Error reporting issue:', error);
      // Still record the issue even if notification fails
      onIssueReported(notes);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="worker-subtitle mb-4">Issue Reported!</h2>
            <p className="worker-text text-gray-600">Supervisor has been notified</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-worker-red text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="worker-title text-white">REPORT ISSUE</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl"
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>
          <p className="worker-text text-white mt-2 opacity-90">
            {item.label} - Select the issue type
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commonReasons.map((reason) => (
              <Button
                key={reason.id}
                onClick={() => handleReasonClick(reason)}
                disabled={isSubmitting}
                variant="caution"
                size="large"
                haptic="warning"
                fullWidth
                icon={<span className="text-3xl">{reason.icon}</span>}
              >
                {reason.label}
              </Button>
            ))}
          </div>

          {/* Cancel button */}
          <div className="mt-6 flex justify-center">
            <Button
              onClick={onClose}
              disabled={isSubmitting}
              variant="neutral"
              size="large"
            >
              CANCEL
            </Button>
          </div>
        </div>

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-worker-red mx-auto mb-4"></div>
              <p className="worker-text">Reporting issue to supervisor...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}