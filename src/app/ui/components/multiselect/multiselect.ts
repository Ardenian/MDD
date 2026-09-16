import { Listbox, Option } from '@angular/aria/listbox';
import { Component, input, model } from '@angular/core';
import type { SelectOption } from '../select/select-option';

let nextId = 0;

/** Multi-select over `@angular/aria`'s Listbox; backs multi-select Fields on the Entry form. */
@Component({
  selector: 'ui-multiselect',
  imports: [Listbox, Option],
  template: `
    <div class="multiselect">
      @if (label() !== '') {
        <span class="multiselect__label" [id]="labelId">{{ label() }}</span>
      }

      <ul
        ngListbox
        multi
        class="multiselect__list"
        data-testid="multiselect"
        [value]="value()"
        (valueChange)="value.set($event)"
        [disabled]="disabled()"
        [attr.aria-labelledby]="label() === '' ? null : labelId"
        [attr.aria-label]="label() === '' ? ariaLabel() : null"
      >
        @for (option of options(); track option.value) {
          <li
            ngOption
            class="multiselect__option"
            [value]="option.value"
            [label]="option.label"
            [disabled]="option.disabled ?? false"
            [attr.data-testid]="option.value"
          >
            {{ option.label }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .multiselect {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .multiselect__label {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .multiselect__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      list-style: none;
    }

    .multiselect__list:focus-visible {
      outline: var(--focus-ring-width) solid var(--color-focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .multiselect__option {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .multiselect__option[aria-selected='true'] {
      background: var(--color-accent-subtle);
      font-weight: var(--weight-medium);
    }

    .multiselect__option[aria-disabled='true'] {
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }
  `,
})
export class Multiselect {
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string[]>([]);
  readonly label = input('');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);

  protected readonly labelId = `ui-multiselect-label-${++nextId}`;
}
