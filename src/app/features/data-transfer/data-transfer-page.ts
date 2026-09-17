import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, Injector, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ExportBundle, RecordCounts } from '../../data/model/export-bundle';
import {
  ConfirmDialog,
  type ConfirmDetail,
} from '../../ui/components/confirm-dialog/confirm-dialog';
import { DialogService } from '../../ui/services/dialog.service';
import { ToastService } from '../../ui/services/toast.service';
import { DataTransferDataAccess } from './data-transfer-data-access';
import { exportFileName, type ImportProblem, parseBundle } from './import-bundle';

/**
 * The Data Transfer feature's top-level component — per ADR 0002 the only place in this
 * feature allowed to inject a facade or a `ui/` service. The chosen file and its
 * rejection, if any, are this page's own state.
 */
@Component({
  selector: 'app-data-transfer-page',
  imports: [TranslatePipe],
  template: `
    <section class="transfer" data-testid="data-transfer-page">
      <h1 data-testid="page-title">{{ 'app.nav.dataTransfer' | translate }}</h1>

      <section class="transfer__section" data-testid="export-section">
        <h2>{{ 'dataTransfer.export.heading' | translate }}</h2>
        <p>{{ 'dataTransfer.export.body' | translate }}</p>
        <button type="button" data-testid="export-data" (click)="exportAll()">
          {{ 'dataTransfer.export.action' | translate }}
        </button>
      </section>

      <section class="transfer__section transfer__section--danger" data-testid="import-section">
        <h2>{{ 'dataTransfer.import.heading' | translate }}</h2>
        <p>{{ 'dataTransfer.import.body' | translate }}</p>

        <label class="transfer__field">
          <span>{{ 'dataTransfer.import.choose' | translate }}</span>
          <input
            type="file"
            accept="application/json,.json"
            data-testid="import-file"
            [attr.aria-invalid]="problem() !== null"
            [attr.aria-describedby]="problem() === null ? null : errorId"
            (change)="chooseFile($event)"
          />
        </label>

        @if (problem() !== null) {
          <p class="transfer__error" role="alert" [id]="errorId" data-testid="import-error">
            {{ 'dataTransfer.problems.' + problem() | translate: { version: foundVersion() } }}
          </p>
        }

        @if (selected() !== null) {
          <p class="transfer__selected" data-testid="selected-file">{{ selected()?.name }}</p>
        }

        <button
          type="button"
          data-testid="start-import"
          [disabled]="selected() === null"
          (click)="confirmImport()"
        >
          {{ 'dataTransfer.import.action' | translate }}
        </button>
      </section>
    </section>
  `,
  styles: `
    .transfer {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      max-width: 48rem;
    }

    .transfer__section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .transfer__section--danger {
      border-color: var(--color-danger);
    }

    .transfer__section h2 {
      margin: 0;
      font-size: var(--text-md);
    }

    .transfer__section p {
      margin: 0;
    }

    .transfer__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .transfer__selected {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .transfer__error {
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class DataTransferPage {
  private readonly access = inject(DataTransferDataAccess);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly errorId = 'import-error';

  private readonly accepted = signal<{ name: string; bundle: ExportBundle } | null>(null);
  private readonly rejected = signal<{ problem: ImportProblem; version?: number } | null>(null);

  protected readonly selected = computed(() => this.accepted());
  protected readonly problem = computed(() => this.rejected()?.problem ?? null);
  protected readonly foundVersion = computed(() => this.rejected()?.version ?? null);

  protected async exportAll(): Promise<void> {
    const bundle = await this.access.exportAll();
    this.download(exportFileName(bundle.exportedAt), JSON.stringify(bundle, null, 2));
    this.toasts.show(this.translate.instant('dataTransfer.export.done'));
  }

  /**
   * A file the app cannot use is refused here, at selection time, so the confirmation
   * step is never reached with a bundle that would fail (ADR 0009).
   */
  protected async chooseFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.accepted.set(null);
    this.rejected.set(null);
    if (file === undefined) {
      return;
    }

    const result = parseBundle(await file.text());
    if (!result.ok) {
      this.rejected.set({ problem: result.problem, version: result.foundVersion });
      return;
    }
    this.accepted.set({ name: file.name, bundle: result.bundle });
    // Narrow the window in which the confirmation could quote counts from before.
    this.access.reloadCounts();
  }

  protected confirmImport(): void {
    const chosen = this.accepted();
    if (chosen === null) {
      return;
    }

    const title = this.translate.instant('dataTransfer.import.confirm.title');
    const phrase = this.translate.instant('dataTransfer.import.confirm.phrase');
    const handle = this.dialogs.open<ConfirmDialog, void>(ConfirmDialog, {
      inputs: {
        title,
        body: this.translate.instant('dataTransfer.import.confirm.body'),
        phrase,
        prompt: this.translate.instant('dataTransfer.import.confirm.prompt', { phrase }),
        confirmLabel: this.translate.instant('dataTransfer.import.confirm.submit'),
        cancelLabel: this.translate.instant('dataTransfer.import.confirm.cancel'),
        details: this.countDetails(this.access.recordCounts()),
      },
      ariaLabel: title,
      injector: this.injector,
    });
    if (handle === null) {
      return;
    }

    handle.component?.cancelled.subscribe(() => handle.close());
    handle.component?.confirmed.subscribe(() => {
      void this.access.importAll(chosen.bundle).then(() => {
        handle.close();
        this.toasts.show(this.translate.instant('dataTransfer.import.done'));
        // The whole dataset was replaced, so every cached read in the running app now
        // describes records that are gone. A fresh start is the honest next step.
        this.document.defaultView?.location.reload();
      });
    });
  }

  /** What the import is about to discard, one row per aggregate. */
  private countDetails(counts: RecordCounts | null): readonly ConfirmDetail[] {
    if (counts === null) {
      return [];
    }
    return (Object.keys(counts) as (keyof RecordCounts)[]).map((key) => ({
      key,
      label: this.translate.instant(`dataTransfer.counts.${key}`),
      value: String(counts[key]),
    }));
  }

  private download(fileName: string, contents: string): void {
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    const url = view.URL.createObjectURL(new view.Blob([contents], { type: 'application/json' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    view.URL.revokeObjectURL(url);
  }
}
