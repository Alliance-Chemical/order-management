'use client';

import React from 'react';

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
  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Complete
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            Pending
          </span>
        );
    }
  };

  const getWorkflowBadge = () => {
    if (workflowType === 'direct_resell') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Direct Resell
        </span>
      );
    } else if (workflowType === 'pump_and_fill') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Pump & Fill
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 mb-4 border-2 ${
      status === 'completed' ? 'border-green-300 bg-green-50' : 
      status === 'in_progress' ? 'border-yellow-300 bg-yellow-50' : 
      'border-gray-200 hover:border-blue-300 transition-colors'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* Item details */}
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <span className="text-2xl font-bold">{item.quantity}</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {getWorkflowBadge()}
                {requiresDilution && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                    <span className="mr-1">💧</span>
                    Dilution Required
                  </span>
                )}
                {item.sku && (
                  <span className="text-xs text-gray-500">SKU: {item.sku}</span>
                )}
              </div>
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="ml-4">
          {status === 'pending' && (
            <button
              onClick={onStartInspection}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Start Inspection</span>
              </span>
            </button>
          )}
          {status === 'in_progress' && (
            <button
              onClick={onStartInspection}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg shadow-lg transform transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-yellow-300"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Resume</span>
              </span>
            </button>
          )}
          {status === 'completed' && (
            <div className="px-6 py-3 bg-green-100 text-green-800 font-bold rounded-lg flex items-center space-x-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}