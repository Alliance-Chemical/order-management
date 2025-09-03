export type WorkflowPhase = 'pre_mix' | 'pre_ship' | string;

interface WorkspaceLike {
  workflowPhase: WorkflowPhase;
  moduleStates?: Record<string, any>;
}

interface OrderItemLike { name?: string }

export function buildInspectionItems(workspace: WorkspaceLike, selectedItem?: OrderItemLike | null) {
  const sourceAssignments = (workspace.moduleStates as any)?.sourceAssignments || [];

  let itemWorkflowType: string | null = null;
  if (selectedItem) {
    const itemAssignment = sourceAssignments.find((sa: any) => {
      if (!sa.productName || !selectedItem.name) return false;
      const productNameLower = String(sa.productName).toLowerCase();
      const itemNameLower = String(selectedItem.name).toLowerCase();
      return itemNameLower.includes(productNameLower) ||
             productNameLower.includes(itemNameLower.split('-')[0].trim());
    });
    itemWorkflowType = itemAssignment?.workflowType ?? null;
  }

  let inspectionItems: Array<{ id: string; label: string; description: string }>;
  inspectionItems = [];

  if (workspace.workflowPhase === 'pre_mix') {
    if (itemWorkflowType !== 'direct_resell') {
      const hasPumpAndFillItems = sourceAssignments.some((a: any) => a.workflowType === 'pump_and_fill');
      if (hasPumpAndFillItems || !selectedItem) {
        inspectionItems.push(
          { id: 'scan_source_qr', label: 'Scan Source QR', description: 'Scan QR code on SOURCE container (bulk container to pump from)' },
          { id: 'verify_source_chemical', label: 'Verify Source Chemical', description: 'Confirm SOURCE container matches expected chemical (pump & fill only)' }
        );
      }
    }

    inspectionItems.push(
      { id: 'container_condition', label: 'Check Destination Containers', description: 'Inspect DESTINATION containers for damage, leaks, or contamination (containers going to customer)' },
      { id: 'label_verification', label: 'Verify Destination Labels', description: 'Verify labels on DESTINATION containers match order specifications' },
      { id: 'quantity_check', label: 'Count Destination Containers', description: 'Confirm correct quantity of DESTINATION containers' },
      { id: 'scan_destination_qr', label: 'Scan Destination QR', description: 'Scan QR code on each DESTINATION container' },
      { id: 'hazmat_placards', label: 'Check Destination Hazmat', description: 'Verify proper hazmat labeling on DESTINATION containers if required' },
      { id: 'seal_integrity', label: 'Check Destination Seals', description: 'Check all seals on DESTINATION containers are intact' }
    );
  } else {
    inspectionItems = [
      { id: 'final_container_check', label: 'Final Container Check', description: 'Verify containers are clean and sealed' },
      { id: 'shipping_labels', label: 'Shipping Labels', description: 'Confirm all shipping labels are correct' },
      { id: 'pallet_stability', label: 'Pallet Stability', description: 'Check pallet is stable and properly wrapped' },
      { id: 'documentation_complete', label: 'Documentation Complete', description: 'All required documents are included' },
      { id: 'weight_verification', label: 'Weight Verification', description: 'Verify total weight matches order' },
    ];
  }

  return inspectionItems;
}

