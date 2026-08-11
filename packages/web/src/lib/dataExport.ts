import { usePersonalStore } from '../stores/personalStore';
import { usePersonalExpenseStore } from '../stores/personalExpenseStore';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from './apiClient';
import { getGroupKey } from './groupSync';
import { encryptData, decryptData, deriveKey, generateSalt, uint8ArrayToBase64, base64ToUint8Array } from './crypto';

interface ExportPayload {
  version: number;
  exportedAt: string;
  userId: string;
  data: {
    expenses: any[];
    groups: any[];
    budgets: any[];
    categories: any[];
    incomeLogs: any[];
    savingsTargets: any[];
    recurringBills: any[];
  };
}

async function fetchGroupData(): Promise<any[]> {
  const groups = useGroupStore.getState().groups;
  const out: any[] = [];
  for (const g of groups) {
    const entry: any = { ...g, decryptedData: null };
    try {
      const gk = getGroupKey(g.id);
      const res = await apiClient(`/api/group/${g.id}/sync`);
      if (res.ok && gk) {
        const syncData = await res.json();
        if (syncData.encryptedBlob) {
          const plaintext = await decryptData(gk, syncData.encryptedBlob);
          entry.decryptedData = JSON.parse(plaintext);
        }
      }
    } catch (err) {
      // Include the group summary even if its blob could not be exported.
    }
    out.push(entry);
  }
  return out;
}

export async function exportEncryptedBackup(password: string): Promise<void> {
  const userId = useAuthStore.getState().userId ?? 'unknown';
  const { expenses, budgets, categories, incomeLogs, savingsTargets, personalBlob } = usePersonalStore.getState();
  const groups = await fetchGroupData();

  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    data: {
      expenses,
      groups,
      budgets,
      categories,
      incomeLogs,
      savingsTargets,
      recurringBills: personalBlob?.recurringBills ?? [],
    },
  };

  const saltRaw = generateSalt(16);
  const saltBase64 = uint8ArrayToBase64(saltRaw);
  const key = await deriveKey(password, saltBase64);
  const ciphertext = await encryptData(key, JSON.stringify(payload));

  const envelope = {
    salt: saltBase64,
    data: ciphertext,
    version: 1,
  };

  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coldfi-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.ftb`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importEncryptedBackup(file: File, password: string): Promise<void> {
  const text = await file.text();
  let envelope: { salt: string; data: string; version: number };
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('Invalid backup file format');
  }

  if (!envelope.salt || !envelope.data) {
    throw new Error('Corrupted backup file');
  }

  const key = await deriveKey(password, envelope.salt);
  let plaintext: string;
  try {
    plaintext = await decryptData(key, envelope.data);
  } catch {
    throw new Error('Decryption failed. Wrong password?');
  }

  let payload: ExportPayload;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    throw new Error('Invalid backup data');
  }

  const { expenses, budgets, categories, incomeLogs, savingsTargets, recurringBills } = payload.data;
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) throw new Error('Not authenticated');

  // Import each expense via API to ensure proper encryption & server sync
  const expenseStore = usePersonalExpenseStore.getState();
  for (const expense of expenses ?? []) {
    await expenseStore.addExpense(expense);
  }

  // Restore the remaining blob slices in a single encrypted save
  const personalStore = usePersonalStore.getState();
  const currentBlob = personalStore.personalBlob;
  const restored: any = {
    ...(currentBlob || { expenses: [], budgets: [], categories: [], incomeLogs: [], savingsTargets: [] }),
    budgets: budgets ?? [],
    categories: categories ?? [],
    incomeLogs: incomeLogs ?? [],
    savingsTargets: savingsTargets ?? [],
    recurringBills: recurringBills ?? [],
  };
  await personalStore.savePersonalBlob(restored);
  await personalStore.fetchPersonalBlob();

  // Groups are referenced by ID; queue a full re-sync
  try { await useGroupStore.getState().fetchGroups(); } catch {}
}

export function exportExpensesCSV(): void {
  const expenses = usePersonalStore.getState().expenses;
  const categories = usePersonalStore.getState().categories;
  const categoryName = new Map(categories.map((c: any) => [c.id, c.name]));

  const headers = ['Date', 'Description', 'Category', 'Amount'];
  const rows = expenses.map((e: any) => [
    e.date ?? '',
    e.note ?? '',
    categoryName.get(e.categoryId) ?? e.categoryId ?? '',
    e.amount?.toFixed(2) ?? '0.00',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((v: string) => `"${v.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
