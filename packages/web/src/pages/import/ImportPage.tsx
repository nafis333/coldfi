import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { usePersonalStore } from '../../stores/personalStore';
import { usePersonalExpenseStore } from '../../stores/personalExpenseStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  description: string;
  category: string;
  amount: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  date: '',
  description: '',
  category: '',
  amount: '',
};

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Confirm'] as const;

export default function ImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addExpense = usePersonalExpenseStore((s) => s.addExpense);
  const categories = usePersonalStore((s) => s.categories);

  const [step, setStep] = useState<number>(0);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setResult({ success: false, message: 'CSV file is empty' });
          return;
        }
        setHeaders(results.meta.fields ?? []);
        setParsedData(results.data);
        setStep(1);
        setResult(null);
      },
      error: () => {
        setResult({ success: false, message: 'Failed to parse CSV file' });
      },
    });
  }, []);

  const handleAutoMap = useCallback(() => {
    const lower = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const mapping: ColumnMapping = {
      date: headers.find((h) => /date|day|when/.test(lower(h))) ?? '',
      description: headers.find((h) => /desc|note|memo|merchant|store/.test(lower(h))) ?? '',
      category: headers.find((h) => /cat|type|group/.test(lower(h))) ?? '',
      amount: headers.find((h) => /amount|total|price|cost|value/.test(lower(h))) ?? '',
    };
    setMapping(mapping);
    setStep(2);
  }, [headers]);

  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const resolveCategoryId = (categoryName: string): string => {
    if (!categoryName) return '';
    const name = categoryName.trim().toLowerCase();
    const match = categories.find((c) => c.name.toLowerCase() === name);
    if (match) return match.id;
    const partial = categories.find((c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()));
    return partial?.id ?? categories[0]?.id ?? '';
  };

  const handleConfirmImport = useCallback(async () => {
    setImporting(true);
    setResult(null);

    try {
      let imported = 0;
      for (const row of parsedData) {
        const amount = parseFloat(row[mapping.amount]);
        if (isNaN(amount) || amount <= 0) continue;

        await addExpense({
          amount,
          currency: useAuthStore.getState().defaultCurrency,
          categoryId: resolveCategoryId(row[mapping.category]),
          date: row[mapping.date] ?? new Date().toISOString().split('T')[0],
          payee: null,
          note: row[mapping.description] ?? null,
          paymentMethod: null,
          receiptUri: null,
          isRecurring: false,
        });
        imported++;
      }

      setResult({
        success: true,
        message: `Successfully imported ${imported} expense(s).`,
        count: imported,
      });
      setStep(3);
    } catch (err: any) {
      setResult({ success: false, message: err.message ?? 'Import failed' });
    } finally {
      setImporting(false);
    }
  }, [parsedData, mapping, addExpense, categories]);

  const reset = () => {
    setStep(0);
    setFileName('');
    setParsedData([]);
    setHeaders([]);
    setMapping(DEFAULT_MAPPING);
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Import Expenses</h1>
      <p className="text-sm text-neutral-500 mb-6">Upload a CSV file to bulk import expenses.</p>

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= step
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm ${i <= step ? 'text-neutral-900 font-semibold' : 'text-neutral-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="text-neutral-300 text-sm">→</span>}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div
          className="border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center hover:border-primary-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-lg font-semibold text-neutral-900 mb-1">Upload CSV File</p>
          <p className="text-sm text-neutral-500 mb-4">Click to browse or drag & drop</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          {result && !result.success && (
            <p className="text-sm text-danger-600 mt-2">{result.message}</p>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-sm text-neutral-500 mb-4">
            Map CSV columns to expense fields. Auto-map will try to detect them.
          </p>
          <button
            onClick={handleAutoMap}
            className="mb-6 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100"
          >
            Auto-Map Columns
          </button>

          <p className="text-xs text-neutral-400 mb-2">File: {fileName}</p>
          <div className="flex flex-col gap-3">
            {(Object.keys(DEFAULT_MAPPING) as (keyof ColumnMapping)[]).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-neutral-700 capitalize mb-1">
                  {field}
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) => updateMapping(field, e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {(!mapping.date || !mapping.amount) && (
            <p className="text-sm text-warning-600 mt-4">Date and Amount are required fields.</p>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={reset} className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200">
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!mapping.date || !mapping.amount}
              className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-neutral-500 mb-4">
            Preview the first {Math.min(parsedData.length, 10)} rows of parsed data.
          </p>

          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left">
                  <th className="px-4 py-2 font-semibold text-neutral-700">Date</th>
                  <th className="px-4 py-2 font-semibold text-neutral-700">Description</th>
                  <th className="px-4 py-2 font-semibold text-neutral-700">Category</th>
                  <th className="px-4 py-2 font-semibold text-neutral-700 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-neutral-700">{row[mapping.date]}</td>
                    <td className="px-4 py-2 text-neutral-700 max-w-xs truncate">{row[mapping.description]}</td>
                    <td className="px-4 py-2 text-neutral-700">{row[mapping.category]}</td>
                    <td className="px-4 py-2 text-neutral-900 font-semibold text-right">{formatCurrency(parseFloat(row[mapping.amount] || '0'), useAuthStore.getState().defaultCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedData.length > 10 && (
            <p className="text-xs text-neutral-400 mt-2">...and {parsedData.length - 10} more row(s)</p>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200">
              Back
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing}
              className="px-6 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${parsedData.length} Expense(s)`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          {result?.success ? (
            <>
              <p className="text-xl font-bold text-neutral-900 mb-2">Import Complete</p>
              <p className="text-sm text-neutral-500 mb-6">{result.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50"
                >
                  Import Another File
                </button>
                <button
                  onClick={() => navigate('/expenses')}
                  className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  View Expenses
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-neutral-900 mb-2">Import Failed</p>
              <p className="text-sm text-danger-600 mb-6">{result?.message}</p>
              <button onClick={reset} className="px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50">
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
