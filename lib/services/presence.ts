import { kv } from '@/lib/kv';

const TTL = 60 * 5; // 5 min

export interface PresenceEntry {
  id?: string;
  name?: string;
  role?: 'agent' | 'supervisor';
  activity?: string;
  ts?: number;
}

type PresenceUser = {
  id: string;
  name: string;
  role: 'agent' | 'supervisor';
  activity: string;
};

export async function touchPresence(workspaceId: string, user: PresenceUser): Promise<void> {
  const key = `presence:${workspaceId}:${user.id}`;
  await kv.hset(key, { ...user, ts: Date.now() });
  await kv.expire(key, TTL);
}

export async function clearPresence(workspaceId: string, userId: string): Promise<void> {
  await kv.del(`presence:${workspaceId}:${userId}`);
}

export async function listPresence(workspaceId: string): Promise<PresenceEntry[]> {
  const [, keys] = await kv.scan(0, { match: `presence:${workspaceId}:*`, count: 100 });
  if (keys.length === 0) {
    return [];
  }

  const rows = await Promise.all(keys.map((k) => kv.hgetall<PresenceEntry>(k)));

  return rows
    .filter((row): row is PresenceEntry => Boolean(row))
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}
