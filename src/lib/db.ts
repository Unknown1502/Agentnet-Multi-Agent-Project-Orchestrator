import type { TrustZone } from "./trust-policy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  userId: string;
  action: string;
  provider: string;
  trustZone: TrustZone;
  status: string;
  details?: string;
  /** Which sub-agent performed this action (multi-agent support) */
  agentId?: string;
}

export interface AuditLogRow {
  id: number;
  user_id: string;
  action: string;
  provider: string;
  trust_zone: TrustZone;
  status: string;
  details: string | null;
  created_at: string;
  agent_id: string | null;
}

export interface TrustPolicyRow {
  tool_name: string;
  zone: TrustZone;
  requires_approval: number;
}

// ---------------------------------------------------------------------------
// In-memory store (module-level singleton, works in any serverless environment)
// ---------------------------------------------------------------------------

const auditStore = new Map<string, AuditLogRow[]>();
const trustStore = new Map<string, Record<string, TrustPolicyRow>>();
let idCounter = 1;

// ---------------------------------------------------------------------------
// Redis helpers — only used when UPSTASH_REDIS_REST_URL is configured
// ---------------------------------------------------------------------------

export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Lazy singleton to avoid instantiation at build time
let _redis: import("@upstash/redis").Redis | null = null;
export async function getRedis() {
  if (!_redis) {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// ---------------------------------------------------------------------------
// Public API — all functions are async for Upstash compatibility
// ---------------------------------------------------------------------------

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const row: AuditLogRow = {
    id: idCounter++,
    user_id: entry.userId,
    action: entry.action,
    provider: entry.provider,
    trust_zone: entry.trustZone,
    status: entry.status,
    details: entry.details ?? null,
    created_at: new Date().toISOString(),
    agent_id: entry.agentId ?? null,
  };

  if (isRedisConfigured()) {
    const redis = await getRedis();
    await redis.zadd(`audit:${entry.userId}`, {
      score: Date.now(),
      member: JSON.stringify(row),
    });
    // Cap at 500 entries per user (remove oldest)
    await redis.zremrangebyrank(`audit:${entry.userId}`, 0, -501);
  } else {
    const existing = auditStore.get(entry.userId) ?? [];
    auditStore.set(entry.userId, [row, ...existing].slice(0, 500));
  }
}

export async function getAuditLogs(
  userId: string,
  filters?: {
    provider?: string;
    trustZone?: TrustZone;
    limit?: number;
    offset?: number;
  }
): Promise<AuditLogRow[]> {
  let rows: AuditLogRow[];

  if (isRedisConfigured()) {
    const redis = await getRedis();
    // zrange with rev: true returns highest score (most recent) first
    const members = await redis.zrange<string[]>(
      `audit:${userId}`,
      0,
      -1,
      { rev: true }
    );
    rows = (members ?? []).map((m) =>
      typeof m === "string" ? (JSON.parse(m) as AuditLogRow) : (m as AuditLogRow)
    );
  } else {
    rows = auditStore.get(userId) ?? [];
  }

  if (filters?.provider) {
    rows = rows.filter((r) => r.provider === filters.provider);
  }
  if (filters?.trustZone) {
    rows = rows.filter((r) => r.trust_zone === filters.trustZone);
  }

  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  return rows.slice(offset, offset + limit);
}

export async function getUserTrustPolicies(
  userId: string
): Promise<TrustPolicyRow[]> {
  if (isRedisConfigured()) {
    const redis = await getRedis();
    const data = await redis.hgetall<Record<string, string>>(
      `trust:${userId}`
    );
    if (!data) return [];
    return Object.values(data).map((v) =>
      typeof v === "string" ? (JSON.parse(v) as TrustPolicyRow) : (v as TrustPolicyRow)
    );
  }

  const policies = trustStore.get(userId);
  if (!policies) return [];
  return Object.values(policies);
}

export async function upsertTrustPolicy(
  userId: string,
  toolName: string,
  zone: TrustZone,
  requiresApproval: boolean
): Promise<void> {
  const row: TrustPolicyRow = {
    tool_name: toolName,
    zone,
    requires_approval: requiresApproval ? 1 : 0,
  };

  if (isRedisConfigured()) {
    const redis = await getRedis();
    await redis.hset(`trust:${userId}`, { [toolName]: JSON.stringify(row) });
  } else {
    const existing = trustStore.get(userId) ?? {};
    existing[toolName] = row;
    trustStore.set(userId, existing);
  }
}
