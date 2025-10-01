/**
 * Migration Script: Legacy Database → Main Database
 *
 * This script migrates data from the legacy database to the new schema:
 * - LOT numbers → qr_workspace.lot_numbers
 * - Label requests → qr_workspace.label_requests
 * - Batch history → qr_workspace.batch_history (if needed)
 *
 * Run with: npx tsx scripts/migrate-legacy-data.ts
 */

import { legacyDb, queryLegacyDb } from '@/lib/db/legacy-connection'
import { legacyLotNumbers, legacyLabelRequests, legacyBatchHistory } from '@/lib/db/schema/legacy-schema'
import { db } from '@/lib/db'
import { lotNumbers, labelRequests } from '@/lib/db/schema/qr-workspace'
import { eq } from 'drizzle-orm'

interface MigrationStats {
  lotNumbers: { total: number; migrated: number; skipped: number; errors: number }
  labelRequests: { total: number; migrated: number; skipped: number; errors: number }
  batchHistory: { total: number; migrated: number; skipped: number; errors: number }
}

const stats: MigrationStats = {
  lotNumbers: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  labelRequests: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  batchHistory: { total: 0, migrated: 0, skipped: 0, errors: 0 },
}

async function migrateLotNumbers() {
  console.log('\n📦 Starting LOT Numbers migration...')

  try {
    const lots = await queryLegacyDb(
      async () => legacyDb.select().from(legacyLotNumbers),
      []
    )

    stats.lotNumbers.total = lots.length
    console.log(`Found ${lots.length} LOT numbers in legacy database`)

    for (const lot of lots) {
      try {
        // Check if already migrated
        const existing = await db
          .select()
          .from(lotNumbers)
          .where(eq(lotNumbers.legacyId, lot.id))
          .limit(1)

        if (existing.length > 0) {
          stats.lotNumbers.skipped++
          continue
        }

        // Insert into new table
        await db.insert(lotNumbers).values({
          productId: lot.productId,
          productTitle: lot.productTitle,
          sku: lot.sku || null,
          lotNumber: lot.lotNumber || `LOT-${lot.month}-${lot.year}`,
          month: lot.month,
          year: lot.year,
          createdAt: lot.createdAt || new Date(),
          createdBy: 'legacy_migration',
          legacyId: lot.id,
        })

        stats.lotNumbers.migrated++

        if (stats.lotNumbers.migrated % 100 === 0) {
          console.log(`  ✓ Migrated ${stats.lotNumbers.migrated}/${stats.lotNumbers.total} LOT numbers`)
        }
      } catch (error) {
        console.error(`  ✗ Error migrating LOT ${lot.id}:`, error)
        stats.lotNumbers.errors++
      }
    }

    console.log(`✅ LOT Numbers migration complete: ${stats.lotNumbers.migrated} migrated, ${stats.lotNumbers.skipped} skipped, ${stats.lotNumbers.errors} errors`)
  } catch (error) {
    console.error('❌ Failed to migrate LOT numbers:', error)
    throw error
  }
}

