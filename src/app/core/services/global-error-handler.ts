import { ErrorHandler, Injectable, inject } from '@angular/core';
import { dataError, isDataError, type DataError } from '../../data/model/data-error';
import { ToastService } from '../../ui/services/toast.service';

/** Maps a thrown error to `DataError`, logs it, and shows a non-blocking toast — never
 *  a white screen (core/SPEC.md). */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toastService = inject(ToastService);

  handleError(error: unknown): void {
    const normalised = toDataError(error);
    console.error(normalised.message, normalised.cause ?? error);
    this.toastService.show(normalised.message);
  }
}

export function toDataError(error: unknown): DataError {
  if (isDataError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return dataError('unknown', error.message, error);
  }
  return dataError('unknown', 'Something went wrong', error);
}
