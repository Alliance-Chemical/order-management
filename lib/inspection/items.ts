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
    inspectionItems = [
      {
        id: 'scan_qr',
        label: 'QR Bind & Verify',
        description: 'Scan or enter the container QR code so the run is bound before any checks begin.'
      },
      {
        id: 'inspection_info',
        label: 'Inspection Header',
        description: 'Confirm the order number, timestamp, and assigned inspector details up front.'
      },
      {
        id: 'verify_packing_label',
        label: 'Package Match Verification',
        description: 'Compare the physical package to the order—ship-to, company, order number, and product description must align or be documented.'
      },
      {
        id: 'verify_product_label',
        label: 'Product Label Compliance',
        description: 'Check grade, UN number, packing group, closure integrity, and GHS labels with supporting photos.'
      },
      {
        id: 'lot_number',
        label: 'Lot Capture',
        description: 'Record the printed lot numbers—type them exactly as shown or use the AI assist.'
      },
      {
        id: 'final_review',
        label: 'Final Review & Sign Off',
        description: 'Review the inspection summary, reconfirm the lot entries, and sign off before completion.'
      }
    ];
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
