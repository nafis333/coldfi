import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('127.0.0.1'),

  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().startsWith('redis'),

  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().positive().default(2000),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  PBKDF2_ITERATIONS: z.coerce.number().int().positive().default(600000),

  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  MAX_RECEIPT_SIZE_MB: z.coerce.number().int().positive().default(10),

  VAPID_SUBJECT: z.string().optional(),
  VAPID_EMAIL: z.string().email().optional(),

  ADMIN_API_KEY: z.string().min(16).optional(),
  ADMIN_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  ADMIN_PORT: z.coerce.number().int().positive().default(3002),
  ADMIN_CORS_ORIGIN: z.string().default('http://localhost:5174'),
  ADMIN_ALLOWED_IPS: z.string().default(''),
  ADMIN_EMAILS: z.string().default(''),

  DEBUG_MODE: z.string().default('false').transform(v => v === 'true' || v === '1'),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  SERVER_ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]{64}$/i, 'Must be exactly 64 hex characters (32 bytes)'),

  GOOGLE_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`
    );
    console.error(`Invalid environment variables:\n${messages.join('\n')}`);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

const EXPIRY_MULTIPLIERS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function parseExpirySeconds(expiry: string, fallbackSeconds: number = 900): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const num = parseInt(match[1]!, 10);
  const unit = match[2]!;
  return num * (EXPIRY_MULTIPLIERS[unit] || fallbackSeconds);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');
export const VERSION: string = pkg.version;
