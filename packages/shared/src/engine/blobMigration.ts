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

  const sorted = [...migrations].sort(
    (a, b) => a.fromVersion - b.fromVersion
  );

  for (const m of sorted) {
    if (((current.version as number) ?? 0) < m.toVersion) {
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function ensureArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function normalizeExpense(exp: Record<string, unknown>): Record<string, unknown> {
  return {
    ...exp,
    id: exp.id ?? generateId(),
    currency: exp.currency ?? 'USD',
    date: exp.date ?? new Date().toISOString().split('T')[0],
    createdAt: exp.createdAt ?? new Date().toISOString(),
    updatedAt: exp.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeCategory(cat: Record<string, unknown>): Record<string, unknown> {
  return {
    ...cat,
    id: cat.id ?? generateId(),
    icon: cat.icon ?? '📦',
    color: cat.color ?? '#888888',
  };
}

function normalizeBudget(b: Record<string, unknown>): Record<string, unknown> {
  return {
    ...b,
    id: b.id ?? generateId(),
    type: b.type ?? 'monthly',
    alertThreshold: b.alertThreshold ?? 80,
  };
}

function normalizeGroupExpense(exp: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...exp };
  result.id = (exp.id as string) ?? generateId();
  result.categoryId = (exp.categoryId as string) ?? (exp.category as string) ?? '';
  result.paidBy = (exp.paidBy as string) ?? (exp.payerId as string) ?? '';
  result.createdAt = (exp.createdAt as string) ?? new Date().toISOString();
  result.date = (exp.date as string) ?? new Date().toISOString().split('T')[0];
  result.splits = ensureArray(exp.splits);
  delete result.category;
  delete result.payerId;
  return result;
}

function normalizeSettlement(s: Record<string, unknown>): Record<string, unknown> {
  return {
    ...s,
    currency: s.currency ?? 'USD',
    relatedExpenseIds: s.relatedExpenseIds ?? [],
    createdAt: s.createdAt ?? new Date().toISOString(),
    updatedAt: s.updatedAt ?? new Date().toISOString(),
  };
}

registerPersonalMigration({
  fromVersion: 0,
  toVersion: 1,
  migrate: (blob) => {
    const expenses = ensureArray(blob.expenses).map(normalizeExpense);
    const categories = ensureArray(blob.categories).map(normalizeCategory);
    const budgets = ensureArray(blob.budgets).map(normalizeBudget);
    return { ...blob, expenses, categories, budgets } as any;
  },
});

registerGroupMigration({
  fromVersion: 0,
  toVersion: 1,
  migrate: (blob) => {
    const expenses = ensureArray(blob.expenses).map(normalizeGroupExpense);
    const settlements = ensureArray(blob.settlements).map(normalizeSettlement);
    const categories = ensureArray(blob.categories).map(normalizeCategory);
    return { ...blob, expenses, settlements, categories } as any;
  },
});
