import { kv } from '@/lib/kv';
import { v4 as uuid } from 'uuid';
import { activityLog, workspaces } from '@/lib/db/schema/qr-workspace';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';

type OverrideType = 'skip_step' | 'approve_failure' | 'manual_pass' | 'unlock_inspection';

export async function requestOverride(params: {
  type: OverrideType; orderId: string; workflowPhase: string; reason: string;
  requestedBy: string; workspaceId: string;
}) {
  const id = `ovr_${uuid()}`;
  const expiresAt = Date.now() + expiryMs(params.type);
  await kv.hmset(`override:${id}`, { ...params, approved: false, createdAt: Date.now(), expiresAt });
  await kv.expire(`override:${id}`, Math.ceil((expiresAt - Date.now()) / 1000));

  await db.insert(activityLog).values({
    workspaceId: params.workspaceId,
    activityType: 'override_requested',
    performedBy: params.requestedBy,
    metadata: { id, ...params },
  });

  return { id, approved: false, expiresAt };
}

export async function approveOverride(id: string, approvedBy: string, workspaceId: string) {
  const key = `override:${id}`;
  const exists = await kv.exists(key);
  if (!exists) throw new Error('Override not found');

  await kv.hset(key, { approved: true, approvedBy, approvedAt: Date.now() });
  await db.insert(activityLog).values({
    workspaceId,
    activityType: 'override_approved',
    performedBy: approvedBy,
    metadata: { id },
  });
  return { ok: true };
}

export async function useOverride(id: string, usedBy: string, workspaceId: string) {
  const key = `override:${id}`;
  const ovr = await kv.hgetall<Record<string, any>>(key);
  if (!ovr || !ovr.approved) return { ok: false };
  if ((ovr.expiresAt ?? 0) < Date.now()) {
    await kv.del(key);
    return { ok: false };
  }
  await db.insert(activityLog).values({
    workspaceId,
    activityType: 'override_used',
    performedBy: usedBy,
    metadata: { id },
  });
  // Single-use by default:
  await kv.del(key);
  return { ok: true };
}

function expiryMs(t: OverrideType) {
  return t === 'unlock_inspection' ? 4 * 3600_000
    : t === 'manual_pass' ? 2 * 3600_000
    : t === 'approve_failure' ? 30 * 60_000
    : 1 * 3600_000; // skip_step
}