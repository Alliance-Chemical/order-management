import { NextResponse } from 'next/server';
import { legacyDb } from '@/lib/db/legacy-connection';
import { legacyLotNumbers, legacyProducts } from '@/lib/db/schema/legacy-schema';
import { eq, and, desc } from 'drizzle-orm';

// Generate LOT number format: YYYYMM-XXXX where XXXX is a sequential number
function generateLotNumber(year: number, month: string, sequence: number): string {
  const monthMap: Record<string, string> = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };

  const monthNum = monthMap[month] || '00';
  const sequenceStr = sequence.toString().padStart(4, '0');
  return `${year}${monthNum}-${sequenceStr}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, customLotNumber, month, year } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get current date info
    const now = new Date();
    const currentMonth = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][now.getMonth()];
    const currentYear = now.getFullYear();

    const targetMonth = month || currentMonth;
    const targetYear = year || currentYear;

    // Check if LOT already exists for this product/month/year
    const existingLot = await legacyDb
      .select()
      .from(legacyLotNumbers)
      .where(
        and(
          eq(legacyLotNumbers.productId, productId),
          eq(legacyLotNumbers.month, targetMonth),
          eq(legacyLotNumbers.year, targetYear)
        )
      )
      .limit(1);

    if (existingLot.length > 0 && existingLot[0].lotNumber) {
      return NextResponse.json({
        success: true,
        lotNumber: existingLot[0].lotNumber,
        existed: true,
        message: 'LOT number already exists for this product/period'
      });
    }

    // Generate new LOT number
    let lotNumber = customLotNumber;

    if (!lotNumber) {
      // Find the latest sequence number for this month/year
      const latestLots = await legacyDb
        .select()
        .from(legacyLotNumbers)
        .where(
          and(
            eq(legacyLotNumbers.month, targetMonth),
            eq(legacyLotNumbers.year, targetYear)
          )
        )
        .orderBy(desc(legacyLotNumbers.id));

      // Extract sequence numbers and find the highest
      let maxSequence = 0;
      for (const lot of latestLots) {
        if (lot.lotNumber) {
          const match = lot.lotNumber.match(/-(\d{4})$/);
          if (match) {
            const seq = parseInt(match[1]);
            if (seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      }

      lotNumber = generateLotNumber(targetYear, targetMonth, maxSequence + 1);
    }

    // Get product details
    let productTitle = 'Unknown Product';
    let sku = null;

    try {
      const product = await legacyDb
        .select()
        .from(legacyProducts)
        .where(eq(legacyProducts.id, productId))
        .limit(1);

      if (product.length > 0) {
        productTitle = product[0].title;
      }
    } catch (error) {
      console.log('Could not fetch product details:', error);
    }

    // Update or insert the LOT number
    if (existingLot.length > 0) {
      // Update existing record
      await legacyDb
        .update(legacyLotNumbers)
        .set({
          lotNumber,
          updatedAt: new Date()
        })
        .where(eq(legacyLotNumbers.id, existingLot[0].id));
    } else {
      // Insert new record
      await legacyDb
        .insert(legacyLotNumbers)
        .values({
          productId,
          productTitle,
          sku,
          month: targetMonth,
          year: targetYear,
          lotNumber,
          createdAt: new Date()
        });
    }

    return NextResponse.json({
      success: true,
      lotNumber,
      productId,
      month: targetMonth,
      year: targetYear,
      message: `Generated LOT number: ${lotNumber}`
    });

  } catch (error) {
    console.error('Error generating LOT number:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate LOT number',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve LOT number for a product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const conditions = [eq(legacyLotNumbers.productId, productId)];

    if (month) {
      conditions.push(eq(legacyLotNumbers.month, month));
    }
    if (year) {
      conditions.push(eq(legacyLotNumbers.year, parseInt(year)));
    }

    const lots = await legacyDb
      .select()
      .from(legacyLotNumbers)
      .where(and(...conditions))
      .orderBy(desc(legacyLotNumbers.createdAt));

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
        createdAt: lot.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching LOT numbers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch LOT numbers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}