async function migrateLabelRequests() {
  console.log('\n🏷️  Starting Label Requests migration...')

  try {
    const requests = await queryLegacyDb(
      async () => legacyDb.select().from(legacyLabelRequests),
      []
    )

    stats.labelRequests.total = requests.length
    console.log(`Found ${requests.length} label requests in legacy database`)

    for (const request of requests) {
      try {
        // Check if already migrated
        const existing = await db
          .select()
          .from(labelRequests)
          .where(eq(labelRequests.legacyId, request.id))
          .limit(1)

        if (existing.length > 0) {
          stats.labelRequests.skipped++
          continue
        }

        // Insert into new table
        await db.insert(labelRequests).values({
          productId: request.productId || null,
          productName: request.productName || null,
          sku: request.sku || null,
          variantOption1: request.variantOption1 || null,
          quantity: request.quantity || null,
          lotNumber: request.lotNumber || null,
          labelType: request.labelType || 'container',
          customRequest: request.customRequest || false,
          customDetails: request.customDetails || null,
          urgent: request.urgent || false,
          status: request.status || 'pending',
          requestedAt: request.requestedAt || new Date(),
          requestedBy: request.requestedBy || null,
          printedAt: request.printedAt || null,
          printedBy: request.printedBy || null,
          updatedAt: request.updatedAt || new Date(),
          legacyId: request.id,
        })

        stats.labelRequests.migrated++

        if (stats.labelRequests.migrated % 100 === 0) {
          console.log(`  ✓ Migrated ${stats.labelRequests.migrated}/${stats.labelRequests.total} label requests`)
        }
      } catch (error) {
        console.error(`  ✗ Error migrating label request ${request.id}:`, error)
        stats.labelRequests.errors++
      }
    }

    console.log(`✅ Label Requests migration complete: ${stats.labelRequests.migrated} migrated, ${stats.labelRequests.skipped} skipped, ${stats.labelRequests.errors} errors`)
  } catch (error) {
    console.error('❌ Failed to migrate label requests:', error)
    throw error
  }
}

async function migrateBatchHistory() {
  console.log('\n🧪 Checking Batch History migration...')
  console.log('ℹ️  Batch history already exists in main schema - skipping migration')
  console.log('   If you need to merge legacy batch data, implement this function')
  stats.batchHistory.skipped = 0
}

async function generateReport() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 MIGRATION REPORT')
  console.log('='.repeat(60))

  console.log('\nLOT Numbers:')
  console.log(`  Total:    ${stats.lotNumbers.total}`)
  console.log(`  Migrated: ${stats.lotNumbers.migrated}`)
  console.log(`  Skipped:  ${stats.lotNumbers.skipped}`)
  console.log(`  Errors:   ${stats.lotNumbers.errors}`)

  console.log('\nLabel Requests:')
  console.log(`  Total:    ${stats.labelRequests.total}`)
  console.log(`  Migrated: ${stats.labelRequests.migrated}`)
  console.log(`  Skipped:  ${stats.labelRequests.skipped}`)
  console.log(`  Errors:   ${stats.labelRequests.errors}`)

  console.log('\nBatch History:')
  console.log(`  Skipped (already exists in main schema)`)

  const totalRecords = stats.lotNumbers.total + stats.labelRequests.total
  const totalMigrated = stats.lotNumbers.migrated + stats.labelRequests.migrated
  const totalErrors = stats.lotNumbers.errors + stats.labelRequests.errors

  console.log('\n' + '='.repeat(60))
  console.log(`TOTAL: ${totalMigrated}/${totalRecords} records migrated successfully`)
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} errors occurred during migration`)
  } else {
    console.log('✅ Migration completed without errors!')
  }
  console.log('='.repeat(60) + '\n')
}

async function main() {
  console.log('🚀 Starting Legacy Database Migration')
  console.log('Source: Legacy PostgreSQL database')
  console.log('Target: Main Neon PostgreSQL database (qr_workspace schema)')

  try {
    // Test connection to legacy database
    console.log('\n🔌 Testing legacy database connection...')
    const testConnection = await queryLegacyDb(
      async () => legacyDb.execute('SELECT 1'),
      null
    )
    if (!testConnection) {
      throw new Error('Failed to connect to legacy database')
    }
    console.log('✅ Legacy database connection successful')

    // Run migrations
    await migrateLotNumbers()
    await migrateLabelRequests()
    await migrateBatchHistory()

    // Generate report
    await generateReport()

    console.log('\n✅ Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Verify migrated data in the new database')
    console.log('2. Update application code to use new tables')
    console.log('3. Create new API routes (app/api/lots/route.ts)')
    console.log('4. Test thoroughly with production-like data')
    console.log('5. Decommission legacy database connection\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
main()
