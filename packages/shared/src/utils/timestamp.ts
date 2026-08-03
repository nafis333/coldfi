import type { ISO8601String } from '../types/api';

export function nowISO(): ISO8601String {
  return new Date().toISOString() as ISO8601String;
}

export function dateToISO(date: Date): ISO8601String {
  return date.toISOString() as ISO8601String;
}

export function isISODateString(value: string): value is ISO8601String {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value);
}

export function apiTimestamp(): { timestamp: ISO8601String } {
  return { timestamp: nowISO() };
}

export function createSuccessResponse<T>(
  data: T
): { success: true; data: T; timestamp: ISO8601String } {
  return { success: true, data, ...apiTimestamp() };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): { success: false; error: { code: string; message: string; details?: Record<string, unknown> }; timestamp: ISO8601String } {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...apiTimestamp(),
  };
}
