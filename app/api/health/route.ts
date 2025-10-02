import { NextResponse } from 'next/server';
import { getEdgeSql } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type ServiceStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  status: ServiceStatus;
}

interface TimedServiceHealth extends ServiceHealth {
  latency: number;
}

interface ConfigurableServiceHealth extends ServiceHealth {
  configured: boolean;
}

interface HealthSnapshot {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: TimedServiceHealth;
    shipstation: ConfigurableServiceHealth;
    aws: ConfigurableServiceHealth;
    qr: ServiceHealth;
  };
  stats: {
    activeWorkspaces: number;
    pendingInspections: number;
    queuedItems: number;
  };
}

type WorkspaceStatsRow = { active: string | number | null; pending: string | number | null };

export async function GET() {
  const checks: HealthSnapshot = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', latency: 0 },
      shipstation: { status: 'unknown', configured: false },
      aws: { status: 'unknown', configured: false },
      qr: { status: 'unknown' },
    },
    stats: {
      activeWorkspaces: 0,
      pendingInspections: 0,
      queuedItems: 0,
    },
  };

  try {
    // Check database
    const startDb = Date.now();
    const sql = getEdgeSql();
    await sql`SELECT 1 as ok`;
    checks.services.database = {
      status: 'healthy',
      latency: Date.now() - startDb
    };

    // Get workspace stats (last 7 days)
    const stats = await sql`
      SELECT
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM qr_workspace.workspaces
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;

    if (Array.isArray(stats) && stats.length > 0) {
      const row = stats[0] as WorkspaceStatsRow;
      checks.stats.activeWorkspaces = Number(row.active ?? 0);
      checks.stats.pendingInspections = Number(row.pending ?? 0);
    }
  } catch (_error: unknown) {
    checks.services.database.status = 'unhealthy';
    checks.status = 'unhealthy';
  }

  // Check ShipStation configuration
  checks.services.shipstation.configured = !!(
    process.env.SHIPSTATION_API_KEY && 
    process.env.SHIPSTATION_API_SECRET
  );
  
  if (checks.services.shipstation.configured) {
    // Could do a test API call here
    checks.services.shipstation.status = 'healthy';
  }

  // Check AWS configuration
  checks.services.aws.configured = !!(
    process.env.AWS_ACCESS_KEY_ID && 
    process.env.AWS_SECRET_ACCESS_KEY
  );
  
  if (checks.services.aws.configured) {
    checks.services.aws.status = 'healthy';
  }

  // Check QR service
  checks.services.qr.status = 'healthy'; // Always available

  // Determine overall health
  const unhealthyServices = Object.values(checks.services).filter(
    s => s.status === 'unhealthy'
  ).length;
  
  if (unhealthyServices > 0) {
    checks.status = 'unhealthy';
  } else if (Object.values(checks.services).some(s => s.status === 'degraded')) {
    checks.status = 'degraded';
  }

  // Return appropriate status code
  const statusCode = checks.status === 'healthy' ? 200 : 
                     checks.status === 'degraded' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
