export type Phase = 'pending' | 'planning' | 'pre_mix_inspection' | 'mixing' | 'post_mix_qc' | 'pre_ship_inspection' | 'ready_to_ship' | 'shipped' | 'archived';

export function nextPhase(current: Phase, result: 'pass' | 'fail'): Phase {
  if (result === 'fail') return current;
  switch (current) {
    case 'planning': return 'pre_mix_inspection';
    case 'pre_mix_inspection': return 'mixing';
    case 'mixing': return 'post_mix_qc';
    case 'post_mix_qc': return 'pre_ship_inspection';
    case 'pre_ship_inspection': return 'ready_to_ship';
    default: return current;
  }
}

export function canRequestOverride(phase: Phase): boolean {
  return ['pre_mix_inspection', 'post_mix_qc', 'pre_ship_inspection'].includes(phase);
}

export function isInspectionPhase(phase: Phase): boolean {
  return ['pre_mix_inspection', 'post_mix_qc', 'pre_ship_inspection'].includes(phase);
}