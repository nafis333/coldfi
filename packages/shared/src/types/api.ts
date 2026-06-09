/** ISO 8601 date-time string (e.g. "2024-01-15T10:30:00.000Z") */
export type ISO8601String = string;

export interface ApiResponse<T> {
  success: true;
  data: T;
  /** ISO 8601 */
  timestamp: ISO8601String;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** ISO 8601 */
  timestamp: ISO8601String;
}

export interface SyncRequest {
  encryptedBlob: string;
  vectorClock: number | Record<string, number>;
}

export interface SyncResponse {
  encryptedBlob: string;
  vectorClock: number | Record<string, number>;
  updatedAt: string;
}

export interface SyncConflict {
  clientClock: number | Record<string, number>;
  serverClock: number | Record<string, number>;
  resolution: 'server_wins' | 'client_wins' | 'manual';
}
