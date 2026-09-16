import { DataError, isDataError } from '../../data/model/data-error';

/**
 * Normalises anything thrown into the small `DataError` type features are allowed to
 * see, so an adapter's storage-specific failure never reaches presentation code raw.
 */
export function toDataError(thrown: unknown): DataError {
  if (isDataError(thrown)) {
    return thrown;
  }
  if (thrown instanceof Error) {
    return new DataError('unavailable', thrown.message, { cause: thrown });
  }
  return new DataError('unavailable', String(thrown), { cause: thrown });
}

export function errorMessageKey(error: DataError): string {
  return `errors.${error.code}`;
}
