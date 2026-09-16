import { type ErrorHandler, inject, Service } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../ui/services/toast.service';
import { errorMessageKey, toDataError } from './to-data-error';

/**
 * Never a white screen: every uncaught error becomes one non-blocking, announced
 * message. `core/` injecting a `ui/` service is the one sanctioned exception to ADR
 * 0002's top-level-component-only rule — this is the bootstrapping root, not
 * presentation.
 */
@Service()
export class AppErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  handleError(thrown: unknown): void {
    const error = toDataError(thrown);
    console.error(error);
    this.toasts.error(this.translate.instant(errorMessageKey(error)));
  }
}
