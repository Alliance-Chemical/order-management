import { pgTable, uuid, bigint, varchar, jsonb, timestamp, integer, boolean, index, pgSchema } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const qrWorkspaceSchema = pgSchema('qr_workspace');

export const workspaces = qrWorkspaceSchema.table('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: bigint('order_id', { mode: 'number' }).notNull().unique(),
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  
  // QR Management (simplified - QR codes are in separate table)
  qrPrintCount: integer('qr_print_count').default(0),
  
  // Workspace Configuration
  workspaceUrl: varchar('workspace_url', { length: 500 }).notNull(),
  activeModules: jsonb('active_modules').$type<{
    preMix: boolean;
    warehouse: boolean;
    documents: boolean;
  }>().default({ preMix: true, warehouse: true, documents: true }),
  moduleStates: jsonb('module_states').$type<Record<string, any>>().default({}),
  
  // Real-time tracking
  currentUsers: jsonb('current_users').$type<string[]>().default([]),
  lastAccessed: timestamp('last_accessed'),
  accessCount: integer('access_count').default(0),
  
  // ShipStation Integration (orderId is the ShipStation order ID)
  lastShipstationSync: timestamp('last_shipstation_sync'),
  shipstationData: jsonb('shipstation_data').$type<any>(),
  shipstationTags: jsonb('shipstation_tags').$type<string[]>().default([]),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  
  // Document Management (detailed docs in documents table)
  documents: jsonb('documents').$type<{
    coa: string[];
    sds: string[];
    bol: string | null;
    other: string[];
  }>().default({ coa: [], sds: [], bol: null, other: [] }),
  totalDocumentSize: bigint('total_document_size', { mode: 'number' }).default(0),
  
  // Status & Workflow
  status: varchar('status', { length: 50 }).default('active'),
  workflowType: varchar('workflow_type', { length: 50 }).default('pump_and_fill').notNull(), // 'pump_and_fill' | 'direct_resell'
  workflowPhase: varchar('workflow_phase', { length: 50 }).default('pre_mix'),
  phaseCompletedAt: jsonb('phase_completed_at').$type<Record<string, string>>().default({}),
  
  // Final Measurements (post-production)
  finalMeasurements: jsonb('final_measurements').$type<{
    weight: { value: number; units: string; };
    dimensions: { length: number; width: number; height: number; units: string; };
    measuredBy?: string;
    measuredAt?: string;
  }>(),
  
  // Archive Management
  shippedAt: timestamp('shipped_at'),
  archiveScheduledFor: timestamp('archive_scheduled_for'),
  archivedAt: timestamp('archived_at'),
  archiveS3Path: varchar('archive_s3_path', { length: 500 }),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 255 }),
}, (table) => ({
  orderIdIdx: index('idx_workspace_order_id').on(table.orderId),
  orderNumberIdx: index('idx_workspace_order_number').on(table.orderNumber),
  statusIdx: index('idx_workspace_status').on(table.status),
  archiveIdx: index('idx_workspace_archive').on(table.archiveScheduledFor),
}));

export const qrCodes = qrWorkspaceSchema.table('qr_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // QR Identification
  qrType: varchar('qr_type', { length: 50 }).notNull(),
  qrCode: varchar('qr_code', { length: 500 }).notNull().unique(),
  shortCode: varchar('short_code', { length: 50 }).unique(),
  
  // Associated Data
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  orderNumber: varchar('order_number', { length: 100 }),
  containerNumber: integer('container_number'),
  chemicalName: varchar('chemical_name', { length: 255 }),
  
  // QR Content
  encodedData: jsonb('encoded_data').$type<any>().notNull(),
  qrUrl: varchar('qr_url', { length: 500 }).notNull(),
  
  // Tracking
  scanCount: integer('scan_count').default(0),
  lastScannedAt: timestamp('last_scanned_at'),
  lastScannedBy: varchar('last_scanned_by', { length: 255 }),
  
  // Print Management
  printedAt: timestamp('printed_at'),
  printedBy: varchar('printed_by', { length: 255 }),
  printCount: integer('print_count').default(0),
  labelSize: varchar('label_size', { length: 50 }),
  
  // Status
  isActive: boolean('is_active').default(true),
  deactivatedAt: timestamp('deactivated_at'),
  deactivationReason: varchar('deactivation_reason', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('idx_qr_workspace_id').on(table.workspaceId),
  orderIdIdx: index('idx_qr_order_id').on(table.orderId),
  qrTypeIdx: index('idx_qr_type').on(table.qrType),
  qrCodeIdx: index('idx_qr_code').on(table.qrCode),
}));

