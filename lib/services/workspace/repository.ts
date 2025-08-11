import { db } from '@/lib/db';
import { workspaces, qrCodes, documents, alertConfigs, activityLog } from '@/lib/db/schema/qr-workspace';
import { eq, and, desc, sql } from 'drizzle-orm';

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

  async create(data: typeof workspaces.$inferInsert) {
    const [workspace] = await db.insert(workspaces).values(data).returning();
    return workspace;
  }

  async update(id: string, data: Partial<typeof workspaces.$inferInsert>) {
    const [updated] = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async updateAccessTime(id: string, userId: string) {
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

  async findQRByShortCode(shortCode: string) {
    return await db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, shortCode),
    });
  }

  async updateQRPrintCount(id: string, userId: string) {
    const [updated] = await db
      .update(qrCodes)
      .set({
        printCount: sql`${qrCodes.printCount} + 1`,
        printedAt: new Date(),
        printedBy: userId,
      })
      .where(eq(qrCodes.id, id))
      .returning();
    return updated;
  }

  async addDocument(data: typeof documents.$inferInsert) {
    const [doc] = await db.insert(documents).values(data).returning();
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
}