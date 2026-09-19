import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import { type ComponentType } from '@angular/cdk/portal';
import { computed, inject, type Injector, Service, signal } from '@angular/core';
import { ConfirmDialog, type ConfirmDetail } from '../components/confirm-dialog/confirm-dialog';

export interface UiDialogConfig<D> {
  /** Inputs set on the opened component — it stays presentation-only, injecting nothing. */
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly data?: D;
  readonly ariaLabel?: string;
  /** Blocks Escape and backdrop dismissal, for a flow that must be answered. */
  readonly disableClose?: boolean;
  /**
   * The opener's injector. Without it the component resolves from the root, which cannot
   * see anything a lazy route provides — a feature's own translations, for one.
   */
  readonly injector?: Injector;
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
      injector: config.injector,
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

  /**
   * Puts the standard confirm-by-typing guard on screen and resolves to what the user
   * decided. Every string arrives translated, as `ConfirmDialog` itself requires.
   *
   * The choreography — open, listen to both outcomes, close either way — is identical
   * wherever an irreversible action is confirmed, so it lives here rather than being
   * rebuilt per feature (`ui/SPEC.md`).
   */
  async confirm(request: ConfirmRequest): Promise<boolean> {
    const handle = this.open<ConfirmDialog, void>(ConfirmDialog, {
      inputs: {
        title: request.title,
        body: request.body,
        phrase: request.phrase,
        prompt: request.prompt,
        confirmLabel: request.confirmLabel,
        cancelLabel: request.cancelLabel,
        details: request.details ?? [],
      },
      ariaLabel: request.title,
      injector: request.injector,
    });
    if (handle === null) {
      // Another dialog is already up; refusing is what `open` does, and a confirmation
      // nobody saw must not read as a yes.
      return false;
    }

    return new Promise<boolean>((resolve) => {
      handle.component?.cancelled.subscribe(() => handle.close());
      // Closed on the way out, so the caller gets a decision rather than a dialog to
      // dispose of, and the work it then does is not hidden behind one.
      handle.component?.confirmed.subscribe(() => {
        handle.close();
        resolve(true);
      });
      // A dismissal — Escape, the backdrop, the close button — is a no.
      void handle.closed.then(() => resolve(false));
    });
  }

  close(): void {
    this.current()?.close(undefined);
  }
}

export interface ConfirmRequest {
  readonly title: string;
  readonly body: string;
  /** The word to type out, and the sentence asking for it. */
  readonly phrase: string;
  readonly prompt: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /** What the action will cost, one row each. */
  readonly details?: readonly ConfirmDetail[];
  readonly injector?: Injector;
}
