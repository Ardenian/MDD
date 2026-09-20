import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, Injector, linkedSignal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { RecordCounts } from '../../data/model/export-bundle';
import type { BucketSize } from '../../data/model/settings';
import { STORAGE_PROFILES } from '../../core/storage-profile';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';
import type { ConfirmDetail } from '../../ui/components/confirm-dialog/confirm-dialog';
import { DialogService } from '../../ui/services/dialog.service';
import { ToastService } from '../../ui/services/toast.service';
import { CorrelationDefaultsEditor } from './correlation-defaults-editor';
import { SettingsDataAccess } from './settings-data-access';
import { draftFrom, patchFrom, problemFor, validateSettings } from './settings-form';

const BUCKET_SIZES: readonly BucketSize[] = ['hour', 'day', 'week', 'month'];

/**
 * The Settings feature's top-level component — per ADR 0002 the only place in this
 * feature allowed to inject a facade or a `ui/` service. The unsaved form is its own
 * state; `SettingsDataAccess` holds only what is persisted.
 */
@Component({
  selector: 'app-settings-page',
  providers: [SettingsDataAccess],
  imports: [TranslatePipe, Select, CorrelationDefaultsEditor],
  template: `
    <!--
      The persisted values are reflected as attributes so a test can wait for a save to
      reach storage before navigating away, rather than racing it.
    -->
    <section
      class="settings"
      data-testid="settings-page"
      [attr.data-saved-cap]="access.saved()?.expansionDepthCap ?? null"
      [attr.data-saved-bucket-size]="access.saved()?.defaultBucketSize ?? null"
    >
      <h1 data-testid="page-title">{{ 'app.nav.settings' | translate }}</h1>

      <form class="settings__form" (submit)="save($event)">
        <app-correlation-defaults-editor
          [(draft)]="draft"
          [problems]="problems()"
          [bucketLabels]="bucketLabels()"
        />

        <fieldset class="settings__section" data-testid="schema-settings">
          <legend>{{ 'settings.schema.heading' | translate }}</legend>
          <label class="settings__field">
            <span>{{ 'settings.schema.expansionDepthCap' | translate }}</span>
            <input
              type="number"
              step="1"
              min="1"
              data-testid="expansion-depth-cap"
              [value]="draft().expansionDepthCap"
              [attr.aria-invalid]="capProblem() !== null"
              [attr.aria-describedby]="capProblem() !== null ? capErrorId : null"
              (input)="setCap($any($event.target).value)"
            />
          </label>
          <p class="settings__hint">{{ 'settings.schema.expansionDepthHint' | translate }}</p>
          @if (capProblem() !== null) {
            <p class="settings__error" [id]="capErrorId" data-testid="expansion-depth-cap-error">
              {{ 'settings.problems.' + capProblem() | translate }}
            </p>
          }
        </fieldset>

        <fieldset class="settings__section" data-testid="storage-profile">
          <legend>{{ 'settings.storageProfile.heading' | translate }}</legend>
          <ui-select
            [label]="'settings.storageProfile.label' | translate"
            [options]="profileOptions()"
            [clearable]="false"
            [value]="draft().activeProfileId"
            (valueChange)="setProfile($event)"
          />
          <p class="settings__hint">{{ 'settings.storageProfile.hint' | translate }}</p>
        </fieldset>

        <div class="settings__actions">
          <button type="submit" data-testid="save-settings" [disabled]="problems().length > 0">
            {{ 'settings.save' | translate }}
          </button>
          @if (problems().length > 0) {
            <p class="settings__error" data-testid="settings-blocked">
              {{ 'settings.blocked' | translate }}
            </p>
          }
        </div>
      </form>

      <section class="settings__section settings__section--danger" data-testid="data-settings">
        <h2>{{ 'settings.data.heading' | translate }}</h2>
        <p>{{ 'settings.data.body' | translate }}</p>
        <button type="button" data-testid="clear-local-data" (click)="confirmClear()">
          {{ 'settings.data.clear' | translate }}
        </button>
      </section>
    </section>
  `,
  styles: `
    .settings {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      max-width: 48rem;
    }

    .settings__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .settings__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .settings__section--danger {
      border-color: var(--color-danger);
    }

    .settings__section h2 {
      margin: 0;
      font-size: var(--text-md);
    }

    .settings__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-items: flex-start;
    }

    .settings__hint {
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .settings__error {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }

    .settings__actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
  `,
})
export class SettingsPage {
  protected readonly access = inject(SettingsDataAccess);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Re-seeds itself whenever the persisted settings change, keeping unsaved edits until then. */
  protected readonly draft = linkedSignal(() => draftFrom(this.access.saved()));

  protected readonly problems = computed(() => validateSettings(this.draft()));
  protected readonly capProblem = computed(() => problemFor(this.problems(), 'expansionDepthCap'));

  protected readonly capErrorId = 'expansion-depth-cap-error';

  protected readonly bucketLabels = computed<Readonly<Record<BucketSize, string>>>(
    () =>
      Object.fromEntries(
        BUCKET_SIZES.map((size) => [
          size,
          this.translate.instant(`settings.correlation.bucket.${size}`),
        ]),
      ) as Record<BucketSize, string>,
  );

  /** v1 ships exactly one Profile; the control exists so the seam is visible (ADR 0009). */
  protected readonly profileOptions = computed<readonly SelectOption[]>(() =>
    STORAGE_PROFILES.map((profile) => ({
      value: profile.id,
      label: this.translate.instant(profile.labelKey),
    })),
  );

  protected setCap(raw: string): void {
    const value = raw.trim() === '' ? Number.NaN : Number(raw);
    this.draft.update((draft) => ({ ...draft, expansionDepthCap: value }));
  }

  protected setProfile(value: string | null): void {
    if (value === null) {
      return;
    }
    this.draft.update((draft) => ({ ...draft, activeProfileId: value }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (this.problems().length > 0) {
      return;
    }
    const profileChanged = this.draft().activeProfileId !== this.access.saved()?.activeProfileId;
    void this.access.save(patchFrom(this.draft())).then(() => {
      this.toasts.show(this.translate.instant('settings.saved'));
      if (profileChanged) {
        // The Profile decides which adapter set is bound at bootstrap, so switching it
        // only takes effect on a fresh start (ADR 0009).
        this.reload();
      }
    });
  }

  protected async confirmClear(): Promise<void> {
    const phrase = this.translate.instant('settings.data.confirm.phrase');
    const confirmed = await this.dialogs.confirm({
      title: this.translate.instant('settings.data.confirm.title'),
      body: this.translate.instant('settings.data.confirm.body'),
      phrase,
      prompt: this.translate.instant('settings.data.confirm.prompt', { phrase }),
      confirmLabel: this.translate.instant('settings.data.confirm.submit'),
      cancelLabel: this.translate.instant('settings.data.confirm.cancel'),
      details: this.countDetails(await this.access.counts()),
      injector: this.injector,
    });
    if (!confirmed) {
      return;
    }

    await this.access.clearAll();
    this.toasts.show(this.translate.instant('settings.data.cleared'));
    // Every cached read in the app — Tracker lookups included — now describes data that
    // no longer exists, so the honest next step is a fresh start.
    this.reload();
  }

  /** What the confirmation shows is about to be lost, one row per aggregate. */
  private countDetails(counts: RecordCounts): readonly ConfirmDetail[] {
    return (Object.keys(counts) as (keyof RecordCounts)[]).map((key) => ({
      key,
      label: this.translate.instant(`settings.data.counts.${key}`),
      value: String(counts[key]),
    }));
  }

  private reload(): void {
    this.document.defaultView?.location.reload();
  }
}
