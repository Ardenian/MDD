import { Service, inject } from '@angular/core';
import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import type { ComponentType } from '@angular/cdk/portal';

export interface DialogOpenConfig<D> {
  readonly data?: D;
  /** Forwarded to `cdk/dialog` — disables both Escape-to-close and backdrop-click-to-close. */
  readonly disableClose?: boolean;
  readonly ariaLabel?: string;
}

export interface DialogHandle<R> {
  /** Resolves with the result passed to `close()`, or `undefined` if dismissed. */
  readonly closed: Promise<R | undefined>;
  close(result?: R): void;
}

/**
 * Owns the one dialog stack (`ui/SPEC.md`) — opening a second dialog while one is open
 * is rejected, never queued or stacked.
 *
 * Deliberately **not** built on `OverlayService`, despite `ui/SPEC.md`'s wording:
 * `cdk/dialog`'s `Dialog` service creates and manages its own `Overlay` internally
 * (confirmed from source) — it isn't something a caller composes with a separate
 * `Overlay` instance, so there's no seam to layer `OverlayService` underneath. Using
 * `Dialog` directly also means focus-trap-on-open and focus-restore-on-close are fully
 * automatic (`autoFocus: 'first-tabbable'`, `restoreFocus: true` by default) rather than
 * hand-rolled — exactly the kind of accessibility-critical behavior worth not
 * reimplementing. Practical coordination with `OverlayService`'s popovers (e.g. don't
 * open a quick-create popover while a dialog is open) goes through `isOpen`, not a
 * shared `OverlayRef`.
 */
@Service()
export class DialogService {
  private readonly dialog = inject(Dialog);
  private openRef: DialogRef<unknown, unknown> | null = null;

  get isOpen(): boolean {
    return this.openRef !== null;
  }

  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogOpenConfig<D>,
  ): DialogHandle<R> {
    if (this.openRef) {
      throw new Error('A dialog is already open — DialogService allows only one at a time.');
    }

    const ref = this.dialog.open<R, D, C>(component, {
      data: config?.data,
      disableClose: config?.disableClose ?? false,
      ariaLabel: config?.ariaLabel,
      ariaModal: true,
    });
    this.openRef = ref as unknown as DialogRef<unknown, unknown>;

    const closed = firstValueFrom(ref.closed).finally(() => {
      if ((this.openRef as unknown) === ref) {
        this.openRef = null;
      }
    });

    return { closed, close: (result?: R) => ref.close(result) };
  }
}
