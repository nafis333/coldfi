import { createHash } from 'crypto';
import { GroupLogEventType } from '../types/enums';

export interface GroupLogEntry {
  id: string;
  groupId: string;
  eventType: GroupLogEventType;
  actorId: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  previousLogHash: string;
  hash: string;
}

export interface CreateLogEntryInput {
  id: string;
  groupId: string;
  eventType: GroupLogEventType;
  actorId: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  previousLogHash?: string;
}

export function createGroupLogEntry(input: CreateLogEntryInput): GroupLogEntry {
  const timestamp = input.timestamp || new Date().toISOString();
  const previousLogHash = input.previousLogHash || '';
  const metadata = input.metadata || {};

  const entry: Omit<GroupLogEntry, 'hash'> = {
    id: input.id,
    groupId: input.groupId,
    eventType: input.eventType,
    actorId: input.actorId,
    targetId: input.targetId,
    metadata,
    timestamp,
    previousLogHash,
  };

  const hash = computeLogHash(entry);

  return { ...entry, hash };
}

function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
    return `{${pairs.join(',')}}`;
  }
  return String(value);
}

export function computeLogHash(
  entry: Omit<GroupLogEntry, 'hash'>
): string {
  const obj: Record<string, unknown> = {
    id: entry.id,
    groupId: entry.groupId,
    eventType: entry.eventType,
    actorId: entry.actorId,
    targetId: entry.targetId || '',
    metadata: entry.metadata,
    timestamp: entry.timestamp,
    previousLogHash: entry.previousLogHash,
  };

  return sha512(canonicalStringify(obj));
}

export function verifyLogChain(entries: GroupLogEntry[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (entries.length === 0) {
    return { valid: true, errors: [] };
  }

  // Build a map from hash to entry for chain-following
  const byHash = new Map<string, GroupLogEntry>();
  const byId = new Map<string, GroupLogEntry>();
  for (const entry of entries) {
    byHash.set(entry.hash, entry);
    byId.set(entry.id, entry);
  }

  // Find the head (entry with no successor pointing to it)
  const successors = new Set<string>();
  for (const entry of entries) {
    if (entry.previousLogHash) successors.add(entry.previousLogHash);
  }

  const heads = entries.filter((e) => !successors.has(e.hash));
  if (heads.length === 0 && entries.length > 0) {
    errors.push('Circular or disconnected chain: no head entry found');
    return { valid: false, errors };
  }
  if (heads.length > 1) {
    errors.push(`Forked chain detected: ${heads.length} head entries found (${heads.map(h => h.id).join(', ')})`);
    return { valid: false, errors };
  }

  for (const head of heads) {
    const chain: GroupLogEntry[] = [];
    const visited = new Set<string>();
    let current: GroupLogEntry | undefined = head;

    while (current) {
      if (visited.has(current.hash)) {
        errors.push(`Circular reference detected at entry ${current.id}`);
        return { valid: false, errors };
      }
      visited.add(current.hash);
      chain.push(current);

      const { hash: _hash, ...entryWithoutHash } = current;
      const expectedHash = computeLogHash(entryWithoutHash);
      if (current.hash !== expectedHash) {
        errors.push(
          `Entry ${current.id}: hash mismatch. Expected "${expectedHash}", got "${current.hash}"`
        );
      }

      if (!current.previousLogHash) break;

      const prevHash = current.previousLogHash;
      current = byHash.get(prevHash);
      if (!current) {
        errors.push(`Entry ${chain[chain.length - 1]!.id}: missing predecessor with hash "${prevHash}"`);
        break;
      }
    }

    // Verify chain linking (predecessor hash matches next entry's previousLogHash)
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i]!.previousLogHash !== chain[i + 1]!.hash) {
        errors.push(
          `Entry ${chain[i + 1]!.id}: previousLogHash mismatch. Expected "${chain[i]!.hash}", got "${chain[i + 1]!.previousLogHash}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function sha512(data: string): string {
  return createHash('sha512').update(data).digest('hex');
}
