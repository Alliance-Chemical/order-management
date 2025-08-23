import { kv } from '@/lib/kv';

const TTL = 60 * 5; // 5 min

export async function touchPresence(workspaceId: string, user: {
  id: string; name: string; role: 'agent' | 'supervisor'; activity: string;
}) {
  const key = `presence:${workspaceId}:${user.id}`;
  await kv.hset(key, { ...user, ts: Date.now() });
  await kv.expire(key, TTL);
}

export async function clearPresence(workspaceId: string, userId: string) {
  await kv.del(`presence:${workspaceId}:${userId}`);
}

export async function listPresence(workspaceId: string) {
  const scan = await kv.scan(0, { match: `presence:${workspaceId}:*`, count: 100 });
  const keys = scan[1] as string[];
  if (!keys.length) return [];
  const pipe = kv.pipeline();
  keys.forEach(k => pipe.hgetall(k));
  const rows = (await pipe.exec()) as any[];
  // return sorted newest first
  return rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}