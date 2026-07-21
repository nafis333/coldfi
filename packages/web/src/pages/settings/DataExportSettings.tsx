import { useState, useRef } from 'react';
import { exportEncryptedBackup, importEncryptedBackup, exportExpensesCSV } from '../../lib/dataExport';

export default function DataExportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExportBackup = async () => {
    setStatus(null);
    if (!backupPassword) { setStatus({ type: 'error', message: 'Password is required' }); return; }
    try {
      await exportEncryptedBackup(backupPassword);
      setStatus({ type: 'success', message: 'Backup downloaded successfully' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message ?? 'Export failed' });
    }
  };

  const handleExportCSV = () => {
    setStatus(null);
    try {
      exportExpensesCSV();
      setStatus({ type: 'success', message: 'CSV downloaded' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message ?? 'CSV export failed' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importPassword) return;
    setStatus(null);
    try {
      await importEncryptedBackup(file, importPassword);
      setStatus({ type: 'success', message: 'Backup restored successfully' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message ?? 'Import failed' });
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Data Export</h2>

      <div className="card p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Export as CSV</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Download all expenses as a CSV file.</p>
        <button onClick={handleExportCSV} className="btn-secondary text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download CSV
        </button>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Encrypted Backup</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Download all data as an encrypted backup file.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="Backup password"
            className="input-field flex-1"
          />
          <button onClick={handleExportBackup} className="btn-primary">
            Export
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Restore from Backup</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Import data from an encrypted backup file.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            placeholder="Backup password"
            className="input-field flex-1"
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Choose File
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".ftb" onChange={handleImport} className="hidden" />
      </div>

      {status && (
        <div className={`mt-4 rounded-lg border p-3 text-sm font-medium ${
          status.type === 'success'
            ? 'bg-success-50 dark:bg-success-700/20 border-success-200 dark:border-success-700 text-success-700 dark:text-success-300'
            : 'bg-danger-50 dark:bg-danger-700/20 border-danger-200 dark:border-danger-700 text-danger-700 dark:text-danger-300'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
}