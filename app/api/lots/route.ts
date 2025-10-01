import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lotNumbers, labelRequests, batchHistory } from '@/lib/db/schema/qr-workspace'
import { desc, eq, and } from 'drizzle-orm'

/**
 * GET /api/lots
 *
 * Fetches LOT numbers, label requests, and batch history from the main database.
 * This replaces the legacy /api/lots/legacy route.
 *
 * Query Parameters:
 * - year: Filter LOT numbers by year
 * - month: Filter LOT numbers by month
 * - productId: Filter LOT numbers by product ID
 * - limit: Limit number of results (default: 100)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const productId = searchParams.get('productId')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build WHERE conditions for LOT numbers
    const lotConditions = []
    if (year) {
      lotConditions.push(eq(lotNumbers.year, parseInt(year)))
    }
    if (month) {
      lotConditions.push(eq(lotNumbers.month, month))
    }
    if (productId) {
      lotConditions.push(eq(lotNumbers.productId, productId))
    }

    // Fetch LOT numbers
    const lotsQuery = lotConditions.length > 0
      ? db
          .select()
          .from(lotNumbers)
          .where(and(...lotConditions))
          .orderBy(desc(lotNumbers.createdAt))
          .limit(limit)
      : db
          .select()
          .from(lotNumbers)
          .orderBy(desc(lotNumbers.createdAt))
          .limit(limit)

    // Fetch label requests
    const labelRequestsQuery = db
      .select()
      .from(labelRequests)
      .orderBy(desc(labelRequests.requestedAt))
      .limit(50)

    // Fetch recent batch history
    const batchHistoryQuery = db
      .select()
      .from(batchHistory)
      .orderBy(desc(batchHistory.createdAt))
      .limit(20)

    // Execute all queries in parallel
    const [lots, requests, batches] = await Promise.all([
      lotsQuery,
      labelRequestsQuery,
      batchHistoryQuery,
    ])

    // Get unique product IDs
    const productIds = [...new Set(lots.map((lot) => lot.productId))]

    // Format the response
    return NextResponse.json({
      success: true,
      lots: lots.map((lot) => ({
        id: lot.id,
        productId: lot.productId,
        productTitle: lot.productTitle,
        sku: lot.sku,
        month: lot.month,
        year: lot.year,
        lotNumber: lot.lotNumber,
        createdAt: lot.createdAt?.toISOString() || new Date().toISOString(),
      })),
      labelRequests: requests.map((req) => ({
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
        urgent: req.urgent,
      })),
      batchHistory: batches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        chemicalName: batch.chemicalName,
        createdAt: batch.createdAt?.toISOString() || new Date().toISOString(),
        completedBy: batch.completedBy,
      })),
      stats: {
        totalLots: lots.length,
        totalProducts: productIds.length,
        pendingLabels: requests.filter((r) => r.status === 'pending').length,
        totalBatches: batches.length,
      },
    })
  } catch (error) {
    console.error('Error fetching LOT data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch LOT data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lots
 *
 * Create operations for LOT numbers and label requests.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, data } = body

    if (action === 'create_lot') {
      // Create a new LOT number
      const { productId, productTitle, sku, month, year, lotNumber } = data

      const [newLot] = await db
        .insert(lotNumbers)
        .values({
          productId,
          productTitle,
          sku,
          month,
          year,
          lotNumber,
          createdBy: 'api',
          createdAt: new Date(),
        })
        .returning()

      return NextResponse.json({
        success: true,
        lot: newLot,
      })
    }

    if (action === 'create_label_request') {
      // Create a new label request
      const {
        productId,
        productName,
        sku,
        quantity,
        lotNumber,
        labelType,
        customRequest,
        customDetails,
        urgent,
        requestedBy,
      } = data

      const [newRequest] = await db
        .insert(labelRequests)
        .values({
          productId,
          productName,
          sku,
          quantity,
          lotNumber,
          labelType: labelType || 'container',
          customRequest: customRequest || false,
          customDetails,
          urgent: urgent || false,
          status: 'pending',
          requestedBy: requestedBy || 'api',
          requestedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      return NextResponse.json({
        success: true,
        labelRequest: newRequest,
      })
    }

    if (action === 'update_label_status') {
      // Update label request status
      const { id, status, printedBy } = data

      const [updated] = await db
        .update(labelRequests)
        .set({
          status,
          ...(status === 'printed' && {
            printedAt: new Date(),
            printedBy: printedBy || 'api',
          }),
          updatedAt: new Date(),
        })
        .where(eq(labelRequests.id, id))
        .returning()

      return NextResponse.json({
        success: true,
        labelRequest: updated,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in LOT operation:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
