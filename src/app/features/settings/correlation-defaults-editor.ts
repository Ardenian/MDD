import { Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { BucketSize } from '../../data/model/settings';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';
import {
  problemFor,
  type SettingsField,
  type SettingsDraft,
  type SettingsProblem,
  type SettingsProblemCode,
} from './settings-form';

let nextId = 0;

const BUCKET_SIZES: readonly BucketSize[] = ['hour', 'day', 'week', 'month'];

/**
 * The Correlation defaults section. Presentation-only: it injects nothing and writes
 * back through `model()` rather than deriving its next state from an `input()`, which
 * would go stale the moment the page re-renders from a different source.
 */
@Component({
  selector: 'app-correlation-defaults-editor',
  imports: [TranslatePipe, Select],
  template: `
    <fieldset class="defaults" data-testid="correlation-defaults">
      <legend>{{ 'settings.correlation.heading' | translate }}</legend>

      <ui-select
        data-testid="bucket-size"
        [label]="'settings.correlation.bucketSize' | translate"
        [options]="bucketOptions()"
        [clearable]="false"
        [value]="draft().defaultBucketSize"
        (valueChange)="setBucketSize($event)"
      />

      <div
        class="defaults__row"
        role="group"
        [attr.aria-label]="'settings.correlation.lagRange' | translate"
      >
        <label class="defaults__field">
          <span>{{ 'settings.correlation.lagMin' | translate }}</span>
          <input
            type="number"
            step="1"
            data-testid="lag-min"
            [value]="draft().defaultLagRange.min"
            [attr.aria-invalid]="problem('lagMin') !== null || problem('lagRange') !== null"
            [attr.aria-describedby]="problem('lagMin') !== null ? lagMinErrorId : null"
            (input)="setLagMin($any($event.target).value)"
          />
        </label>
        <label class="defaults__field">
          <span>{{ 'settings.correlation.lagMax' | translate }}</span>
          <input
            type="number"
            step="1"
            data-testid="lag-max"
            [value]="draft().defaultLagRange.max"
            [attr.aria-invalid]="problem('lagMax') !== null || problem('lagRange') !== null"
            [attr.aria-describedby]="problem('lagMax') !== null ? lagMaxErrorId : null"
            (input)="setLagMax($any($event.target).value)"
          />
        </label>
      </div>

      @if (problem('lagMin') !== null) {
        <p class="defaults__error" [id]="lagMinErrorId" data-testid="lag-min-error">
          {{ 'settings.problems.' + problem('lagMin') | translate }}
        </p>
      }
      @if (problem('lagMax') !== null) {
        <p class="defaults__error" [id]="lagMaxErrorId" data-testid="lag-max-error">
          {{ 'settings.problems.' + problem('lagMax') | translate }}
        </p>
      }
      @if (problem('lagRange') !== null) {
        <p class="defaults__error" data-testid="lag-range-error">
          {{ 'settings.problems.range-inverted' | translate }}
        </p>
      }

      <div class="defaults__row">
        <label class="defaults__field">
          <span>{{ 'settings.correlation.minSampleSize' | translate }}</span>
          <input
            type="number"
            step="1"
            min="1"
            data-testid="min-sample-size"
            [value]="draft().guardrails.minSampleSize"
            [attr.aria-invalid]="problem('minSampleSize') !== null"
            [attr.aria-describedby]="problem('minSampleSize') !== null ? sampleErrorId : null"
            (input)="setGuardrail('minSampleSize', $any($event.target).value)"
          />
        </label>
        <label class="defaults__field">
          <span>{{ 'settings.correlation.pThreshold' | translate }}</span>
          <input
            type="number"
            step="0.001"
            min="0"
            max="1"
            data-testid="p-threshold"
            [value]="draft().guardrails.pThreshold"
            [attr.aria-invalid]="problem('pThreshold') !== null"
            [attr.aria-describedby]="problem('pThreshold') !== null ? pErrorId : null"
            (input)="setGuardrail('pThreshold', $any($event.target).value)"
          />
        </label>
      </div>

      @if (problem('minSampleSize') !== null) {
        <p class="defaults__error" [id]="sampleErrorId" data-testid="min-sample-size-error">
          {{ 'settings.problems.' + problem('minSampleSize') | translate }}
        </p>
      }
      @if (problem('pThreshold') !== null) {
        <p class="defaults__error" [id]="pErrorId" data-testid="p-threshold-error">
          {{ 'settings.problems.' + problem('pThreshold') | translate }}
        </p>
      }

      <label class="defaults__toggle">
        <input
          type="checkbox"
          data-testid="benjamini-hochberg"
          [checked]="draft().guardrails.benjaminiHochberg"
          (change)="setCorrection($any($event.target).checked)"
        />
        <span>{{ 'settings.correlation.benjaminiHochberg' | translate }}</span>
      </label>
    </fieldset>
  `,
  styles: `
    .defaults {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0;
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .defaults__row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .defaults__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .defaults__toggle {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .defaults__error {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class CorrelationDefaultsEditor {
  readonly draft = model.required<SettingsDraft>();
  readonly problems = input<readonly SettingsProblem[]>([]);
  /** Supplied translated by the page: this component injects nothing, `TranslateService` included. */
  readonly bucketLabels = input.required<Readonly<Record<BucketSize, string>>>();

  protected readonly lagMinErrorId = `lag-min-error-${++nextId}`;
  protected readonly lagMaxErrorId = `lag-max-error-${nextId}`;
  protected readonly sampleErrorId = `min-sample-error-${nextId}`;
  protected readonly pErrorId = `p-threshold-error-${nextId}`;

  /** Bucket sizes are a fixed enum, so their labels are keyed, not free text. */
  protected readonly bucketOptions = computed<readonly SelectOption[]>(() =>
    BUCKET_SIZES.map((size) => ({ value: size, label: this.bucketLabels()[size] })),
  );

  protected problem(field: SettingsField): SettingsProblemCode | null {
    return problemFor(this.problems(), field);
  }

  protected setBucketSize(value: string | null): void {
    if (value === null) {
      return;
    }
    this.draft.update((draft) => ({ ...draft, defaultBucketSize: value as BucketSize }));
  }

  protected setLagMin(raw: string): void {
    this.draft.update((draft) => ({
      ...draft,
      defaultLagRange: { ...draft.defaultLagRange, min: toNumber(raw) },
    }));
  }

  protected setLagMax(raw: string): void {
    this.draft.update((draft) => ({
      ...draft,
      defaultLagRange: { ...draft.defaultLagRange, max: toNumber(raw) },
    }));
  }

  protected setGuardrail(key: 'minSampleSize' | 'pThreshold', raw: string): void {
    this.draft.update((draft) => ({
      ...draft,
      guardrails: { ...draft.guardrails, [key]: toNumber(raw) },
    }));
  }

  protected setCorrection(checked: boolean): void {
    this.draft.update((draft) => ({
      ...draft,
      guardrails: { ...draft.guardrails, benjaminiHochberg: checked },
    }));
  }
}

/** A cleared number input reads as `''`; NaN is what the validator reports on. */
function toNumber(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}
