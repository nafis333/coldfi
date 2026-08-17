import { useState, useRef, useCallback } from 'react';
import { readReceiptFile, type ReceiptFile, type ReceiptValidationError } from '../lib/receipt';

interface ReceiptUploadProps {
  onReceiptChange: (receipt: ReceiptFile | null) => void;
  existingUri?: string;
}

export default function ReceiptUpload({ onReceiptChange, existingUri }: ReceiptUploadProps) {
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const result = await readReceiptFile(file);
      setReceipt(result);
      onReceiptChange(result);
    } catch (err) {
      const validationErr = err as ReceiptValidationError;
      // A rejected replacement must not silently leave the old receipt
      // attached — the user would submit thinking the new file was applied.
      setReceipt(null);
      onReceiptChange(null);
      setError(validationErr.message);
    }
  }, [onReceiptChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handlePicker = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    setReceipt(null);
    setError(null);
    onReceiptChange(null);
  }, [onReceiptChange]);

  const previewUrl = receipt?.preview || existingUri;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-700">Receipt</label>

      {previewUrl ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-48 w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-3">
            {receipt && (
              <span className="text-sm text-neutral-500 truncate flex-1">
                {receipt.name} ({(receipt.size / 1024).toFixed(0)}KB)
              </span>
            )}
            <button onClick={handleRemove} className="text-sm text-danger-600 hover:text-danger-700 font-medium">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            isDragOver
              ? 'border-primary-500 bg-primary-50'
              : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
          }`}
        >
          <span className="mb-2 text-2xl font-bold text-neutral-400">+</span>
          <p className="text-sm font-medium text-neutral-600">
            {isDragOver ? 'Drop file here' : 'Drag & drop receipt or click to browse'}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            JPEG, PNG, WebP, PDF &mdash; up to 5MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handlePicker}
        className="hidden"
      />

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}
    </div>
  );
}
