export type DataErrorCode = 'not-found' | 'invalid-input' | 'conflict' | 'unknown';

/** The normalised shape every port/adapter throws; core/'s ErrorHandler expects this. */
export interface DataError {
  readonly code: DataErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export function dataError(code: DataErrorCode, message: string, cause?: unknown): DataError {
  return { code, message, cause };
}

export function isDataError(value: unknown): value is DataError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}
