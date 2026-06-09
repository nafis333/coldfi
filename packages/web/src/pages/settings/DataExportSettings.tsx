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
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Data Export</h2>

      {/* CSV Export */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 mb-2">Export as CSV</h3>
        <p className="text-xs text-neutral-500 mb-3">Download all expenses as a CSV file.</p>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50"
        >
          Download CSV
        </button>
      </div>

      {/* Encrypted Backup */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-800 mb-2">Encrypted Backup</h3>
        <p className="text-xs text-neutral-500 mb-3">Download all data as an encrypted backup file.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="Backup password"
            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleExportBackup}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            Export
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-neutral-800 mb-2">Restore from Backup</h3>
        <p className="text-xs text-neutral-500 mb-3">Import data from an encrypted backup file.</p>
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            placeholder="Backup password"
            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50"
          >
            Choose File
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ftb"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {status && (
        <div
          className={`mt-4 px-4 py-3 rounded-lg text-sm font-semibold ${
            status.type === 'success' ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
