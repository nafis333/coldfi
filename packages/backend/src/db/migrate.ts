import fs from 'fs';
import path from 'path';
import { pool, query, transaction } from './pool';
import { logger } from '../services/logger';

function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
    path.resolve(process.cwd(), 'packages/backend/src/db/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

const MIGRATIONS_DIR = resolveMigrationsDir();

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY name'
  );
  return new Set(result.rows.map((row) => row.name));
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.info('No migrations directory found', { module: 'migrate', path: MIGRATIONS_DIR });
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function runMigration(fileName: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(filePath, 'utf-8');

  await transaction(async (client) => {
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [fileName]);
  });

  logger.info(`Applied: ${fileName}`, { module: 'migrate' });
}

async function migrate(): Promise<void> {
  logger.info('Starting migration run', { module: 'migrate' });

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  if (files.length === 0) {
    logger.info('No migration files found', { module: 'migrate' });
    return;
  }

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info('All migrations already applied', { module: 'migrate' });
    return;
  }

  logger.info(`Found ${pending.length} pending migration(s)`, { module: 'migrate' });

  for (const file of pending) {
    await runMigration(file);
  }

  logger.info(`Applied ${pending.length} migration(s)`, { module: 'migrate' });
}

export async function runMigrations(): Promise<void> {
  await migrate();
}

// Allow running as standalone script
if (require.main === module) {
  migrate()
    .catch(async (err) => {
      await logger.fatal('Migration failed', { module: 'migrate', error: String(err) });
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}
