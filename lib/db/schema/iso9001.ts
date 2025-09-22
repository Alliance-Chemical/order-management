import { pgTable, uuid, varchar, timestamp, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './qr-workspace';

// Quality Records - tracks all quality checks performed in the warehouse
export const qualityRecords = pgTable('quality_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  // Quality Check Details
  checkType: varchar('check_type', { length: 100 }).notNull(), // 'concentration_verify', 'container_inspect', 'label_check', 'pre_ship_inspection'
  result: varchar('result', { length: 20 }).notNull(), // 'pass', 'fail', 'conditional'

  // Who and When
  checkedBy: varchar('checked_by', { length: 255 }).notNull(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),

  // Details
  notes: text('notes'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('idx_quality_workspace_id').on(table.workspaceId),
  checkTypeIdx: index('idx_quality_check_type').on(table.checkType),
  resultIdx: index('idx_quality_result').on(table.result),
  checkedAtIdx: index('idx_quality_checked_at').on(table.checkedAt),
}));

// Non-Conformances - tracks internal warehouse issues
export const nonConformances = pgTable('non_conformances', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  // Issue Details
  issueType: varchar('issue_type', { length: 100 }).notNull(), // 'concentration_error', 'container_damage', 'labeling_error', 'qr_scan_failure'
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  description: text('description').notNull(),

  // Discovery
  discoveredBy: varchar('discovered_by', { length: 255 }).notNull(),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),

  // Status
  status: varchar('status', { length: 20 }).default('open'), // 'open', 'investigating', 'resolved', 'closed'

  // Resolution
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('idx_nonconf_workspace_id').on(table.workspaceId),
  issueTypeIdx: index('idx_nonconf_issue_type').on(table.issueType),
  severityIdx: index('idx_nonconf_severity').on(table.severity),
  statusIdx: index('idx_nonconf_status').on(table.status),
  discoveredAtIdx: index('idx_nonconf_discovered_at').on(table.discoveredAt),
}));

// Corrective Actions - tracks improvements made to prevent issues
export const correctiveActions = pgTable('corrective_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  nonConformanceId: uuid('non_conformance_id').references(() => nonConformances.id),

  // Action Details
  actionType: varchar('action_type', { length: 100 }).notNull(), // 'process_change', 'training', 'equipment_repair', 'procedure_update'
  description: text('description').notNull(),

  // Implementation
  assignedTo: varchar('assigned_to', { length: 255 }).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  dueDate: timestamp('due_date'),

  // Completion
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'in_progress', 'completed', 'verified'
  completedBy: varchar('completed_by', { length: 255 }),
  completedAt: timestamp('completed_at'),

  // Verification
  verifiedBy: varchar('verified_by', { length: 255 }),
  verifiedAt: timestamp('verified_at'),
  verificationNotes: text('verification_notes'),

  // Effectiveness
  effectivenessCheck: text('effectiveness_check'),
  effectivenessDate: timestamp('effectiveness_date'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  nonConformanceIdIdx: index('idx_corrective_nonconf_id').on(table.nonConformanceId),
  statusIdx: index('idx_corrective_status').on(table.status),
  assignedToIdx: index('idx_corrective_assigned_to').on(table.assignedTo),
  dueDateIdx: index('idx_corrective_due_date').on(table.dueDate),
}));

// Relations
export const qualityRecordsRelations = relations(qualityRecords, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [qualityRecords.workspaceId],
    references: [workspaces.id],
  }),
}));

export const nonConformancesRelations = relations(nonConformances, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [nonConformances.workspaceId],
    references: [workspaces.id],
  }),
  correctiveActions: many(correctiveActions),
}));

export const correctiveActionsRelations = relations(correctiveActions, ({ one }) => ({
  nonConformance: one(nonConformances, {
    fields: [correctiveActions.nonConformanceId],
    references: [nonConformances.id],
  }),
}));