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

  return (
    <ResilientInspectionScreen
      orderId={orderId}
      orderNumber={orderNumber || String(orderId)}
      customerName={customerName || ''}
      orderItems={orderItems}
      workflowPhase={workflowPhase}
      workflowType={workflowType as any}
      items={items}
      onComplete={onComplete}
      onSwitchToSupervisor={onSwitchToSupervisor}
    />
  );
}

