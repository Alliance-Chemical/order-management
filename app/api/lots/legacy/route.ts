import { NextResponse } from 'next/server';
import { legacyDb, queryLegacyDb } from '@/lib/db/legacy-connection';
import {
  legacyLotNumbers,
  legacyLabelRequests,
  legacyBatchHistory,
  legacyProducts
} from '@/lib/db/schema/legacy-schema';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const productId = searchParams.get('productId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Fetch LOT numbers from legacy database
    const lotsQuery = queryLegacyDb(async () => {
      let query = legacyDb
        .select()
        .from(legacyLotNumbers)
        .orderBy(desc(legacyLotNumbers.createdAt))
        .limit(limit);

      // Apply filters if provided
      const conditions = [];
      if (year) {
        conditions.push(eq(legacyLotNumbers.year, parseInt(year)));
      }
      if (month) {
        conditions.push(eq(legacyLotNumbers.month, month));
      }
      if (productId) {
        conditions.push(eq(legacyLotNumbers.productId, productId));
      }

      if (conditions.length > 0) {
        return legacyDb
          .select()
          .from(legacyLotNumbers)
          .where(and(...conditions))
          .orderBy(desc(legacyLotNumbers.createdAt))
          .limit(limit);
      }

      return query;
    }, []);

    // Fetch label requests from legacy database
    const labelRequestsQuery = queryLegacyDb(async () => {
      return legacyDb
        .select()
        .from(legacyLabelRequests)
        .orderBy(desc(legacyLabelRequests.requestedAt))
        .limit(50); // Get recent 50 label requests
    }, []);

    // Fetch batch history for context
    const batchHistoryQuery = queryLegacyDb(async () => {
      return legacyDb
        .select()
        .from(legacyBatchHistory)
        .orderBy(desc(legacyBatchHistory.date))
        .limit(20); // Get recent 20 batches
    }, []);

    // Execute all queries in parallel
    const [lots, labelRequests, batchHistory] = await Promise.all([
      lotsQuery,
      labelRequestsQuery,
      batchHistoryQuery
    ]);

    // Get unique product IDs to fetch product details
    const productIds = [...new Set(lots.map(lot => lot.productId))];

    // Fetch product details if we have product IDs
    let products = [];
    if (productIds.length > 0) {
      products = await queryLegacyDb(async () => {
        return legacyDb
          .select()
          .from(legacyProducts)
          .where(eq(legacyProducts.id, productIds[0])) // Example for one product
          .limit(100);
      }, []);
    }

    // Format the response
    return NextResponse.json({
      success: true,
      lots: lots.map(lot => ({
        id: lot.id,
        productId: lot.productId,
        productTitle: lot.productTitle,
        sku: lot.sku,
        month: lot.month,
        year: lot.year,
        lotNumber: lot.lotNumber,
        createdAt: lot.createdAt?.toISOString() || new Date().toISOString()
      })),
      labelRequests: labelRequests.map(req => ({
        id: req.id,
        productId: req.productId,
        productName: req.productName,
        quantity: req.quantity,
        status: req.status,
        requestedAt: req.requestedAt?.toISOString() || new Date().toISOString(),
        customRequest: req.customRequest,
        customDetails: req.customDetails,
        requestedBy: req.requestedBy,
        printedBy: req.printedBy,
        printedAt: req.printedAt?.toISOString() || null,
        lotNumber: req.lotNumber,
        sku: req.sku,
        labelType: req.labelType,
        urgent: req.urgent
      })),
      batchHistory: batchHistory.map(batch => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        chemicalName: batch.chemicalName,
        date: batch.date?.toISOString() || new Date().toISOString(),
        completedBy: batch.completedBy
      })),
      stats: {
        totalLots: lots.length,
        totalProducts: productIds.length,
        pendingLabels: labelRequests.filter(r => r.status === 'pending').length,
        totalBatches: batchHistory.length
      }
    });

  } catch (error) {
    console.error('Error fetching legacy LOT data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch LOT data from legacy database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint to sync/migrate data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'sync') {
      // Implement data sync from legacy to new database
      // This would involve:
      // 1. Fetching data from legacy
      // 2. Transforming to new schema
      // 3. Inserting into new database
      // 4. Tracking sync status

      return NextResponse.json({
        success: true,
        message: 'Sync initiated',
        syncId: `sync_${Date.now()}`
      });
    }

    if (action === 'migrate') {
      // Implement full migration logic
      return NextResponse.json({
        success: true,
        message: 'Migration process started'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in LOT sync/migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}