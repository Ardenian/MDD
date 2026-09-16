import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import { type ComponentType } from '@angular/cdk/portal';
import { computed, inject, Service, signal } from '@angular/core';

export interface UiDialogConfig<D> {
  /** Inputs set on the opened component — it stays presentation-only, injecting nothing. */
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly data?: D;
  readonly ariaLabel?: string;
  /** Blocks Escape and backdrop dismissal, for a flow that must be answered. */
  readonly disableClose?: boolean;
}

export interface UiDialogHandle<C, R> {
  readonly component: C | null;
  readonly closed: Promise<R | undefined>;
  close(result?: R): void;
}

/**
 * Owns the one dialog stack, so two dialogs can never fight over focus. A second `open`
 * while one is up is refused rather than queued: every v1 dialog is a decision the user
 * has to answer before anything else happens.
 *
 * Focus trap on open and focus restore on close come from `cdk/dialog` itself — this
 * service does not re-implement them, it just guarantees there is only ever one.
 */
@Service()
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly current = signal<DialogRef<unknown, unknown> | null>(null);

  readonly isOpen = computed(() => this.current() !== null);

  open<C, R = unknown, D = unknown>(
    component: ComponentType<C>,
    config: UiDialogConfig<D> = {},
  ): UiDialogHandle<C, R> | null {
    if (this.current() !== null) {
      return null;
    }

    const dialogConfig: DialogConfig<D, DialogRef<R, C>> = {
      data: config.data ?? null,
      disableClose: config.disableClose ?? false,
      ariaLabel: config.ariaLabel,
      restoreFocus: true,
      autoFocus: 'first-tabbable',
    };
    const ref = this.dialog.open<R, D, C>(component, dialogConfig);

    for (const [name, value] of Object.entries(config.inputs ?? {})) {
      ref.componentRef?.setInput(name, value);
    }

    this.current.set(ref as DialogRef<unknown, unknown>);
    const closed = new Promise<R | undefined>((resolve) => {
      const subscription = ref.closed.subscribe((result) => {
        this.current.set(null);
        subscription.unsubscribe();
        resolve(result);
      });
    });

    return {
      component: ref.componentInstance,
      closed,
      close: (result?: R) => ref.close(result),
    };
  }

  close(): void {
    this.current()?.close(undefined);
  }
}
