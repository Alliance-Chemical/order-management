// ShipStation Tag Map - Source of Truth for Order State
// Tags determine the workflow phase, not our database

export const TAGS = {
  FREIGHT_ORDERS: Number(process.env.FREIGHT_ORDER_TAG || 19844),      // red (general freight intake)
  FREIGHT_BOOKED: Number(process.env.FREIGHT_BOOKED_TAG_ID || 60447),  // yellow (freight booked/confirmed)
  FREIGHT_READY: Number(process.env.FREIGHT_READY_TAG_ID || 44123),    // green (inspection passed)

  // Aliases for semantic consistency if tag names change
  ALIASES: {
    BOOKED: [Number(process.env.FREIGHT_BOOKED_TAG_ID || 60447)],
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
  const hasBooked = TAGS.ALIASES.BOOKED.some(id => tagIds.includes(id));
  
  // Precedence: ready > staged > planning
  if (hasReady) return 'ready_to_ship';  // Pre-ship inspection passed
  if (hasBooked) return 'pre_mix';       // Freight booked/confirmed
  return 'planning';                     // Initial state
}

/**
 * Determine what tags are needed for a target phase
 */
export function getRequiredTags(targetPhase: Phase): number[] {
  switch (targetPhase) {
    case 'pre_mix':
      return [TAGS.FREIGHT_BOOKED];
    case 'ready_to_ship':
      return [TAGS.FREIGHT_BOOKED, TAGS.FREIGHT_READY];
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
  const remove: number[] = [];

  // Once an order is ready to ship, drop the general Freight Orders tag so it
  // no longer appears in the freight staging queue.
  if (
    targetPhase === 'ready_to_ship' &&
    currentTagIds.includes(TAGS.FREIGHT_ORDERS)
  ) {
    remove.push(TAGS.FREIGHT_ORDERS);
  }
  
  return { add, remove };
}
