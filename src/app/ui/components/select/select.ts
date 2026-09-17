import { Listbox, Option } from '@angular/aria/listbox';
import { Component, input, linkedSignal, model } from '@angular/core';
import type { SelectOption } from './select-option';

let nextId = 0;

/**
 * Single-select over `@angular/aria`'s Listbox, which owns the keyboard navigation and
 * ARIA wiring. Values are strings throughout the app (ids, enum members), so this takes
 * no type parameter.
 */
@Component({
  selector: 'ui-select',
  imports: [Listbox, Option],
  template: `
    <div class="select">
      @if (label() !== '') {
        <span class="select__label" [id]="labelId">{{ label() }}</span>
      }

      <ul
        ngListbox
        selectionMode="explicit"
        class="select__list"
        data-testid="select"
        [value]="selection()"
        (valueChange)="onSelection($event)"
        [disabled]="disabled()"
        [attr.aria-labelledby]="label() === '' ? null : labelId"
        [attr.aria-label]="label() === '' ? ariaLabel() : null"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="describedBy() === null ? null : true"
      >
        @for (option of options(); track option.value) {
          <li
            ngOption
            class="select__option"
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
    .select {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .select__label {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .select__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      list-style: none;
    }

    .select__list:focus-visible {
      outline: var(--focus-ring-width) solid var(--color-focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .select__option {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .select__option[aria-selected='true'] {
      background: var(--color-accent-subtle);
      font-weight: var(--weight-medium);
    }

    .select__option[aria-disabled='true'] {
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }
  `,
})
export class Select {
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string | null>(null);
  readonly label = input('');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);
  /** Id of an element describing the current validation problem, if there is one. */
  readonly describedBy = input<string | null>(null);

  protected readonly labelId = `ui-select-label-${++nextId}`;

  /** When false, clicking the selected option again cannot leave the select empty. */
  readonly clearable = input(true);

  protected readonly selection = linkedSignal(() => {
    const current = this.value();
    return current === null ? [] : [current];
  });

  protected onSelection(values: readonly string[]): void {
    const next = values[0] ?? null;
    if (next === null && !this.clearable()) {
      // Explicit selection toggles, so a click on the chosen option deselects it. A fresh
      // array — same content, new identity — pushes the current choice back into the listbox.
      const current = this.value();
      this.selection.set(current === null ? [] : [current]);
      return;
    }
    this.value.set(next);
  }
}
