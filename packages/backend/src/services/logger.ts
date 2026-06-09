import { query } from '../db/pool';
import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  module?: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  action?: string;
  [key: string]: any;
}

class Logger {
  private buffer: Array<{
    level: LogLevel;
    module: string;
    message: string;
    metadata: any;
    requestId?: string;
    userId?: string;
    ip?: string;
  }> = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isProduction = config.NODE_ENV === 'production';
  private readonly MAX_BUFFER_SIZE = 1000;

  init() {
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  destroy() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }

  debug(message: string, ctx: LogContext = {}) {
    if (this.isProduction) return;
    this.log('debug', message, ctx);
  }

  info(message: string, ctx: LogContext = {}) {
    this.log('info', message, ctx);
  }

  warn(message: string, ctx: LogContext = {}) {
    this.log('warn', message, ctx);
  }

  error(message: string, ctx: LogContext = {}) {
    this.log('error', message, ctx);
  }

  fatal(message: string, ctx: LogContext = {}) {
    this.log('fatal', message, ctx);
    this.flush();
  }

  requestStart(
    requestId: string,
    method: string,
    url: string,
    userId?: string,
    ip?: string
  ) {
    this.info(`${method} ${url}`, {
      module: 'http',
      requestId,
      userId,
      ip,
      action: 'request_start',
      method,
      url,
    });
  }

  requestEnd(
    requestId: string,
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    userId?: string
  ) {
    const level: LogLevel =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(
      level,
      `${method} ${url} ${statusCode} ${durationMs}ms`,
      {
        module: 'http',
        requestId,
        userId,
        action: 'request_end',
        method,
        url,
        statusCode,
        durationMs,
      }
    );
  }

  authEvent(
    event: string,
    userId: string,
    ip?: string,
    metadata?: Record<string, any>
  ) {
    this.info(`Auth: ${event}`, {
      module: 'auth',
      userId,
      ip,
      action: event,
      ...metadata,
    });
  }

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'pek',
      'gk',
      'authKey',
      'authKeyHash',
      'passwordHash',
      'password_hash',
      'auth_key_hash',
      'two_factor_secret',
      'recovery_key_enc',
    ];
    const sanitized = { ...obj };
    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveKeys.some((s) =>
          key.toLowerCase().includes(s.toLowerCase())
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  private log(level: LogLevel, message: string, ctx: LogContext) {
    const entry = {
      level,
      module: ctx.module || 'app',
      message,
      metadata: this.sanitize(ctx),
      requestId: ctx.requestId,
      userId: ctx.userId,
      ip: ctx.ip,
    };

    if (this.isProduction) {
      console.log(
        JSON.stringify({ ...entry, timestamp: new Date().toISOString() })
      );
    } else {
      const color = {
        debug: '\x1b[90m',
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      }[level];
      console.log(
        `${color}[${level.toUpperCase()}]\x1b[0m [${entry.module}] ${message}`
      );
    }

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, 100);

    try {
      const values: string[] = [];
      const params: any[] = [];
      let i = 1;

      for (const entry of batch) {
        values.push(
          `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`
        );
        params.push(
          entry.level,
          entry.module,
          entry.message,
          JSON.stringify(entry.metadata),
          entry.requestId || null,
          entry.userId || null,
          entry.ip || null
        );
        i += 7;
      }

      await query(
        `INSERT INTO system_logs (level, module, message, metadata, request_id, user_id, ip_address) VALUES ${values.join(', ')}`,
        params
      );
    } catch (err) {
      for (const entry of batch.reverse()) {
        if (this.buffer.length < this.MAX_BUFFER_SIZE) {
          this.buffer.unshift(entry);
        }
      }
      console.error('[Logger] Failed to flush logs to database:', err);
    }
  }
}

export const logger = new Logger();