export const alertConfigs = qrWorkspaceSchema.table('alert_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // Alert Types
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(true),
  
  // Recipients
  snsTopicArn: varchar('sns_topic_arn', { length: 500 }),
  recipients: jsonb('recipients').$type<Array<{
    type: 'sms' | 'email';
    value: string;
  }>>().default([]),
  
  // Conditions
  triggerConditions: jsonb('trigger_conditions').$type<any>().default({}),
  cooldownMinutes: integer('cooldown_minutes').default(30),
  
  // History
  lastTriggeredAt: timestamp('last_triggered_at'),
  triggerCount: integer('trigger_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('idx_alert_workspace_id').on(table.workspaceId),
  alertTypeIdx: index('idx_alert_type').on(table.alertType),
}));

export const alertHistory = qrWorkspaceSchema.table('alert_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  alertConfigId: uuid('alert_config_id').references(() => alertConfigs.id),
  
  // Alert Details
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  triggeredBy: varchar('triggered_by', { length: 255 }).notNull(),
  triggeredAt: timestamp('triggered_at').defaultNow(),
  
  // Message Content
  messageContent: varchar('message_content', { length: 1000 }).notNull(),
  recipientsNotified: jsonb('recipients_notified').$type<any>().notNull(),
  
  // Delivery Status
  snsMessageId: varchar('sns_message_id', { length: 255 }),
  deliveryStatus: jsonb('delivery_status').$type<any>().default({}),
  
  // Response Tracking
  acknowledgedBy: varchar('acknowledged_by', { length: 255 }),
  acknowledgedAt: timestamp('acknowledged_at'),
  actionTaken: varchar('action_taken', { length: 1000 }),
}, (table) => ({
  workspaceIdx: index('idx_alert_history_workspace').on(table.workspaceId),
  triggeredIdx: index('idx_alert_history_triggered').on(table.triggeredAt),
}));

export const documents = qrWorkspaceSchema.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // Document Identification
  documentType: varchar('document_type', { length: 50 }).notNull(),
  documentName: varchar('document_name', { length: 255 }).notNull(),
  
  // S3 Storage
  s3Bucket: varchar('s3_bucket', { length: 255 }).notNull(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  s3Url: varchar('s3_url', { length: 1000 }),
  
  // Metadata
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  checksum: varchar('checksum', { length: 255 }),
  
  // Upload Info
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  
  // Status
  isActive: boolean('is_active').default(true),
  deletedAt: timestamp('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 255 }),
}, (table) => ({
  workspaceIdx: index('idx_document_workspace').on(table.workspaceId),
  documentTypeIdx: index('idx_document_type').on(table.documentType),
}));

export const activityLog = qrWorkspaceSchema.table('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // Activity Info
  activityType: varchar('activity_type', { length: 100 }).notNull(),
  activityDescription: varchar('activity_description', { length: 1000 }),
  
  // Actor
  performedBy: varchar('performed_by', { length: 255 }).notNull(),
  performedAt: timestamp('performed_at').defaultNow(),
  
  // Context
  module: varchar('module', { length: 50 }),
  metadata: jsonb('metadata').$type<any>().default({}),
  
  // Changes
  changes: jsonb('changes').$type<any>().default({}),
}, (table) => ({
  workspaceIdx: index('idx_activity_workspace').on(table.workspaceId),
  performedIdx: index('idx_activity_performed').on(table.performedAt),
}));

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  qrCodes: many(qrCodes),
  alertConfigs: many(alertConfigs),
  alertHistory: many(alertHistory),
  documents: many(documents),
  activityLog: many(activityLog),
}));

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [qrCodes.workspaceId],
    references: [workspaces.id],
  }),
}));

export const alertConfigsRelations = relations(alertConfigs, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [alertConfigs.workspaceId],
    references: [workspaces.id],
  }),
  alertHistory: many(alertHistory),
}));

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [alertHistory.workspaceId],
    references: [workspaces.id],
  }),
  alertConfig: one(alertConfigs, {
    fields: [alertHistory.alertConfigId],
    references: [alertConfigs.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityLog.workspaceId],
    references: [workspaces.id],
  }),
}));

// Chemicals Table - for storing chemical data with specific gravity and concentration info
import { decimal } from 'drizzle-orm/pg-core';

