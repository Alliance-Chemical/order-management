'use client';

import React from 'react';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import StatusLight from '@/components/ui/StatusLight';
import { Button } from '@/components/ui/button';

interface TaskListItemProps {
  item: {
    lineItemId?: string;
    sku?: string;
    name: string;
    quantity: number;
    unitPrice?: number;
  };
  workflowType?: 'pump_and_fill' | 'direct_resell';
  requiresDilution?: boolean;
  status?: 'pending' | 'in_progress' | 'completed';
  onStartInspection: () => void;
}

export default function TaskListItem({ 
  item, 
  workflowType, 
  requiresDilution,
  status = 'pending',
  onStartInspection 
}: TaskListItemProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-3">
            <StatusLight status="go" size="lg" pulse={false} />
            <div className="warehouse-badge-go">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>COMPLETE</span>
            </div>
          </div>
        );
      case 'in_progress':
        return (
          <div className="flex items-center gap-3">
            <StatusLight status="caution" size="lg" />
            <div className="warehouse-badge-caution animate-pulse-strong">
              <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>IN PROGRESS</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3">
            <StatusLight status="off" size="lg" />
            <div className="warehouse-badge px-4 py-2 bg-gray-200 text-warehouse-text-primary border-gray-500">
              <span>WAITING</span>
            </div>
          </div>
        );
    }
  };

  const getWorkflowBadge = () => {
    if (workflowType === 'direct_resell') {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-warehouse bg-green-100 border-2 border-warehouse-go">
          <svg className="w-6 h-6 text-warehouse-go" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-warehouse-sm font-black text-warehouse-go">DIRECT RESELL</span>
        </div>
      );
    } else if (workflowType === 'pump_and_fill') {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-warehouse bg-blue-100 border-2 border-warehouse-info">
          <svg className="w-6 h-6 text-warehouse-info" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span className="text-warehouse-sm font-black text-warehouse-info">PUMP & FILL</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`warehouse-ticket relative mb-6 ${
      status === 'completed' ? 'opacity-75 bg-green-50' : 
      status === 'in_progress' ? 'warehouse-card-active animate-pulse-strong' : 
      'hover:shadow-warehouse-xl hover:scale-[1.02] transition-all cursor-pointer'
    }`}>
      {/* Job Ticket Number */}
      <div className="absolute -top-3 -right-3 bg-warehouse-caution text-warehouse-text-primary px-4 py-2 rounded-full font-black text-warehouse-lg shadow-warehouse-lg transform rotate-12">
        JOB #{item.lineItemId?.slice(-4) || Math.floor(Math.random() * 9999)}
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          {/* Priority Header */}
          <div className="flex items-center gap-4 mb-4">
            {workflowType === 'pump_and_fill' && (
              <div className="text-warehouse-caution">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <div className="warehouse-label text-warehouse-text-secondary">ITEM TO INSPECT</div>
              <h3 className="text-warehouse-2xl font-black text-warehouse-text-primary leading-tight mt-1">
                {item.name}
              </h3>
            </div>
          </div>
          
          {/* Item Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-100 rounded-warehouse p-4">
              <div className="warehouse-label text-warehouse-text-secondary mb-1">QUANTITY</div>
              <div className="text-warehouse-3xl font-black text-warehouse-text-primary">{item.quantity}</div>
            </div>
            {item.sku && (
              <div className="bg-gray-100 rounded-warehouse p-4">
                <div className="warehouse-label text-warehouse-text-secondary mb-1">SKU</div>
                <div className="text-warehouse-lg font-bold text-warehouse-text-primary">{item.sku}</div>
              </div>
            )}
          </div>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-4">
            {getWorkflowBadge()}
            {requiresDilution && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-warehouse bg-orange-100 border-2 border-orange-500">
                <div className="text-orange-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-warehouse-sm font-black text-orange-700">NEEDS DILUTION</span>
              </div>
            )}
          </div>
          
          {/* Status */}
          <div className="flex items-center justify-between">
            {getStatusDisplay()}
          </div>
        </div>

        {/* Action Area */}
        <div className="flex items-center">
          {status === 'pending' && (
            <Button
              onClick={onStartInspection}
              variant="go"
              size="xlarge"
              haptic="success"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            >
              <div className="flex flex-col items-center">
                <span className="text-warehouse-xl">START</span>
                <span className="text-warehouse-base opacity-90">INSPECTION</span>
              </div>
            </Button>
          )}
          {status === 'in_progress' && (
            <Button
              onClick={onStartInspection}
              variant="caution"
              size="xlarge"
              haptic="warning"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <div className="flex flex-col items-center">
                <span className="text-warehouse-xl">RESUME</span>
                <span className="text-warehouse-base opacity-90">TASK</span>
              </div>
            </Button>
          )}
          {status === 'completed' && (
            <div className="warehouse-success min-h-touch-base px-8 py-6 rounded-warehouse-lg flex flex-col items-center justify-center">
              <div className="warehouse-icon-xl mb-2">
                <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-warehouse-xl font-black">DONE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}