// ShipStation Tag Map - Source of Truth for Order State
// Tags determine the workflow phase, not our database

export const TAGS = {
  FREIGHT_ORDERS: Number(process.env.FREIGHT_ORDERS_TAG_ID || 19844), // red (general freight)
  FREIGHT_STAGED: Number(process.env.FREIGHT_STAGED_TAG_ID || 44777), // yellow (Need Labels)
  FREIGHT_READY: Number(process.env.FREIGHT_READY_TAG_ID || 44123),   // green (Freight Order Ready)
  
  // Aliases for semantic consistency if tag names change
  ALIASES: {
    STAGED: [Number(process.env.FREIGHT_STAGED_TAG_ID || 44777)],
    READY: [Number(process.env.FREIGHT_READY_TAG_ID || 44123)],
  }
};

export type Phase = 'planning' | 'pre_mix' | 'pre_ship' | 'ready_to_ship' | 'shipped';

/**
 * Derive workflow phase from ShipStation tags
 * This is the canonical way to determine order state
 */
export function derivePhase(tagIds: number[], orderStatus?: string): Phase {
  // Shipped status overrides all tags
  if (orderStatus === 'shipped') return 'shipped';
  
  const hasReady = TAGS.ALIASES.READY.some(id => tagIds.includes(id));
  const hasStaged = TAGS.ALIASES.STAGED.some(id => tagIds.includes(id));
  
  // Precedence: ready > staged > planning
  if (hasReady) return 'ready_to_ship';  // Pre-ship inspection passed
  if (hasStaged) return 'pre_mix';        // Planning locked/staged
  return 'planning';                      // Initial state
}

/**
 * Determine what tags are needed for a target phase
 */
export function getRequiredTags(targetPhase: Phase): number[] {
  switch (targetPhase) {
    case 'pre_mix':
      return [TAGS.FREIGHT_STAGED];
    case 'ready_to_ship':
      return [TAGS.FREIGHT_STAGED, TAGS.FREIGHT_READY];
    case 'shipped':
      // No specific tags needed - handled by order status
      return [];
    default:
      return [];
  }
}

/**
 * Calculate tag operations needed to reach target phase
 */
export function calculateTagDelta(
  currentTagIds: number[], 
  targetPhase: Phase
): { add: number[], remove: number[] } {
  const required = getRequiredTags(targetPhase);
  const add = required.filter(id => !currentTagIds.includes(id));
  
  // We generally don't remove tags (additive model)
  // But if needed, logic goes here
  const remove: number[] = [];
  
  return { add, remove };
}