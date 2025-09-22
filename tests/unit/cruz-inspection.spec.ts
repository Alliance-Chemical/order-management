import { describe, expect, it } from 'vitest'

import {
  computeRunStatusAfterStep,
  validateStepPayload,
  type CruzInspectionRun,
} from '../../lib/inspection/cruz'

describe('validateStepPayload', () => {
  it('accepts a passing packing label payload when all checks are true', () => {
    const payload = validateStepPayload('verify_packing_label', {
      shipToOk: true,
      companyOk: true,
      orderNumberOk: true,
      productDescriptionOk: true,
      gate1Outcome: 'PASS',
      photos: [],
      completedAt: new Date().toISOString(),
    })

    expect(payload.gate1Outcome).toBe('PASS')
  })

  it('rejects a failing packing label payload without reason or photos', () => {
    expect(() =>
      validateStepPayload('verify_packing_label', {
        shipToOk: true,
        companyOk: true,
        orderNumberOk: true,
        productDescriptionOk: false,
        gate1Outcome: 'FAIL',
        photos: [],
        completedAt: new Date().toISOString(),
      })
    ).toThrow()
  })

  it('requires at least one photo for product label verification', () => {
    expect(() =>
      validateStepPayload('verify_product_label', {
        gradeOk: true,
        unOk: true,
        pgOk: true,
        lidOk: true,
        ghsOk: true,
        gate2Outcome: 'PASS',
        photos: [],
        completedAt: new Date().toISOString(),
      })
    ).toThrow()
  })

  it('requires an issue reason when product label fails', () => {
    expect(() =>
      validateStepPayload('verify_product_label', {
        gradeOk: true,
        unOk: true,
        pgOk: false,
        lidOk: true,
        ghsOk: true,
        gate2Outcome: 'FAIL',
        photos: [
          {
            id: 'photo-1',
            name: 'issue.jpg',
            uploadedAt: new Date().toISOString(),
          },
        ],
        completedAt: new Date().toISOString(),
      })
    ).toThrow()
  })
})

describe('computeRunStatusAfterStep', () => {
  const baseRun: CruzInspectionRun = {
    id: 'run-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    containerType: 'drum',
    containerCount: 1,
    currentStepId: 'scan_qr',
    status: 'active',
    steps: {},
    history: [],
  }

  it('returns needs_reverify when a step fails', () => {
    const status = computeRunStatusAfterStep(baseRun, 'verify_packing_label', {
      shipToOk: true,
      companyOk: true,
      orderNumberOk: true,
      productDescriptionOk: true,
      gate1Outcome: 'FAIL',
      mismatchReason: 'Order mismatch',
      photos: [
        {
          id: 'photo-1',
          name: 'issue.jpg',
          uploadedAt: new Date().toISOString(),
        },
      ],
      completedAt: new Date().toISOString(),
    }, 'FAIL')

    expect(status).toBe('needs_reverify')
  })

  it('returns completed when lot extraction passes', () => {
    const status = computeRunStatusAfterStep(baseRun, 'lot_extraction', {
      lots: [
        { id: 'lot-1', lotRaw: 'ABC123', confirmed: true },
      ],
      parseMode: 'none',
      completedAt: new Date().toISOString(),
    }, 'PASS')

    expect(status).toBe('completed')
  })
})
