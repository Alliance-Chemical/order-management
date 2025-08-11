import { db } from '../lib/db/index.js';
import { workspaces } from '../lib/db/schema/qr-workspace.js';
import { eq } from 'drizzle-orm';

async function updateWorkspace() {
  const shipstationData = {
    orderId: 67890,
    orderNumber: '67890',
    items: [
      {
        orderItemId: 123456,
        lineItemKey: 'item-1',
        sku: 'CHEM-001',
        name: 'Sodium Hydroxide - 55 Gallon Drum',
        quantity: 2,
        unitPrice: 250.00
      },
      {
        orderItemId: 123457,
        lineItemKey: 'item-2',
        sku: 'CHEM-002',
        name: 'Citric Acid - 5 Gallon Pail',
        quantity: 36,
        unitPrice: 45.00
      },
      {
        orderItemId: 123458,
        lineItemKey: 'item-3',
        sku: 'CHEM-003',
        name: 'D-Limonene - 275 Gallon Tote',
        quantity: 1,
        unitPrice: 1200.00
      }
    ]
  };

  await db.update(workspaces)
    .set({ shipstationData })
    .where(eq(workspaces.orderId, 67890));

  console.log('Updated workspace with ShipStation data');
}

updateWorkspace().catch(console.error);
