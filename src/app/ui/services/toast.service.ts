import { LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Service, signal } from '@angular/core';

export type ToastTone = 'info' | 'error';

export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly tone: ToastTone;
}

/**
 * Owns the app's one live region. Announcements are chained rather than fired in
 * parallel, so a message raised while another is still being announced waits its turn
 * instead of overwriting it — which is what a bare `announce()` per message would do.
 * This is what `core/`'s `ErrorHandler` calls into.
 */
@Service()
export class ToastService {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly items = signal<readonly Toast[]>([]);
  private announcements: Promise<void> = Promise.resolve();
  private sequence = 0;

  readonly toasts = this.items.asReadonly();

  show(message: string, tone: ToastTone = 'info'): string {
    const id = `toast-${++this.sequence}`;
    this.items.update((toasts) => [...toasts, { id, message, tone }]);
    this.announcements = this.announcements.then(() =>
      this.announcer
        .announce(message, tone === 'error' ? 'assertive' : 'polite')
        .catch(() => undefined),
    );
    return id;
  }

  error(message: string): string {
    return this.show(message, 'error');
  }

  dismiss(id: string): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.items.set([]);
  }

  /** Resolves once every queued announcement has reached the live region. */
  async settled(): Promise<void> {
    await this.announcements;
  }
}
