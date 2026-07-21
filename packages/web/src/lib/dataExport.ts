import { usePersonalStore } from '../stores/personalStore';
import { usePersonalExpenseStore } from '../stores/personalExpenseStore';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { encryptData, decryptData, deriveKey, generateSalt, uint8ArrayToBase64, base64ToUint8Array } from './crypto';

interface ExportPayload {
  version: number;
  exportedAt: string;
  userId: string;
  data: {
    expenses: any[];
    groups: any[];
  };
}

export async function exportEncryptedBackup(password: string): Promise<void> {
  const userId = useAuthStore.getState().userId ?? 'unknown';
  const expenses = usePersonalStore.getState().expenses;
  const groups = useGroupStore.getState().groups;

  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    data: { expenses, groups },
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

  const { expenses, groups } = payload.data;
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) throw new Error('Not authenticated');

  // Import each expense via API to ensure proper encryption & server sync
  const expenseStore = usePersonalExpenseStore.getState();
  for (const expense of expenses ?? []) {
    await expenseStore.addExpense(expense);
  }

  // Groups are referenced by ID; queue a full re-sync
  useGroupStore.getState().fetchGroups();
}

export function exportExpensesCSV(): void {
  const expenses = usePersonalStore.getState().expenses;

  const headers = ['Date', 'Description', 'Category', 'Amount'];
  const rows = expenses.map((e: any) => [
    e.date ?? '',
    e.note ?? '',
    e.categoryId ?? '',
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
