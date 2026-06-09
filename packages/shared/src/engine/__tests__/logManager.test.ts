import { describe, it, expect } from 'vitest';
import {
  createGroupLogEntry,
  verifyLogChain,
  computeLogHash,
  type GroupLogEntry,
} from '../logManager';
import { GroupLogEventType } from '../../types/enums';

function makeEntry(overrides: Partial<GroupLogEntry> & { groupId: string; actorId: string }): GroupLogEntry {
  return createGroupLogEntry({
    id: overrides.id || 'test-id',
    groupId: overrides.groupId,
    actorId: overrides.actorId,
    eventType: overrides.eventType ?? GroupLogEventType.MEMBER_JOINED,
    metadata: overrides.metadata ?? {},
    timestamp: overrides.timestamp,
    previousLogHash: overrides.previousLogHash,
  });
}

function cloneEntry(entry: GroupLogEntry): GroupLogEntry {
  return JSON.parse(JSON.stringify(entry));
}

describe('computeLogHash', () => {
  it('produces the same hash for the same input', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1' });
    const { hash: _, ...withoutHash } = entry;
    const hash1 = computeLogHash(withoutHash);
    const hash2 = computeLogHash(withoutHash);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const e1 = makeEntry({ groupId: 'g1', actorId: 'u1', metadata: { a: 1 } });
    const e2 = makeEntry({ groupId: 'g1', actorId: 'u1', metadata: { a: 2 } });
    const { hash: _, ...w1 } = e1;
    const { hash: __, ...w2 } = e2;
    expect(computeLogHash(w1)).not.toBe(computeLogHash(w2));
  });
});

describe('createGroupLogEntry', () => {
  it('creates an entry with a non-empty hash', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1' });
    expect(entry.hash).toBeTruthy();
    expect(entry.hash.length).toBe(128); // SHA-512 hex
  });

  it('uses empty previousLogHash by default', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1' });
    expect(entry.previousLogHash).toBe('');
  });

  it('links to a previous hash when provided', () => {
    const first = makeEntry({ groupId: 'g1', actorId: 'u1' });
    const second = makeEntry({ groupId: 'g1', actorId: 'u1', previousLogHash: first.hash });
    expect(second.previousLogHash).toBe(first.hash);
  });

  it('includes all provided metadata', () => {
    const meta = { description: 'Dinner', amount: 50, currency: 'USD' };
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1', metadata: meta });
    expect(entry.metadata).toEqual(meta);
  });
});

describe('verifyLogChain', () => {
  it('accepts a valid single-entry chain', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1' });
    const result = verifyLogChain([entry]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a valid multi-entry chain', () => {
    const entries: GroupLogEntry[] = [];
    let prevHash = '';
    for (let i = 0; i < 5; i++) {
      const entry = makeEntry({
        groupId: 'g1',
        actorId: 'u1',
        previousLogHash: prevHash,
        metadata: { index: i },
      });
      entries.push(entry);
      prevHash = entry.hash;
    }
    const result = verifyLogChain(entries);
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered entry (modified payload after hashing)', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1' });
    const tampered = cloneEntry(entry);
    (tampered.metadata as Record<string, unknown>).tampered = true;

    const result = verifyLogChain([tampered]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /hash/i.test(e))).toBe(true);
  });

  it('rejects a chain with broken previousLogHash', () => {
    const entry1 = makeEntry({ groupId: 'g1', actorId: 'u1' });
    const entry2 = makeEntry({
      groupId: 'g1',
      actorId: 'u1',
      previousLogHash: '0'.repeat(128),
    });
    const result = verifyLogChain([entry1, entry2]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /predecessor/i.test(e))).toBe(true);
  });

  it('accepts first entry with empty previousLogHash', () => {
    const entry = makeEntry({ groupId: 'g1', actorId: 'u1', previousLogHash: '' });
    const result = verifyLogChain([entry]);
    expect(result.valid).toBe(true);
  });

  it('rejects a chain where a middle entry was replaced', () => {
    const entries: GroupLogEntry[] = [];
    let prevHash = '';
    for (let i = 0; i < 3; i++) {
      const entry = makeEntry({
        groupId: 'g1',
        actorId: 'u1',
        previousLogHash: prevHash,
        metadata: { index: i },
      });
      entries.push(entry);
      prevHash = entry.hash;
    }

    const replacement = makeEntry({
      id: 'replaced',
      groupId: 'g1',
      actorId: 'u1',
      previousLogHash: entries[0]!.hash,
      metadata: { index: 999 },
    });
    entries[1] = replacement;

    const result = verifyLogChain(entries);
    expect(result.valid).toBe(false);
  });

  it('returns valid for empty array', () => {
    const result = verifyLogChain([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
