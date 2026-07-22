import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import TabSyncStatus from '../../components/settings/TabSyncStatus';
import QRCode from 'qrcode';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function SecuritySettings() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const changePassword = useAuthStore((s) => s.changePassword);

  // --- Change Password ---
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // --- 2FA ---
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoaded, setTwoFaLoaded] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<'idle' | 'setup' | 'enable' | 'disable'>('idle');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaUri, setTwoFaUri] = useState('');
  const [twoFaQrDataUrl, setTwoFaQrDataUrl] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaSuccess, setTwoFaSuccess] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/2fa/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTwoFaEnabled(data.enabled);
        }
      } catch {
      } finally {
        setTwoFaLoaded(true);
      }
    })();
  }, [accessToken]);

  // --- Logout All ---
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutAllMsg, setLogoutAllMsg] = useState('');



  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      await changePassword(oldPw, newPw);
      setPwSuccess('Password changed successfully');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleTwoFaSetup() {
    setTwoFaError('');
    setTwoFaSuccess('');
    setTwoFaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to start 2FA setup');
      const data = await res.json();
      setTwoFaSecret(data.secret);
      setTwoFaUri(data.otpauthUrl);
      try {
        const url = await new Promise<string>((resolve, reject) => {
          QRCode.toDataURL(data.otpauthUrl, { width: 200, margin: 1 }, (err: Error | null | undefined, url: string) => {
            if (err) reject(err); else resolve(url);
          });
        });
        setTwoFaQrDataUrl(url);
      } catch {
        console.error('Failed to generate QR code');
      }
      setTwoFaStep('setup');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleTwoFaEnable() {
    if (twoFaCode.length !== 6) return;
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: twoFaCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid code');
      }
      setTwoFaEnabled(true);
      setTwoFaSuccess('Two-factor authentication enabled');
      setTwoFaStep('idle');
      setTwoFaCode('');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleTwoFaDisable() {
    if (twoFaCode.length !== 6) return;
    setTwoFaError('');
    setTwoFaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: twoFaCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid code');
      }
      setTwoFaEnabled(false);
      setTwoFaSuccess('Two-factor authentication disabled');
      setTwoFaStep('idle');
      setTwoFaCode('');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleLogoutAll() {
    setLogoutAllMsg('');
    setLogoutAllLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/logout-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to logout all devices');
      setLogoutAllMsg('All other devices have been logged out');
    } catch (err) {
      setLogoutAllMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLogoutAllLoading(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Security</h2>

      {/* Change Password */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800 dark:text-neutral-200">Change Password</h3>
        <form onSubmit={handleChangePassword} className="flex max-w-sm flex-col gap-3">
          <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Current password" className="input-field" />
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" className="input-field" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" className="input-field" />
          {pwError && <p className="text-sm text-danger-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-success-600">{pwSuccess}</p>}
          <button type="submit" disabled={pwLoading} className="btn-primary self-start">
            {pwLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* 2FA */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800 dark:text-neutral-200">Two-Factor Authentication</h3>
        {twoFaStep === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {twoFaEnabled
                ? 'Two-factor authentication is enabled. Enter your current TOTP code to disable it.'
                : 'Add an extra layer of security by requiring a one-time code from your authenticator app.'}
            </p>
            {twoFaEnabled ? (
              <div className="flex items-center gap-3">
                <input
                  type="text" maxLength={6} placeholder="000000"
                  value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field w-28 text-center text-lg tracking-widest"
                />
                <button onClick={handleTwoFaDisable} disabled={twoFaLoading || twoFaCode.length !== 6} className="btn-ghost text-sm">
                  {twoFaLoading ? 'Disabling...' : 'Disable'}
                </button>
              </div>
            ) : (
              <button onClick={handleTwoFaSetup} disabled={twoFaLoading} className="btn-primary text-sm">
                {twoFaLoading ? 'Setting up...' : 'Set Up Two-Factor Authentication'}
              </button>
            )}
          </div>
        )}

        {twoFaStep === 'setup' && (
          <div className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Scan this code with your authenticator app (e.g. Google Authenticator, Authy), or enter the secret manually:
            </p>
            {twoFaQrDataUrl && (
              <div className="flex justify-center">
                <img src={twoFaQrDataUrl} alt="2FA QR Code" className="h-40 w-40 rounded-lg" />
              </div>
            )}
            {twoFaSecret && (
              <div className="text-center">
                <code className="rounded bg-neutral-200 dark:bg-neutral-700 px-3 py-1 text-sm font-mono select-all">{twoFaSecret}</code>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <input
                type="text" maxLength={6} placeholder="Enter 6-digit code"
                value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field w-32 text-center text-lg tracking-widest"
                autoFocus
              />
              <button onClick={handleTwoFaEnable} disabled={twoFaLoading || twoFaCode.length !== 6} className="btn-primary text-sm">
                {twoFaLoading ? 'Verifying...' : 'Verify & Enable'}
              </button>
              <button onClick={() => { setTwoFaStep('idle'); setTwoFaCode(''); }} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        )}

        {twoFaError && <p className="mt-2 text-sm text-danger-600">{twoFaError}</p>}
        {twoFaSuccess && <p className="mt-2 text-sm text-success-600">{twoFaSuccess}</p>}
      </div>

      {/* Logout All Devices */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800 dark:text-neutral-200">Sessions</h3>
        <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
          Log out of all other devices where you're signed in. Your current session will remain active.
        </p>
        <button onClick={handleLogoutAll} disabled={logoutAllLoading} className="btn-ghost text-sm border border-danger-300 text-danger-600 hover:bg-danger-50">
          {logoutAllLoading ? 'Logging out...' : 'Log Out All Devices'}
        </button>
        {logoutAllMsg && <p className="mt-2 text-sm text-success-600">{logoutAllMsg}</p>}
      </div>

      {/* Multi-Tab Sync */}
      <div className="mt-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800 dark:text-neutral-200">Multi-Tab Sync</h3>
        <TabSyncStatus />
      </div>
    </div>
  );
}