export const chemicals = qrWorkspaceSchema.table('chemicals', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Chemical Identification
  name: varchar('name', { length: 255 }).notNull().unique(),
  alternateNames: jsonb('alternate_names').$type<string[]>().default([]),
  
  // Physical Properties
  specificGravity: decimal('specific_gravity', { precision: 5, scale: 3 }).notNull(),
  initialConcentration: decimal('initial_concentration', { precision: 5, scale: 2 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(), // 'vv', 'wv', or 'ww'
  
  // Grade Information
  grade: varchar('grade', { length: 50 }), // USP, FCC, ACS, Reagent, Tech, Industrial, Lab, Food Grade
  gradeCategory: varchar('grade_category', { length: 50 }), // food, reagent, tech, standard
  
  // Safety Information
  hazardClass: varchar('hazard_class', { length: 255 }),
  ppeSuggestion: varchar('ppe_suggestion', { length: 500 }),
  
  // Shopify Integration
  shopifyProductId: varchar('shopify_product_id', { length: 100 }),
  shopifyTitle: varchar('shopify_title', { length: 255 }),
  shopifySKU: varchar('shopify_sku', { length: 100 }),
  
  // Metadata
  isActive: boolean('is_active').default(true),
  notes: varchar('notes', { length: 1000 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: index('chemicals_name_idx').on(table.name),
  gradeIdx: index('chemicals_grade_idx').on(table.grade),
}));

// Batch History Table - for tracking dilution operations
export const batchHistory = qrWorkspaceSchema.table('batch_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // Batch Identification
  batchNumber: varchar('batch_number', { length: 255 }).notNull().unique(),
  chemicalName: varchar('chemical_name', { length: 255 }).notNull(),
  
  // Concentration Data
  initialConcentration: decimal('initial_concentration', { precision: 5, scale: 2 }).notNull(),
  desiredConcentration: decimal('desired_concentration', { precision: 5, scale: 2 }).notNull(),
  methodUsed: varchar('method_used', { length: 10 }).notNull(), // 'vv', 'wv', or 'ww'
  initialSpecificGravity: decimal('initial_specific_gravity', { precision: 5, scale: 3 }).notNull(),
  
  // Volume Data (always stored in gallons)
  totalVolumeGallons: decimal('total_volume_gallons', { precision: 10, scale: 4 }).notNull(),
  chemicalVolumeGallons: decimal('chemical_volume_gallons', { precision: 10, scale: 4 }).notNull(),
  waterVolumeGallons: decimal('water_volume_gallons', { precision: 10, scale: 4 }).notNull(),
  
  // Weight Data (always stored in pounds)
  chemicalWeightLbs: decimal('chemical_weight_lbs', { precision: 10, scale: 4 }).notNull(),
  waterWeightLbs: decimal('water_weight_lbs', { precision: 10, scale: 4 }).notNull(),
  
  // Metadata
  notes: varchar('notes', { length: 1000 }),
  completedBy: varchar('completed_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // QR Code Reference (if batch QR was generated)
  qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
  
  // Destination Container Links (QR codes this batch was used to fill)
  destinationQrIds: jsonb('destination_qr_ids').$type<string[]>().default([]), // Array of destination qr_codes.id
});

// Source Containers Table - for tracking inventory at source
export const sourceContainers = qrWorkspaceSchema.table('source_containers', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Shopify Product Info
  shopifyProductId: varchar('shopify_product_id', { length: 255 }).notNull(),
  shopifyVariantId: varchar('shopify_variant_id', { length: 255 }).notNull().unique(),
  productTitle: varchar('product_title', { length: 500 }).notNull(),
  variantTitle: varchar('variant_title', { length: 500 }),
  sku: varchar('sku', { length: 255 }),
  barcode: varchar('barcode', { length: 255 }),
  
  // QR Code Reference
  qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
  shortCode: varchar('short_code', { length: 50 }).unique(),
  
  // Container Details
  containerType: varchar('container_type', { length: 100 }), // drum, tote, pail, etc.
  capacity: varchar('capacity', { length: 100 }), // 55 gal, 275 gal, etc.
  currentQuantity: decimal('current_quantity', { precision: 10, scale: 2 }),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }), // gallons, pounds, etc.
  
  // Location & Status
  warehouseLocation: varchar('warehouse_location', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'), // active, empty, maintenance, retired
  
  // Chemical Properties (from Shopify metafields)
  hazmatClass: varchar('hazmat_class', { length: 100 }),
  unNumber: varchar('un_number', { length: 50 }),
  packingGroup: varchar('packing_group', { length: 10 }),
  flashPoint: varchar('flash_point', { length: 100 }),
  
  // Tracking
  lastRefilled: timestamp('last_refilled'),
  lastInventoryCheck: timestamp('last_inventory_check'),
  expirationDate: timestamp('expiration_date'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
});

export const sourceContainersRelations = relations(sourceContainers, ({ one }) => ({
  qrCode: one(qrCodes, {
    fields: [sourceContainers.qrCodeId],
    references: [qrCodes.id],
  }),
}));

export const batchHistoryRelations = relations(batchHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [batchHistory.workspaceId],
    references: [workspaces.id],
  }),
  qrCode: one(qrCodes, {
    fields: [batchHistory.qrCodeId],
    references: [qrCodes.id],
  }),
}));