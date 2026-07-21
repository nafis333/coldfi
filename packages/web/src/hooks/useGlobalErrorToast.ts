import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePersonalStore } from '../stores/personalStore';
import { useToastStore } from '../stores/toastStore';

export function useGlobalErrorToast() {
  const authError = useAuthStore((s) => s.error);
  const personalError = usePersonalStore((s) => s.error);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (authError) {
      addToast('error', authError);
    }
  }, [authError, addToast]);

  useEffect(() => {
    if (personalError) {
      addToast('error', personalError);
    }
  }, [personalError, addToast]);
}
