// =============================================================================
// DerLg — Prisma Client Metrics / Monitoring
// =============================================================================
// Export helpers to inspect connection pool, slow queries, and health.
//
// Usage:
//   import { dbHealthCheck, queryStats } from '../prisma/monitoring'
// =============================================================================

import { prisma } from '../client';

// ---------------------------------------------------------------------------
// Health check — lightweight liveness probe
// ---------------------------------------------------------------------------

export async function dbHealthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, error: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Query metrics hook — attach to a NestJS PrismaService to count queries
// ---------------------------------------------------------------------------

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: { query: string; durationMs: number }[];
  errors: number;
}

export function createQueryMetrics(): { metrics: () => QueryMetrics; reset: () => void } {
  const state: QueryMetrics = { totalQueries: 0, slowQueries: [], errors: 0 };

  const queryEventHandler = (event: { timestamp: Date; query: string; params: string; duration: number; target: string }) => {
    state.totalQueries++;
    if (event.duration > 1000) {
      state.slowQueries.push({ query: event.query, durationMs: Math.round(event.duration) });
      if (state.slowQueries.length > 50) state.slowQueries.shift();
    }
  };

  return {
    metrics: () => ({ ...state }),
    reset: () => {
      state.totalQueries = 0;
      state.slowQueries = [];
      state.errors = 0;
    },
  };
}