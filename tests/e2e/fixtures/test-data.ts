export const testUsers = {
  worker: {
    email: 'worker@test.com',
    password: 'password123',
    role: 'worker' as const,
    name: 'Test Worker'
  },
  supervisor: {
    email: 'supervisor@test.com',
    password: 'password123',
    role: 'supervisor' as const,
    name: 'Test Supervisor'
  },
  admin: {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin' as const,
    name: 'Test Admin'
  }
}

export const testOrders = {
  simple: {
    orderNumber: 'TEST-001',
    customerName: 'Test Customer',
    items: [
      {
        sku: 'CHEM-001',
        name: 'Chemical A',
        quantity: 2,
        workflow: 'direct_resell' as const
      }
    ]
  },
  complex: {
    orderNumber: 'TEST-002',
    customerName: 'Complex Customer',
    items: [
      {
        sku: 'CHEM-002',
        name: 'Chemical B',
        quantity: 5,
        workflow: 'pump_fill' as const,
        sourceContainerId: 'SRC-001'
      },
      {
        sku: 'CHEM-003',
        name: 'Chemical C',
        quantity: 3,
        workflow: 'direct_resell' as const
      }
    ]
  },
  dilution: {
    orderNumber: 'TEST-003',
    customerName: 'Dilution Customer',
    items: [
      {
        sku: 'CHEM-004',
        name: 'Concentrated Chemical',
        quantity: 1,
        workflow: 'pump_fill' as const,
        sourceContainerId: 'SRC-002',
        requiresDilution: true,
        targetConcentration: 50,
        sourceConcentration: 100
      }
    ]
  }
}

export const testSourceContainers = {
  standard: {
    id: 'SRC-001',
    productName: 'Chemical B',
    grade: 'Technical',
    concentration: 100,
    quantity: 1000,
    unit: 'gallons'
  },
  concentrated: {
    id: 'SRC-002',
    productName: 'Concentrated Chemical',
    grade: 'Food Grade',
    concentration: 100,
    quantity: 500,
    unit: 'gallons'
  }
}

export const testQRCodes = {
  master: 'QR-MASTER-001',
  source: 'QR-SOURCE-001',
  destination: 'QR-DEST-001',
  invalid: 'QR-INVALID-999'
}