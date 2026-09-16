import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  type FieldDataType,
  type FieldDef,
  isReferenceField,
  isSelectField,
  type ReferenceCardinality,
} from '../../data/model/field-def';
import type { TrackerSummary } from '../../data/facades/tracker-lookup';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';

const DATA_TYPES: readonly FieldDataType[] = [
  'text',
  'longText',
  'integer',
  'decimal',
  'boolean',
  'singleSelect',
  'multiSelect',
  'reference',
];

/**
 * One Draft Field row. Presentation-only: it injects nothing and emits the edited Field
 * upward, so the designer page stays the single place that talks to a facade (ADR 0002).
 */
@Component({
  selector: 'app-draft-field-row',
  imports: [TranslatePipe, Select],
  template: `
    <div class="field-row">
      <label class="field-row__name">
        <span>{{ 'trackers.field.name' | translate }}</span>
        <input
          type="text"
          data-testid="field-name"
          [value]="field().name"
          (change)="renameFrom($event)"
        />
      </label>

      <ui-select
        data-testid="field-type"
        [label]="'trackers.field.dataType' | translate"
        [options]="dataTypeOptions()"
        [value]="field().dataType"
        (valueChange)="changeDataType($event)"
      />

      <label class="field-row__required">
        <input
          type="checkbox"
          data-testid="field-required"
          [checked]="field().required"
          (change)="toggleRequired($event)"
        />
        <span>{{ 'trackers.field.required' | translate }}</span>
      </label>

      @if (selectField(); as select) {
        <fieldset class="field-row__options" data-testid="field-options">
          <legend>{{ 'trackers.field.options' | translate }}</legend>
          @for (option of select.options; track $index) {
            <span class="field-row__option">
              <input
                type="text"
                [attr.data-testid]="'option-' + $index"
                [value]="option"
                [attr.aria-label]="'trackers.field.optionPlaceholder' | translate"
                (change)="renameOption($index, $event)"
              />
              <button
                type="button"
                [attr.data-testid]="'remove-option-' + $index"
                [attr.aria-label]="'trackers.field.removeOption' | translate"
                (click)="removeOption($index)"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </span>
          }
          <button type="button" data-testid="add-option" (click)="addOption()">
            {{ 'trackers.field.addOption' | translate }}
          </button>
        </fieldset>
      }

      @if (referenceField(); as reference) {
        <div class="field-row__reference" data-testid="field-reference">
          <ui-select
            data-testid="reference-target"
            [label]="'trackers.field.referenceTarget' | translate"
            [options]="targetOptions()"
            [value]="reference.targetTrackerId === '' ? null : reference.targetTrackerId"
            (valueChange)="changeTarget($event)"
          />
          <ui-select
            data-testid="reference-cardinality"
            [label]="'trackers.field.cardinality' | translate"
            [options]="cardinalityOptions()"
            [value]="reference.cardinality"
            (valueChange)="changeCardinality($event)"
          />
        </div>
      }

      <button
        type="button"
        class="field-row__remove"
        data-testid="remove-field"
        [attr.aria-label]="'trackers.field.remove' | translate"
        (click)="removed.emit()"
      >
        {{ 'trackers.field.remove' | translate }}
      </button>
    </div>
  `,
  styles: `
    .field-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-4);
    }

    .field-row label {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .field-row input[type='text'] {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .field-row__required {
      flex-direction: row !important;
      align-items: center;
      padding-top: var(--space-6);
    }

    .field-row__options {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3);
    }

    .field-row__option {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .field-row__reference {
      display: flex;
      gap: var(--space-4);
    }

    .field-row__remove {
      margin-inline-start: auto;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-danger);
      cursor: pointer;
    }
  `,
})
export class DraftFieldRow {
  readonly field = input.required<FieldDef>();
  readonly trackers = input.required<readonly TrackerSummary[]>();
  readonly dataTypeLabels = input.required<Readonly<Record<FieldDataType, string>>>();
  readonly cardinalityLabels = input.required<Readonly<Record<ReferenceCardinality, string>>>();

  readonly changed = output<FieldDef>();
  readonly removed = output<void>();

  protected readonly selectField = computed(() => {
    const current = this.field();
    return isSelectField(current) ? current : null;
  });

  protected readonly referenceField = computed(() => {
    const current = this.field();
    return isReferenceField(current) ? current : null;
  });

  protected readonly dataTypeOptions = computed<readonly SelectOption[]>(() =>
    DATA_TYPES.map((value) => ({ value, label: this.dataTypeLabels()[value] })),
  );

  /** An Archived Tracker is never offered as a new reference target (ADR 0005). */
  protected readonly targetOptions = computed<readonly SelectOption[]>(() =>
    this.trackers()
      .filter((tracker) => !tracker.archived)
      .map((tracker) => ({ value: tracker.id, label: tracker.name })),
  );

  protected readonly cardinalityOptions = computed<readonly SelectOption[]>(() => [
    { value: 'one', label: this.cardinalityLabels().one },
    { value: 'many', label: this.cardinalityLabels().many },
  ]);

  protected renameFrom(event: Event): void {
    this.changed.emit({ ...this.field(), name: (event.target as HTMLInputElement).value });
  }

  protected toggleRequired(event: Event): void {
    this.changed.emit({ ...this.field(), required: (event.target as HTMLInputElement).checked });
  }

  protected changeDataType(dataType: string | null): void {
    if (dataType === null) {
      return;
    }
    this.changed.emit(withDataType(this.field(), dataType as FieldDataType));
  }

  protected addOption(): void {
    const select = this.selectField();
    if (select !== null) {
      this.changed.emit({ ...select, options: [...select.options, ''] });
    }
  }

  protected renameOption(index: number, event: Event): void {
    const select = this.selectField();
    if (select === null) {
      return;
    }
    const options = [...select.options];
    options[index] = (event.target as HTMLInputElement).value;
    this.changed.emit({ ...select, options });
  }

  protected removeOption(index: number): void {
    const select = this.selectField();
    if (select !== null) {
      this.changed.emit({
        ...select,
        options: select.options.filter((_, position) => position !== index),
      });
    }
  }

  protected changeTarget(targetTrackerId: string | null): void {
    const reference = this.referenceField();
    if (reference !== null && targetTrackerId !== null) {
      this.changed.emit({ ...reference, targetTrackerId });
    }
  }

  protected changeCardinality(cardinality: string | null): void {
    const reference = this.referenceField();
    if (reference !== null && cardinality !== null) {
      this.changed.emit({ ...reference, cardinality: cardinality as ReferenceCardinality });
    }
  }
}

/** Changing the data type changes the Field's shape, so the extras are re-seeded. */
export function withDataType(field: FieldDef, dataType: FieldDataType): FieldDef {
  const base = { name: field.name, required: field.required };
  switch (dataType) {
    case 'singleSelect':
    case 'multiSelect':
      return { ...base, dataType, options: isSelectField(field) ? field.options : [] };
    case 'reference':
      return {
        ...base,
        dataType,
        targetTrackerId: isReferenceField(field) ? field.targetTrackerId : '',
        cardinality: isReferenceField(field) ? field.cardinality : 'one',
      };
    default:
      return { ...base, dataType };
  }
}
