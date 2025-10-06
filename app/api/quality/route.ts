import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qualityRecords, nonConformances, correctiveActions } from '@/lib/db/schema/iso9001';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const createQualityRecordSchema = z.object({
  workspaceId: z.string().uuid(),
  checkType: z.enum(['concentration_verify', 'container_inspect', 'label_check', 'pre_ship_inspection', 'batch_quality']),
  result: z.enum(['pass', 'fail', 'conditional']),
  checkedBy: z.string().min(1),
  notes: z.string().optional(),
});

const createNonConformanceSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  issueType: z.enum(['concentration_error', 'container_damage', 'labeling_error', 'qr_scan_failure', 'process_deviation']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  discoveredBy: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const type = searchParams.get('type') || 'quality-records';

    if (type === 'quality-records') {
      const query = db.select().from(qualityRecords);

      const records = workspaceId
        ? await query.where(eq(qualityRecords.workspaceId, workspaceId)).orderBy(desc(qualityRecords.checkedAt)).limit(50)
        : await query.orderBy(desc(qualityRecords.checkedAt)).limit(50);

      return NextResponse.json({ success: true, data: records });
    }

    if (type === 'non-conformances') {
      const query = db.select().from(nonConformances);

      const records = workspaceId
        ? await query.where(eq(nonConformances.workspaceId, workspaceId)).orderBy(desc(nonConformances.discoveredAt)).limit(50)
        : await query.orderBy(desc(nonConformances.discoveredAt)).limit(50);

      return NextResponse.json({ success: true, data: records });
    }

    if (type === 'corrective-actions') {
      const records = await db.select().from(correctiveActions)
        .orderBy(desc(correctiveActions.assignedAt))
        .limit(50);

      return NextResponse.json({ success: true, data: records });
    }

    return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching quality data:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'quality-record';

    if (type === 'quality-record') {
      const validatedData = createQualityRecordSchema.parse(body);

      const [newRecord] = await db.insert(qualityRecords).values({
        workspaceId: validatedData.workspaceId,
        checkType: validatedData.checkType,
        result: validatedData.result,
        checkedBy: validatedData.checkedBy,
        notes: validatedData.notes,
      }).returning();

      return NextResponse.json({ success: true, data: newRecord });
    }

    if (type === 'non-conformance') {
      const validatedData = createNonConformanceSchema.parse(body);

      const [newRecord] = await db.insert(nonConformances).values({
        workspaceId: validatedData.workspaceId,
        issueType: validatedData.issueType,
        severity: validatedData.severity,
        description: validatedData.description,
        discoveredBy: validatedData.discoveredBy,
      }).returning();

      return NextResponse.json({ success: true, data: newRecord });
    }

    return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating quality record:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
