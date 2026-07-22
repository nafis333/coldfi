import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePersonalStore } from '../stores/personalStore';
import { usePersonalBudgetStore } from '../stores/personalBudgetStore';
import { usePersonalIncomeStore } from '../stores/personalIncomeStore';
import { usePersonalExpenseStore } from '../stores/personalExpenseStore';
import { useGroupStore } from '../stores/groupStore';
import { useGroupExpenseStore } from '../stores/groupExpenseStore';
import { useGroupSettlementStore } from '../stores/groupSettlementStore';
import { useRecurringStore } from '../stores/recurringStore';
import { useAdminStore } from '../stores/adminStore';
import { useAdminUserStore } from '../stores/adminUserStore';
import { useAdminConfigStore } from '../stores/adminConfigStore';
import { useLogStore } from '../stores/logStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useToastStore } from '../stores/toastStore';

function useStoreError(store: any, addToast: (type: 'error', msg: string) => void) {
  const error = store((s: any) => s.error);
  const prevRef = useRef(error);
  useEffect(() => {
    if (error && error !== prevRef.current) {
      addToast('error', error);
    }
    prevRef.current = error;
  }, [error, addToast]);
}

export function useGlobalErrorToast() {
  const addToast = useToastStore((s) => s.addToast);

  useStoreError(useAuthStore, addToast);
  useStoreError(usePersonalStore, addToast);
  useStoreError(usePersonalBudgetStore, addToast);
  useStoreError(usePersonalIncomeStore, addToast);
  useStoreError(usePersonalExpenseStore, addToast);
  useStoreError(useGroupStore, addToast);
  useStoreError(useGroupExpenseStore, addToast);
  useStoreError(useGroupSettlementStore, addToast);
  useStoreError(useRecurringStore, addToast);
  useStoreError(useAdminStore, addToast);
  useStoreError(useAdminUserStore, addToast);
  useStoreError(useAdminConfigStore, addToast);
  useStoreError(useLogStore, addToast);
  useStoreError(useAnalyticsStore, addToast);
}
