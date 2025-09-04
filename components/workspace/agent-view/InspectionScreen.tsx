"use client";

import ResilientInspectionScreen from '@/components/workspace/agent-view/ResilientInspectionScreen';
import { InspectionScreenProps } from '@/lib/types/agent-view';

// Consolidated adapter: forwards to the resilient implementation
export default function InspectionScreen(props: InspectionScreenProps) {
  const {
    orderId,
    orderNumber,
    customerName,
    orderItems = [],
    workflowPhase,
    workflowType = 'pump_and_fill',
    items,
    onComplete,
    onSwitchToSupervisor,
  } = props;

  // Adapt the callback signature expected by the resilient screen
  const handleComplete = (
    results: Record<string, 'pass' | 'fail'>,
    notes: Record<string, string>
  ) => {
    onComplete({
      checklist: results,
      notes: Object.entries(notes).map(([k, v]) => `${k}: ${v}`).join('\n'),
      completedAt: new Date().toISOString(),
      completedBy: 'worker',
    });
  };

  return (
    <ResilientInspectionScreen
      orderId={orderId}
      orderNumber={orderNumber || String(orderId)}
      customerName={customerName || ''}
      orderItems={orderItems}
      workflowPhase={workflowPhase}
      workflowType={workflowType as any}
      items={items}
      onComplete={handleComplete}
      onSwitchToSupervisor={onSwitchToSupervisor}
    />
  );
}

