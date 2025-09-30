import { describe, expect, it } from 'vitest'

import { calculateTagDelta, TAGS } from '../../lib/services/shipstation/tag-map'

describe('calculateTagDelta', () => {
  it('removes the Freight Orders tag when promoting to ready_to_ship', () => {
    const delta = calculateTagDelta(
      [
        TAGS.FREIGHT_ORDERS,
        TAGS.FREIGHT_READY,
        TAGS.FREIGHT_BOOKED,
      ],
      'ready_to_ship'
    )

    expect(delta.remove).toContain(TAGS.FREIGHT_ORDERS)
  })

  it('skips removals when the Freight Orders tag is absent', () => {
    const delta = calculateTagDelta(
      [TAGS.FREIGHT_READY, TAGS.FREIGHT_BOOKED],
      'ready_to_ship'
    )

    expect(delta.remove).toHaveLength(0)
  })
})
