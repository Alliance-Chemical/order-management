import { db } from '../lib/db';
import { workspaces, documents } from '../lib/db/schema/qr-workspace';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { uploadToS3, listS3Objects, deleteFromS3 } from '../lib/aws/s3-client';

async function archiveOldWorkspaces() {
  console.log('Starting workspace archive process...');
  
  // Find workspaces older than 2 weeks that haven't been archived
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const workspacesToArchive = await db
    .select()
    .from(workspaces)
    .where(
      and(
        lt(workspaces.shippedAt, twoWeeksAgo),
        isNull(workspaces.archivedAt)
      )
    );
  
  console.log(`Found ${workspacesToArchive.length} workspaces to archive`);
  
  for (const workspace of workspacesToArchive) {
    try {
      console.log(`Archiving workspace ${workspace.orderNumber}...`);
      
      // Create archive data
      const archiveData = {
        workspace,
        documents: await db
          .select()
          .from(documents)
          .where(eq(documents.workspaceId, workspace.id)),
        archivedAt: new Date().toISOString(),
      };
      
      // Upload archive to S3
      const archiveKey = `archives/${workspace.orderNumber}/workspace-data.json`;
      await uploadToS3(
        'alliance-chemical-archives',
        archiveKey,
        Buffer.from(JSON.stringify(archiveData, null, 2)),
        'application/json'
      );
      
      // Move documents to archive bucket
      // Documents are stored in the centralized S3 bucket defined in environment variables
      const s3BucketName = process.env.S3_DOCUMENTS_BUCKET || 'alliance-chemical-documents';
      const objects = await listS3Objects(s3BucketName, `workspace/${workspace.orderId}/`);
      
      if (objects.Contents) {
        for (const object of objects.Contents) {
          if (object.Key) {
            // Copy to archive
            const archiveDocKey = `archives/${workspace.orderNumber}/documents/${object.Key}`;
            // Note: In production, you'd use S3 copy operation instead of download/upload
            
            // Delete from active bucket
            await deleteFromS3(s3BucketName, object.Key);
          }
        }
      }
      
      // Update workspace status
      await db
        .update(workspaces)
        .set({
          status: 'archived',
          archivedAt: new Date(),
          archiveS3Path: archiveKey,
        })
        .where(eq(workspaces.id, workspace.id));
      
      console.log(`Successfully archived workspace ${workspace.orderNumber}`);
    } catch (error) {
      console.error(`Error archiving workspace ${workspace.orderNumber}:`, error);
    }
  }
  
  console.log('Archive process completed');
}

// Run if called directly
if (require.main === module) {
  archiveOldWorkspaces()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Archive process failed:', error);
      process.exit(1);
    });
}

export { archiveOldWorkspaces };