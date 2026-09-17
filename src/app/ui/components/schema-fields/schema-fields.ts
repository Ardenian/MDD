import { Component, computed, input, model } from '@angular/core';
import {
  type FieldDef,
  isReferenceField,
  type SelectFieldDef,
} from '../../../data/model/field-def';
import type { FieldValue, FieldValues } from '../../../data/model/field-values';
import { Multiselect } from '../multiselect/multiselect';
import { Select } from '../select/select';
import type { SelectOption } from '../select/select-option';

export interface SchemaFieldsLabels {
  readonly required: string;
  readonly clear: string;
}

/**
 * One control per scalar Field of a Tracker Version, bound to a values map. DI-free, so
 * both the Entry form and the Preset editor render it against their own feature's data.
 * Reference Fields are skipped: their value is child Entries, which the consumer renders.
 */
@Component({
  selector: 'ui-schema-fields',
  imports: [Select, Multiselect],
  template: `
    <div class="schema-fields">
      @for (field of scalarFields(); track field.name) {
        @let id = idPrefix() + '-' + $index;
        @let problem = problems()[field.name];
        @let errorId = problem === undefined ? null : id + '-error';

        <div
          class="schema-field"
          [class.schema-field--invalid]="problem !== undefined"
          [attr.data-testid]="field.name"
        >
          @switch (field.dataType) {
            @case ('boolean') {
              <label class="schema-field__check">
                <input
                  type="checkbox"
                  data-testid="control"
                  [id]="id"
                  [checked]="values()[field.name] === true"
                  [attr.aria-describedby]="errorId"
                  (change)="set(field.name, $any($event.target).checked)"
                />
                <span>{{ field.name }}</span>
              </label>
            }
            @case ('singleSelect') {
              <ui-select
                data-testid="control"
                [label]="labelFor(field)"
                [options]="optionsFor(field)"
                [value]="$any(values()[field.name])"
                [clearable]="!field.required"
                [describedBy]="errorId"
                (valueChange)="set(field.name, $event)"
              />
              @if (values()[field.name] !== null && !field.required) {
                <button
                  type="button"
                  class="schema-field__clear"
                  data-testid="clear"
                  (click)="set(field.name, null)"
                >
                  {{ labels().clear }}
                </button>
              }
            }
            @case ('multiSelect') {
              <ui-multiselect
                data-testid="control"
                [label]="labelFor(field)"
                [options]="optionsFor(field)"
                [value]="$any(values()[field.name]) ?? []"
                [describedBy]="errorId"
                (valueChange)="set(field.name, $event)"
              />
            }
            @default {
              <label class="schema-field__label" [for]="id">{{ labelFor(field) }}</label>
              @if (field.dataType === 'longText') {
                <textarea
                  data-testid="control"
                  rows="3"
                  [id]="id"
                  [value]="$any(values()[field.name]) ?? ''"
                  [attr.aria-describedby]="errorId"
                  [attr.aria-invalid]="problem !== undefined ? true : null"
                  [attr.aria-required]="field.required"
                  (input)="set(field.name, $any($event.target).value)"
                ></textarea>
              } @else if (field.dataType === 'integer' || field.dataType === 'decimal') {
                <input
                  type="number"
                  data-testid="control"
                  [id]="id"
                  [attr.step]="field.dataType === 'integer' ? 1 : 'any'"
                  [value]="values()[field.name] ?? ''"
                  [attr.aria-describedby]="errorId"
                  [attr.aria-invalid]="problem !== undefined ? true : null"
                  [attr.aria-required]="field.required"
                  (input)="setNumber(field.name, $any($event.target).value)"
                />
              } @else {
                <input
                  type="text"
                  data-testid="control"
                  [id]="id"
                  [value]="$any(values()[field.name]) ?? ''"
                  [attr.aria-describedby]="errorId"
                  [attr.aria-invalid]="problem !== undefined ? true : null"
                  [attr.aria-required]="field.required"
                  (input)="set(field.name, $any($event.target).value)"
                />
              }
            }
          }

          @if (errorId !== null) {
            <p class="schema-field__error" data-testid="error" [id]="errorId">{{ problem }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .schema-fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .schema-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .schema-field__label {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .schema-field input[type='text'],
    .schema-field input[type='number'],
    .schema-field textarea {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .schema-field--invalid input,
    .schema-field--invalid textarea {
      border-color: var(--color-danger);
    }

    .schema-field__check {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .schema-field__clear {
      align-self: flex-start;
      border: none;
      background: transparent;
      color: var(--color-accent);
      cursor: pointer;
    }

    .schema-field__error {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class SchemaFields {
  readonly fields = input.required<readonly FieldDef[]>();
  readonly values = model.required<FieldValues>();
  /** Already-translated messages keyed by Field name. */
  readonly problems = input<Readonly<Record<string, string>>>({});
  readonly labels = input.required<SchemaFieldsLabels>();
  /** Makes control ids unique when several forms render on one page. */
  readonly idPrefix = input.required<string>();

  protected readonly scalarFields = computed(() =>
    this.fields().filter((field) => !isReferenceField(field)),
  );

  protected labelFor(field: FieldDef): string {
    return field.required ? `${field.name} (${this.labels().required})` : field.name;
  }

  protected optionsFor(field: FieldDef): readonly SelectOption[] {
    return (field as SelectFieldDef).options.map((option) => ({ value: option, label: option }));
  }

  protected set(name: string, value: FieldValue): void {
    this.values.set({ ...this.values(), [name]: value });
  }

  /** An empty box is no value; anything unparseable is kept as NaN so validation can say so. */
  protected setNumber(name: string, raw: string): void {
    this.set(name, raw.trim() === '' ? null : Number(raw));
  }
}
