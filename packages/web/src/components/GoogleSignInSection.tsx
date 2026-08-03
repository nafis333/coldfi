import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { silentCatch } from '../lib/errorHandler';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function buildGoogleAuthUrl(redirectUri: string): string {
  const nonce = generateNonce();
  sessionStorage.setItem('google_nonce', nonce);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default function GoogleSignInSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const hash = location.hash;
    if (hash && hash.includes('id_token=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const credential = params.get('id_token');
      if (credential) {
        window.location.hash = '';
        googleLogin(credential)
          .then(() => {
            navigate('/dashboard', { replace: true });
          })
          .catch((err) => {
            console.error('[GoogleSignIn] Login failed:', err);
            addToast('error', err?.message || 'Google sign-in failed');
            silentCatch('GoogleSignInSection.loginError', err);
          });
      }
    }
  }, [location.hash, googleLogin, navigate, addToast]);

  const handleClick = () => {
    const redirectUri = `${window.location.origin}${window.location.pathname === '/register' ? '/register' : '/login'}`;
    const url = buildGoogleAuthUrl(redirectUri);
    window.location.href = url;
  };

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

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

      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
