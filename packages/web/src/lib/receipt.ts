const MAX_FILE_SIZE = 2.5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export interface ReceiptFile {
  name: string;
  type: string;
  size: number;
  base64: string;
  preview: string;
}

export interface ReceiptValidationError {
  code: 'TOO_LARGE' | 'WRONG_TYPE' | 'READ_ERROR';
  message: string;
}

export function validateReceiptFile(file: File): ReceiptValidationError | null {
  if (file.size > MAX_FILE_SIZE) {
    return {
      code: 'TOO_LARGE',
      message: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 2.5MB.`,
    };
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      code: 'WRONG_TYPE',
      message: `Unsupported file type "${file.type}". Accepted: JPEG, PNG, WebP, PDF.`,
    };
  }

  return null;
}

export function readReceiptFile(file: File): Promise<ReceiptFile> {
  return new Promise((resolve, reject) => {
    const error = validateReceiptFile(file);
    if (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: result,
        preview: result,
      });
    };
    reader.onerror = () => {
      reject({
        code: 'READ_ERROR',
        message: 'Failed to read file',
      } as ReceiptValidationError);
    };
    reader.readAsDataURL(file);
  });
}
