import { Service, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

export interface ToastMessage {
  readonly text: string;
  readonly politeness?: 'polite' | 'assertive';
}

/**
 * Owns the app's one live region (`ui/SPEC.md`). Messages queue and announce in order —
 * a message is never dropped because one is already being announced. v1 scope: only
 * `core/`'s `GlobalErrorHandler` and the root shell's route-change announcement call
 * into this; the rest of `ui/` (Overlay, Dialog, Focus, components) is not built yet.
 */
@Service()
export class ToastService {
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private queue: Promise<void> = Promise.resolve();

  show(message: ToastMessage | string): void {
    const toast = typeof message === 'string' ? { text: message } : message;
    this.queue = this.queue.then(() =>
      this.liveAnnouncer.announce(toast.text, toast.politeness ?? 'polite').then(() => undefined),
    );
  }
}
