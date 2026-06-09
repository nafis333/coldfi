import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { query } from '../db/pool';
import { logger } from '../services/logger';
import { captureError } from '../services/errorCapture';

let requestCount = 0;
let errorCount = 0;
let totalDurationMs = 0;
let activeConnections = 0;
const metricsStartTime = Date.now();

export function incrementRequestCount(isError: boolean = false, durationMs?: number): void {
  requestCount++;
  if (isError) errorCount++;
  if (durationMs !== undefined) totalDurationMs += durationMs;
}

export function getRequestCount(): number {
  return requestCount;
}

export function getErrorCount(): number {
  return errorCount;
}

export function getTotalDurationMs(): number {
  return totalDurationMs;
}

export function getActiveConnections(): number {
  return activeConnections;
}

export function getMetricsStartTime(): number {
  return metricsStartTime;
}

export async function requestMetrics(request: FastifyRequest, reply: FastifyReply) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  activeConnections++;

  request.requestId = requestId;
  reply.header('X-Request-Id', requestId);

  logger.requestStart(
    requestId,
    request.method,
    request.url,
    request.user?.userId,
    request.ip
  );

  reply.raw.once('finish', () => {
    activeConnections--;
    const duration = Date.now() - start;
    const statusCode = reply.statusCode;
    const endpoint = `${request.method} ${request.routeOptions?.url || request.url}`;
    const userId = request.user?.userId;

    logger.requestEnd(requestId, request.method, request.url, statusCode, duration, userId);

    incrementRequestCount(statusCode >= 400, duration);

    const dur = Math.round(duration);
    query(`
      INSERT INTO api_metrics_hourly (endpoint, method, status_group, count, total_duration_ms, max_duration_ms, hour_bucket)
      VALUES ($1, $2, $3, 1, $4::bigint, $4::int, date_trunc('hour', NOW()))
      ON CONFLICT (endpoint, method, status_group, hour_bucket)
      DO UPDATE SET count = api_metrics_hourly.count + 1,
                    total_duration_ms = api_metrics_hourly.total_duration_ms + $4::bigint,
                    max_duration_ms = GREATEST(api_metrics_hourly.max_duration_ms, $4::int)
    `, [endpoint, request.method, `${Math.floor(statusCode / 100)}xx`, dur]).catch((err) => {
      logger.error('Failed to write API metrics', { module: 'metrics', error: (err as Error).message });
    });

    if (duration > 500) {
      query(`
        INSERT INTO slow_queries (query_text, duration_ms, caller, user_id, occurred_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        `${request.method} ${request.url}`,
        duration,
        endpoint,
        userId || null,
      ]).catch((err) => {
        logger.error('Failed to write slow request log', { module: 'metrics', error: (err as Error).message });
      });
    }

    if (statusCode >= 500) {
      captureError(
        new Error(`${statusCode} ${request.method} ${request.url}`),
        endpoint,
        userId,
        requestId
      ).catch((err) => {
        logger.error('Failed to capture error event', { module: 'metrics', error: (err as Error).message });
      });
    }
  });
}