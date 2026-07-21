import { apiClient } from './apiClient';
import { encryptData, decryptData, deriveGroupKey } from './crypto';
import { useAuthStore } from '../stores/authStore';
import { migrateGroupBlob, GroupExpense, SettlementProposal, PaymentMethod, SplitMode, ExpenseStatus, SettlementStatus, computeNetBalances } from '@coldfi/shared';

export { migrateGroupBlob } from '@coldfi/shared';

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  balance: number;
  joinedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  defaultCurrency: string;
  members: GroupMember[];
  settlements: SettlementData[];
  expenses: GroupExpenseData[];
  groupCategories: GroupCategory[];
  myBalance: number;
  balances: any[];
}

export interface MemberSplit {
  userId: string;
  amount: number;
}

export interface ItemizedEntry {
  name: string;
  amount: number;
  assignedTo?: string[];
  splitMode?: 'equal' | 'exact' | 'percentage';
  splitValues?: Record<string, number>;
}

export interface GroupExpenseInput {
  amount: number;
  description: string;
  category: string;
  payerId: string;
  splits: MemberSplit[];
  itemized?: ItemizedEntry[];
  splitMode?: SplitMode;
  splitParams?: Record<string, number>;
}

export interface GroupExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  payerId: string;
  date: string;
  splits: MemberSplit[];
  itemized?: ItemizedEntry[];
  displayId?: string;
  createdAt: string;
}

export interface SettlementInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency?: string;
  note?: string;
  relatedExpenseIds?: string[];
}

export interface SettlementData {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  note?: string;
  status: SettlementStatus;
  proposedAt: string;
  markedPaidAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  relatedExpenseIds: string[];
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface GroupSyncData {
  expenses: GroupExpenseData[];
  settlements: SettlementData[];
  categories: GroupCategory[];
}

const groupKeyCache = new Map<string, CryptoKey>();

export function getGroupKey(groupId: string): CryptoKey | undefined {
  return groupKeyCache.get(groupId);
}

export function cacheGroupKey(groupId: string, passphrase: string): Promise<CryptoKey> {
  return deriveGroupKey(passphrase, groupId).then((key) => {
    groupKeyCache.set(groupId, key);
    return key;
  });
}

export function clearGroupKeyCache(): void {
  groupKeyCache.clear();
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassphrase(passphrase: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const key = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function modifySyncBlob(
  groupId: string,
  groupKey: CryptoKey,
  mutate: (data: GroupSyncData) => void
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const syncRes = await apiClient(`/api/group/${groupId}/sync`);
      if (!syncRes.ok) throw new Error(`Failed to fetch group data: ${syncRes.status}`);

      const syncData = await syncRes.json();
      const vectorClock = syncData.vectorClock || {};

      let groupData: GroupSyncData = {
        expenses: [],
        settlements: [],
        categories: [],
      };
      if (syncData.encryptedBlob) {
        const decrypted = await decryptData(groupKey, syncData.encryptedBlob);
        const parsed: any = migrateGroupBlob(JSON.parse(decrypted));
        groupData = {
          expenses: parsed.expenses || [],
          settlements: parsed.settlements || [],
          categories: parsed.categories || [],
        };
      }

      mutate(groupData);

      const encrypted = await encryptData(groupKey, JSON.stringify(groupData));

      const putRes = await apiClient(`/api/group/${groupId}/sync`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ encryptedBlob: encrypted, vectorClock }),
      });

      if (putRes.status === 409) {
        lastError = new Error('Data conflict. Retrying...');
        continue;
      }

      if (!putRes.ok) {
        throw new Error(`Failed to save sync data: ${putRes.status}`);
      }

      return;
    } catch (e) {
      if (e instanceof Error && e.message !== 'Data conflict. Retrying...') {
        throw e;
      }
      lastError = e instanceof Error ? e : new Error('Failed to modify sync data');
    }
  }

  throw lastError || new Error('Failed to modify sync data after retries');
}

export async function createGroupNotification(type: string, title: string, body: string, groupId: string, settlementId?: string) {
  if (!useAuthStore.getState().accessToken) return;
  try {
    await apiClient('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, body, groupId, settlementId }),
    });
  } catch { /* best-effort */ }
}

export function toEngineExpenses(
  expenses: GroupExpenseData[],
  groupId: string,
  defaultCurrency: string
): GroupExpense[] {
  return expenses.map((e) => ({
    id: e.id,
    groupId,
    amount: e.amount,
    currency: defaultCurrency,
    categoryId: e.category,
    description: e.description,
    date: e.date || e.createdAt,
    paidBy: e.payerId,
    paymentMethod: PaymentMethod.CASH,
    splitMode: SplitMode.FIXED,
    splits: e.splits.map((s) => ({
      memberId: s.userId,
      ratio: s.amount / e.amount,
      fixedAmount: s.amount,
      isPaid: false,
    })),
    itemizedItems: e.itemized?.map((i) => {
      const participants = (i as any).assignedTo;
      return {
        id: `item_${i.name}`,
        name: i.name,
        amount: i.amount,
        assignedTo: Array.isArray(participants) && participants.length > 0
          ? participants
          : e.splits.map((s) => s.userId),
        splitMode: (i as any).splitMode || undefined,
        splitAmounts: (i as any).splitValues || undefined,
      };
    }),
    status: ExpenseStatus.UNSETTLED,
    isRecurring: false,
    createdAt: e.createdAt,
    updatedAt: e.createdAt,
    createdBy: e.payerId,
  }));
}

export function toEngineSettlements(settlements: SettlementData[]): SettlementProposal[] {
  return settlements.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount,
    currency: s.currency,
    status: s.status as SettlementStatus,
    proposedAt: s.proposedAt,
    markedPaidAt: s.markedPaidAt,
    approvedAt: s.approvedAt,
    rejectedAt: s.rejectedAt,
    cancelledAt: s.cancelledAt,
    note: s.note,
    relatedExpenseIds: s.relatedExpenseIds,
    supersededBy: s.supersededBy,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}
