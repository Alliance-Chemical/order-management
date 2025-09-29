import { db } from '@/lib/db';
import { workspaces, qrCodes, documents, alertConfigs, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { DocumentInsert } from '@/types/documents';
import { resolveDocumentName } from '@/lib/utils/document-name';

export class WorkspaceRepository {
  async findByOrderId(orderId: number) {
    return await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, orderId),
      with: {
        qrCodes: true,
        documents: true,
        alertConfigs: true,
      },
    });
  }

  async createOrGet(data: typeof workspaces.$inferInsert) {
    const inserted = await db
      .insert(workspaces)
      .values(data)
      .onConflictDoNothing({ target: workspaces.orderId })
      .returning();

    if (inserted.length > 0) {
      return { workspace: inserted[0], created: true } as const;
    }

    const [existing] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, data.orderId))
      .limit(1);

    if (!existing) {
      throw new Error(`Workspace with order ${data.orderId} could not be retrieved after upsert.`);
    }

    return { workspace: existing, created: false } as const;
  }

  async create(data: typeof workspaces.$inferInsert) {
    const result = await this.createOrGet(data);
    return result.workspace;
  }

  async update(id: string, data: Partial<typeof workspaces.$inferInsert>) {
    const [updated] = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async updateAccessTime(id: string, _userId: string) {
    const [updated] = await db
      .update(workspaces)
      .set({
        lastAccessed: new Date(),
        accessCount: sql`${workspaces.accessCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async findActiveWorkspaces() {
    return await db.query.workspaces.findMany({
      where: eq(workspaces.status, 'active'),
      orderBy: desc(workspaces.updatedAt),
    });
  }

  async addQRCode(data: typeof qrCodes.$inferInsert) {
    const [qr] = await db.insert(qrCodes).values(data).returning();
    return qr;
  }

  async updateQRScanCount(qrCode: string, userId: string) {
    const [updated] = await db
      .update(qrCodes)
      .set({
        scanCount: sql`${qrCodes.scanCount} + 1`,
        lastScannedAt: new Date(),
        lastScannedBy: userId,
      })
      .where(eq(qrCodes.qrCode, qrCode))
      .returning();
    return updated;
  }

  async findQRByShortCode(shortCode: string, orderId?: number | bigint) {
    if (orderId !== undefined) {
      const oid = BigInt(orderId);
      return await db.query.qrCodes.findFirst({
        where: and(eq(qrCodes.shortCode, shortCode), eq(qrCodes.orderId, oid)),
      });
    }
    return await db.query.qrCodes.findFirst({ where: eq(qrCodes.shortCode, shortCode) });
  }

  async updateQRPrintCount(id: string, userId: string, opts?: { labelSize?: string }) {
    const [updated] = await db
      .update(qrCodes)
      .set({
        printCount: sql`${qrCodes.printCount} + 1`,
        printedAt: new Date(),
        printedBy: userId,
        ...(opts?.labelSize ? { labelSize: opts.labelSize } : {}),
      })
      .where(eq(qrCodes.id, id))
      .returning();
    return updated;
  }

  async addDocument(data: DocumentInsert) {
    const documentName = data.documentName?.trim() || resolveDocumentName(null, data.s3Key);
    const [doc] = await db
      .insert(documents)
      .values({
        ...data,
        documentName,
      })
      .returning();
    return doc;
  }

  async getDocumentsByWorkspace(workspaceId: string) {
    return await db.query.documents.findMany({
      where: and(
        eq(documents.workspaceId, workspaceId),
        eq(documents.isActive, true)
      ),
    });
  }

  async addAlertConfig(data: typeof alertConfigs.$inferInsert) {
    const [config] = await db.insert(alertConfigs).values(data).returning();
    return config;
  }

  async logActivity(data: typeof activityLog.$inferInsert) {
    const [activity] = await db.insert(activityLog).values(data).returning();
    return activity;
  }

  async getRecentActivity(workspaceId: string, limit: number = 50) {
    return await db.query.activityLog.findMany({
      where: eq(activityLog.workspaceId, workspaceId),
      orderBy: desc(activityLog.performedAt),
      limit,
    });
  }

  async searchWorkspaces(params: {
    query?: string;
    status?: 'active' | 'shipped' | 'archived' | 'all';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      query,
      status = 'all',
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    const conditions = [];

    // Filter by status
    if (status !== 'all') {
      conditions.push(eq(workspaces.status, status));
    }

    // Filter by date range on createdAt
    if (startDate) {
      conditions.push(sql`${workspaces.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${workspaces.createdAt} <= ${endDate}`);
    }

    // Search query (order number, order ID, or customer data in shipstationData)
    if (query && query.trim()) {
      const searchTerm = query.trim();
      conditions.push(
        sql`(
          ${workspaces.orderNumber} ILIKE ${`%${searchTerm}%`}
          OR CAST(${workspaces.orderId} AS TEXT) ILIKE ${`%${searchTerm}%`}
          OR ${workspaces.shipstationData}::text ILIKE ${`%${searchTerm}%`}
        )`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }
}
