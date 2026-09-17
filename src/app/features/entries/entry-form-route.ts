import { afterNextRender, Component, DestroyRef, inject, Injector, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { DialogService, type UiDialogHandle } from '../../ui/services/dialog.service';
import { ToastService } from '../../ui/services/toast.service';
import { EntryFormDialog, type EntryFormOutcome } from './entry-form-dialog';

/**
 * Lives in the app shell's `modal` outlet, so any feature opens the Entry form by
 * navigating — `/calendar(modal:entry/new)?trackerId=…` — and never by importing this
 * feature, which `AGENTS.md` forbids. The primary route (the Calendar) stays rendered
 * underneath, and the URL makes an open form directly addressable.
 */
@Component({
  selector: 'app-entry-form-route',
  template: '',
})
export class EntryFormRoute {
  /** Route parameter: present when opening a saved Entry. */
  readonly entryId = input<string>();
  /** Query parameters for a new Entry. */
  readonly trackerId = input<string>();
  readonly presetId = input<string>();
  readonly at = input<string>();

  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private handle: UiDialogHandle<EntryFormDialog, EntryFormOutcome> | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => this.open());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.handle?.close();
    });
  }

  private open(): void {
    this.handle = this.dialogs.open<EntryFormDialog, EntryFormOutcome>(EntryFormDialog, {
      inputs: {
        request: {
          entryId: this.entryId(),
          trackerId: this.trackerId(),
          presetId: this.presetId(),
          at: this.at(),
        },
      },
      injector: this.injector,
    });
    if (this.handle === null) {
      void this.leave();
      return;
    }

    this.handle.component?.finished.subscribe((outcome) => {
      if (outcome !== 'cancelled') {
        this.toasts.show(
          this.translate.instant(
            outcome === 'saved' ? 'entries.form.saved' : 'entries.form.deleted',
          ),
        );
      }
      this.handle?.close(outcome);
    });
    void this.handle.closed.then(() => this.leave());
  }

  /** Closing the form closes the outlet, unless navigation already took it away. */
  private async leave(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    await this.router.navigate([{ outlets: { modal: null } }], {
      queryParams: { trackerId: null, presetId: null, at: null },
      queryParamsHandling: 'merge',
    });
  }
}
