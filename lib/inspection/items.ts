export type WorkflowPhase = 'pre_mix' | 'pre_ship' | string;

interface WorkspaceLike {
  workflowPhase: WorkflowPhase;
  moduleStates?: Record<string, unknown>;
}

interface OrderItemLike { name?: string }

export function buildInspectionItems(workspace: WorkspaceLike, _selectedItem?: OrderItemLike | null) {
  let inspectionItems: Array<{ id: string; label: string; description: string }>;
  inspectionItems = [];

  if (workspace.workflowPhase === 'pre_mix') {
    inspectionItems.push(
      { id: 'basic_info', label: 'Basic Information', description: 'Enter Date Performed, Invoice #, and Inspector name' },
      { id: 'packing_slip', label: 'Packing Slip Verification', description: 'Verify ship to match, ship via, ship date, P.O. number, signature label, and freight' },
      { id: 'lot_numbers', label: 'Lot Numbers', description: 'Enter lot numbers' },
      { id: 'product_inspection', label: 'Product Inspection', description: 'Check label information, lid condition, and required GHS / hazmat markings' },
      { id: 'container_condition', label: 'Check Destination Containers', description: 'Inspect DESTINATION containers for damage, leaks, or contamination (containers going to customer)' },
      { id: 'label_verification', label: 'Verify Destination Labels', description: 'Verify labels on DESTINATION containers match order specifications' },
      { id: 'quantity_check', label: 'Count Destination Containers', description: 'Confirm correct quantity of DESTINATION containers' },
      { id: 'scan_destination_qr', label: 'Scan Destination QR', description: 'Scan QR code on each DESTINATION container' },
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
