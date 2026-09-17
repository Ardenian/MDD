export type DataErrorCode = 'not-found' | 'invalid' | 'conflict' | 'unsupported' | 'unavailable';

/** The normalised error shape every port raises; adapters never leak storage errors. */
export class DataError extends Error {
  constructor(
    readonly code: DataErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DataError';
  }
}

export function isDataError(value: unknown): value is DataError {
  return value instanceof DataError;
}
