type BlobVersion = number;

export const CURRENT_BLOB_VERSION: BlobVersion = 1;

export type BlobMigration<BlobT extends { version: number }> = {
  fromVersion: BlobVersion;
  toVersion: BlobVersion;
  migrate: (blob: Record<string, unknown>) => BlobT;
};

const personalMigrations: BlobMigration<any>[] = [];
const groupMigrations: BlobMigration<any>[] = [];

export function registerPersonalMigration(
  migration: BlobMigration<any>
): void {
  personalMigrations.push(migration);
}

export function registerGroupMigration(
  migration: BlobMigration<any>
): void {
  groupMigrations.push(migration);
}

export function migrateBlob<BlobT extends { version: number }>(
  blob: Record<string, unknown>,
  migrations: BlobMigration<any>[]
): BlobT {
  let current = { ...blob };
  const startVersion = (current.version as number) || 0;

  const sorted = [...migrations].sort(
    (a, b) => a.fromVersion - b.fromVersion
  );

  for (const m of sorted) {
    if ((current.version as number) < m.toVersion) {
      current = { ...current, ...m.migrate(current) };
      current.version = m.toVersion;
    }
  }

  return current as unknown as BlobT;
}

export function migratePersonalBlob(
  blob: Record<string, unknown>
): Record<string, unknown> {
  return migrateBlob(blob, personalMigrations);
}

export function migrateGroupBlob(
  blob: Record<string, unknown>
): Record<string, unknown> {
  return migrateBlob(blob, groupMigrations);
}
