import { FastifyInstance } from 'fastify';
import os from 'os';
import { getPoolStats, VERSION } from '../db/pool';
import { getRedis } from '../services/redis';
import { pingDatabase, pingRedis } from '../services/healthService';
import { getRequestCount, getErrorCount, getTotalDurationMs, getActiveConnections, getMetricsStartTime } from '../middleware/requestMetrics';
import { requireAdmin } from '../middleware';

export async function healthEnhancedRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/health/enhanced', async (request, reply) => {
    const [database, redis] = await Promise.all([
      getDatabaseInfo(),
      getRedisInfo(),
    ]);
    const system = getSystemInfo();
    const metrics = getMetrics();
    const allHealthy = database.status === 'connected' && redis.status === 'connected';
    const anyDown = database.status === 'disconnected' || redis.status === 'disconnected';
    const status: 'healthy' | 'degraded' | 'unhealthy' = allHealthy ? 'healthy' : anyDown ? 'unhealthy' : 'degraded';

    return reply.status(allHealthy ? 200 : 503).send({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: VERSION,
      environment: process.env['NODE_ENV'] || 'development',
      system,
      services: { database, redis },
      metrics,
    });
  });

  app.get('/metrics', async (request, reply) => {
    const [database, redis] = await Promise.all([
      getDatabaseInfo(),
      getRedisInfo(),
    ]);
    const system = getSystemInfo();
    const metrics = getMetrics();

    const lines = [
      '# HELP ft_uptime_seconds Process uptime in seconds',
      '# TYPE ft_uptime_seconds gauge',
      `ft_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP ft_memory_heap_used_bytes Heap memory used',
      '# TYPE ft_memory_heap_used_bytes gauge',
      `ft_memory_heap_used_bytes ${system.memory.heapUsed}`,
      '',
      '# HELP ft_memory_heap_total_bytes Heap memory total',
      '# TYPE ft_memory_heap_total_bytes gauge',
      `ft_memory_heap_total_bytes ${system.memory.heapTotal}`,
      '',
      '# HELP ft_memory_rss_bytes RSS memory',
      '# TYPE ft_memory_rss_bytes gauge',
      `ft_memory_rss_bytes ${system.memory.rss}`,
      '',
      '# HELP ft_memory_system_total_bytes System memory total',
      '# TYPE ft_memory_system_total_bytes gauge',
      `ft_memory_system_total_bytes ${system.memory.total}`,
      '',
      '# HELP ft_memory_system_free_bytes System memory free',
      '# TYPE ft_memory_system_free_bytes gauge',
      `ft_memory_system_free_bytes ${system.memory.free}`,
      '',
      '# HELP ft_cpu_load_average CPU load average',
      '# TYPE ft_cpu_load_average gauge',
      `ft_cpu_load_average{period="1m"} ${system.cpu.loadAvg[0]}`,
      `ft_cpu_load_average{period="5m"} ${system.cpu.loadAvg[1]}`,
      `ft_cpu_load_average{period="15m"} ${system.cpu.loadAvg[2]}`,
      '',
      '# HELP ft_db_pool_total Database pool total connections',
      '# TYPE ft_db_pool_total gauge',
      `ft_db_pool_total ${database.pool.total}`,
      '',
      '# HELP ft_db_pool_idle Database pool idle connections',
      '# TYPE ft_db_pool_idle gauge',
      `ft_db_pool_idle ${database.pool.idle}`,
      '',
      '# HELP ft_db_pool_active Database pool active connections',
      '# TYPE ft_db_pool_active gauge',
      `ft_db_pool_active ${database.pool.active}`,
      '',
      '# HELP ft_db_pool_waiting Database pool waiting requests',
      '# TYPE ft_db_pool_waiting gauge',
      `ft_db_pool_waiting ${database.pool.waiting}`,
      '',
      '# HELP ft_db_latency_ms Database query latency',
      '# TYPE ft_db_latency_ms gauge',
      `ft_db_latency_ms ${database.latencyMs}`,
      '',
      '# HELP ft_redis_latency_ms Redis ping latency',
      '# TYPE ft_redis_latency_ms gauge',
      `ft_redis_latency_ms ${redis.latencyMs}`,
      '',
      '# HELP ft_redis_connected_clients Redis connected clients',
      '# TYPE ft_redis_connected_clients gauge',
      `ft_redis_connected_clients ${redis.connectedClients || 0}`,
      '',
      '# HELP ft_requests_total Total requests processed',
      '# TYPE ft_requests_total counter',
      `ft_requests_total ${metrics.requests.total}`,
      '',
      '# HELP ft_requests_per_second Requests per second',
      '# TYPE ft_requests_per_second gauge',
      `ft_requests_per_second ${metrics.requests.perSecond}`,
      '',
      '# HELP ft_request_duration_avg_seconds Average request duration in seconds',
      '# TYPE ft_request_duration_avg_seconds gauge',
      `ft_request_duration_avg_seconds ${metrics.requests.avgDurationMs / 1000}`,
      '',
      '# HELP ft_error_rate_percent Error rate percentage',
      '# TYPE ft_error_rate_percent gauge',
      `ft_error_rate_percent ${metrics.requests.errorRate}`,
      '',
      '# HELP ft_service_status Service status (1=up, 0=down)',
      '# TYPE ft_service_status gauge',
      `ft_service_status{service="database"} ${database.status === 'connected' ? 1 : 0}`,
      `ft_service_status{service="redis"} ${redis.status === 'connected' ? 1 : 0}`,
      '',
    ];

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n'));
  });
}

function getSystemInfo() {
  const memUsage = process.memoryUsage();

  return {
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percentUsed: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length,
    },
    process: {
      uptime: process.uptime(),
    },
  };
}

async function getDatabaseInfo() {
  try {
    const { latencyMs } = await pingDatabase();
    const poolStats = getPoolStats();

    return {
      status: 'connected' as const,
      latencyMs,
      pool: poolStats,
    };
  } catch {
    return {
      status: 'disconnected' as const,
      latencyMs: 0,
      pool: { total: 0, idle: 0, active: 0, waiting: 0, maxSize: 0 },
    };
  }
}

async function getRedisInfo() {
  try {
    const { latencyMs } = await pingRedis();
    const redis = getRedis();

    let memory: string | undefined;
    let connectedClients: number | undefined;

    try {
      const info = await redis.info('memory');
      const memMatch = info.match(/used_memory_human:(\S+)/);
      if (memMatch) memory = memMatch[1];

      const clientInfo = await redis.info('clients');
      const clientMatch = clientInfo.match(/connected_clients:(\d+)/);
      if (clientMatch && clientMatch[1]) connectedClients = parseInt(clientMatch[1], 10);
    } catch {
    }

    return {
      status: 'connected' as const,
      latencyMs,
      memory,
      connectedClients,
    };
  } catch {
    return {
      status: 'disconnected' as const,
      latencyMs: 0,
    };
  }
}

function getMetrics() {
  const elapsed = (Date.now() - getMetricsStartTime()) / 1000;
  const count = getRequestCount();
  const errors = getErrorCount();
  const totalDuration = getTotalDurationMs();
  const perSecond = elapsed > 0 ? count / elapsed : 0;
  const errorRate = count > 0 ? errors / count : 0;
  const avgDurationMs = count > 0 ? totalDuration / count : 0;

  return {
    requests: {
      total: count,
      perSecond: Math.round(perSecond * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 100,
      avgDurationMs: Math.round(avgDurationMs * 100) / 100,
    },
    activeConnections: getActiveConnections(),
  };
}
