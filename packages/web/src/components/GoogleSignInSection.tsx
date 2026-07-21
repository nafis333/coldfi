import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleSignInSection() {
  const navigate = useNavigate();
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const addToast = useToastStore((s) => s.addToast);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;

    let cancelled = false;
    const cancelledRefs: (() => void)[] = [];

    const initGoogle = () => {
      if (!window.google || !buttonRef.current || cancelled) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            await googleLogin(response.credential);
            navigate('/dashboard', { replace: true });
          } catch (err: any) {
            console.error('[GoogleSignIn] Login failed:', err);
            addToast('error', err?.message || 'Google sign-in failed');
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 0,
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });

      if (!cancelled) setReady(true);
    };

    if (window.google) {
      initGoogle();
      return;
    }

    loadGoogleScript()
      .then(() => {
        const check = setInterval(() => {
          if (window.google && !cancelled) {
            clearInterval(check);
            initGoogle();
          }
        }, 200);
        cancelledRefs.push(() => clearInterval(check));
      })
      .catch(() => {
        if (!cancelled) {
          console.error('[GoogleSignIn] Failed to load Google script');
          addToast('error', 'Failed to load Google sign-in. Check your ad blocker.');
        }
      });

    return () => {
      cancelled = true;
      cancelledRefs.forEach(fn => fn());
    };
  }, [googleLogin, navigate, addToast]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-6">
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-white dark:bg-neutral-900 px-3 text-neutral-400 dark:text-neutral-500">
            or continue with
          </span>
        </div>
      </div>
      <div className="flex justify-center">
        <div ref={buttonRef} className={ready ? '' : 'h-10'} />
      </div>
    </div>
  );
}
