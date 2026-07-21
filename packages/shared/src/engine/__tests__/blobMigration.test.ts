import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateBlob,
  migratePersonalBlob,
  migrateGroupBlob,
  registerPersonalMigration,
  registerGroupMigration,
  CURRENT_BLOB_VERSION,
} from '../blobMigration';

describe('migrateBlob', () => {
  it('migrates a version-0 personal blob to the latest version', () => {
    const blob = { version: 0 };
    const result = migrateBlob(blob, []);
    expect(result.version).toBe(0);
  });

  it('returns the blob unchanged if already at latest version', () => {
    const blob = { version: CURRENT_BLOB_VERSION, expenses: [], categories: [], budgets: [] };
    const result = migrateBlob(blob, []);
    expect(result).toEqual(blob);
  });
});

describe('migratePersonalBlob', () => {
  it('adds missing required fields to an empty blob', () => {
    const result = migratePersonalBlob({ version: 0 });
    expect(Array.isArray((result as any).expenses)).toBe(true);
    expect(Array.isArray((result as any).categories)).toBe(true);
    expect(Array.isArray((result as any).budgets)).toBe(true);
    expect(result.version).toBe(CURRENT_BLOB_VERSION);
  });

  it('normalizes expense fields', () => {
    const result = migratePersonalBlob({
      version: 0,
      expenses: [{ amount: 50 }],
    }) as any;
    expect(result.expenses[0]).toHaveProperty('id');
    expect(result.expenses[0]).toHaveProperty('currency');
    expect(result.expenses[0]).toHaveProperty('date');
    expect(result.expenses[0]).toHaveProperty('createdAt');
    expect(result.expenses[0]).toHaveProperty('updatedAt');
    expect(result.expenses[0].amount).toBe(50);
  });

  it('preserves existing expense data during migration', () => {
    const result = migratePersonalBlob({
      version: 0,
      expenses: [{ id: 'exp-1', amount: 100, currency: 'USD', description: 'Test' }],
    }) as any;
    expect(result.expenses[0].id).toBe('exp-1');
    expect(result.expenses[0].amount).toBe(100);
    expect(result.expenses[0].currency).toBe('USD');
  });

  it('normalizes category fields', () => {
    const result = migratePersonalBlob({
      version: 0,
      categories: [{ name: 'Food' }],
    }) as any;
    expect(result.categories[0]).toHaveProperty('id');
    expect(result.categories[0]).toHaveProperty('icon');
    expect(result.categories[0]).toHaveProperty('color');
    expect(result.categories[0].name).toBe('Food');
  });

  it('normalizes budget fields', () => {
    const result = migratePersonalBlob({
      version: 0,
      budgets: [{ amount: 500 }],
    }) as any;
    expect(result.budgets[0]).toHaveProperty('id');
    expect(result.budgets[0]).toHaveProperty('type');
    expect(result.budgets[0]).toHaveProperty('alertThreshold');
    expect(result.budgets[0].amount).toBe(500);
  });

  it('leaves a v1 blob unchanged', () => {
    const blob = { version: 1, expenses: [], categories: [], budgets: [], recurringBills: [] };
    const result = migratePersonalBlob(blob as any);
    expect(result).toEqual(blob);
  });
});

describe('migrateGroupBlob', () => {
  it('adds missing required fields to an empty group blob', () => {
    const result = migrateGroupBlob({ version: 0 });
    expect(Array.isArray((result as any).expenses)).toBe(true);
    expect(Array.isArray((result as any).settlements)).toBe(true);
    expect(Array.isArray((result as any).categories)).toBe(true);
    expect(result.version).toBe(CURRENT_BLOB_VERSION);
  });

  it('normalizes group expense fields', () => {
    const result = migrateGroupBlob({
      version: 0,
      expenses: [{ amount: 200, description: 'Group Dinner' }],
    }) as any;
    expect(result.expenses[0]).toHaveProperty('id');
    expect(result.expenses[0]).toHaveProperty('category');
    expect(result.expenses[0]).toHaveProperty('payerId');
    expect(result.expenses[0]).toHaveProperty('createdAt');
    expect(result.expenses[0].amount).toBe(200);
    expect(result.expenses[0].description).toBe('Group Dinner');
  });

  it('normalizes settlement fields', () => {
    const result = migrateGroupBlob({
      version: 0,
      settlements: [{ amount: 50 }],
    }) as any;
    expect(result.settlements[0]).toHaveProperty('currency');
    expect(result.settlements[0]).toHaveProperty('relatedExpenseIds');
    expect(result.settlements[0]).toHaveProperty('createdAt');
    expect(result.settlements[0]).toHaveProperty('updatedAt');
    expect(result.settlements[0].amount).toBe(50);
  });

  it('normalizes group category fields', () => {
    const result = migrateGroupBlob({
      version: 0,
      categories: [{ name: 'Travel' }],
    }) as any;
    expect(result.categories[0]).toHaveProperty('id');
    expect(result.categories[0]).toHaveProperty('icon');
    expect(result.categories[0]).toHaveProperty('color');
    expect(result.categories[0].name).toBe('Travel');
  });
});

describe('registerPersonalMigration', () => {
  it('runs a custom personal migration after registration', () => {
    registerPersonalMigration({
      fromVersion: 1,
      toVersion: 2,
      migrate: (blob: Record<string, unknown>) => {
        const result = { ...blob };
        (result as any).customField = 'hello';
        result.version = 2;
        return result;
      },
    });

    const blob = { version: 1, expenses: [], categories: [], budgets: [] };
    const result = migratePersonalBlob(blob as any) as any;
    expect(result.version).toBe(2);
    expect(result.customField).toBe('hello');
  });
});

describe('registerGroupMigration', () => {
  it('runs a custom group migration after registration', () => {
    registerGroupMigration({
      fromVersion: 1,
      toVersion: 2,
      migrate: (blob: Record<string, unknown>) => {
        const result = { ...blob };
        (result as any).customGroupField = 'world';
        result.version = 2;
        return result;
      },
    });

    const blob = { version: 1, expenses: [], settlements: [], categories: [] };
    const result = migrateGroupBlob(blob as any) as any;
    expect(result.version).toBe(2);
    expect(result.customGroupField).toBe('world');
  });
});
