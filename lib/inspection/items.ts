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
        label: 'Scan QR',
        description: 'Scan and validate the QR to bind this run automatically before moving on.'
      },
      {
        id: 'inspection_info',
        label: 'Inspection Information',
        description: 'Confirm the auto-filled order number and timestamp look right, then select yourself as the inspector before moving on.'
      },
      {
        id: 'verify_packing_label',
        label: 'Verify / Compare (Packing Label)',
        description: 'Work the checklist: Ship-To, company, order number, and description must all match or you document the mismatch with photos.'
      },
      {
        id: 'verify_product_label',
        label: 'Verify Product Label (Checklist + Photo Gate)',
        description: 'Confirm grade, UN, packing group, lid, and GHS labels—with photo evidence—and flag anything off before continuing.'
      },
      {
        id: 'lot_number',
        label: 'LOT Number',
        description: 'Capture printed lot numbers once—use the camera assist or type them in exactly as shown.'
      },
      {
        id: 'final_review',
        label: 'Final Review & Sign Off',
        description: 'Review all inspection data, reconfirm lots, and finalize the run.'
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
