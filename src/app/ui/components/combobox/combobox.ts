import { Combobox as AriaCombobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, model, output, signal } from '@angular/core';

let nextId = 0;

/**
 * Free-text multi-value input with autocomplete — the Tag input. `@angular/aria`'s
 * Combobox owns the popup's keyboard and ARIA wiring; this adds the chosen values as
 * removable chips. Suggestions come in from outside, so the consumer decides where they
 * are looked up.
 */
@Component({
  selector: 'ui-combobox',
  imports: [AriaCombobox, ComboboxPopup, ComboboxWidget, Listbox, Option],
  template: `
    <div class="combobox">
      <label class="combobox__label" [for]="inputId">{{ label() }}</label>

      @if (values().length > 0) {
        <ul class="combobox__chips" data-testid="chips" [attr.aria-label]="label()">
          @for (value of values(); track value) {
            <li class="combobox__chip" [attr.data-testid]="value">
              <span>{{ value }}</span>
              <button
                type="button"
                class="combobox__remove"
                data-testid="remove"
                [attr.aria-label]="removeLabel() + ': ' + value"
                (click)="remove(value)"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </li>
          }
        </ul>
      }

      <input
        ngCombobox
        #combobox="ngCombobox"
        class="combobox__input"
        data-testid="input"
        autocomplete="off"
        [id]="inputId"
        [value]="query()"
        (valueChange)="onQuery($event)"
        [(expanded)]="expanded"
        (keydown.enter)="commitTyped($event)"
      />

      <ng-template ngComboboxPopup [combobox]="combobox">
        <ul
          ngComboboxWidget
          ngListbox
          selectionMode="explicit"
          #listbox="ngListbox"
          class="combobox__popup"
          data-testid="suggestions"
          [activeDescendant]="listbox.activeDescendant()"
          [value]="noSelection"
          (valueChange)="pick($event)"
        >
          @for (suggestion of visibleSuggestions(); track suggestion) {
            <li
              ngOption
              class="combobox__option"
              [value]="suggestion"
              [label]="suggestion"
              [attr.data-testid]="suggestion"
            >
              {{ suggestion }}
            </li>
          }
        </ul>
      </ng-template>
    </div>
  `,
  styles: `
    .combobox {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .combobox__label {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .combobox__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .combobox__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-accent-subtle);
      color: var(--color-ink);
      font-size: var(--text-sm);
    }

    .combobox__remove {
      border: none;
      background: transparent;
      color: var(--color-ink-muted);
      cursor: pointer;
    }

    .combobox__input {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .combobox__popup {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: var(--z-overlay);
      min-width: 12rem;
      margin: var(--space-1) 0 0;
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-md);
      list-style: none;
    }

    .combobox__popup:empty {
      display: none;
    }

    .combobox__option {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .combobox__option[data-active='true'],
    .combobox__option:hover {
      background: var(--color-surface-hover);
    }
  `,
})
export class Combobox {
  readonly values = model<readonly string[]>([]);
  readonly suggestions = input<readonly string[]>([]);
  readonly label = input.required<string>();
  readonly removeLabel = input('Remove');

  /** The text being typed, so the consumer can look suggestions up for it. */
  readonly queryChange = output<string>();

  protected readonly inputId = `ui-combobox-${++nextId}`;
  protected readonly query = signal('');
  protected readonly expanded = signal(false);
  protected readonly noSelection: string[] = [];

  protected readonly visibleSuggestions = computed(() =>
    this.suggestions().filter((suggestion) => !this.values().includes(suggestion)),
  );

  protected onQuery(value: string): void {
    this.query.set(value);
    this.queryChange.emit(value);
  }

  protected pick(selected: readonly string[]): void {
    const [value] = selected;
    if (value !== undefined) {
      this.add(value);
    }
  }

  /**
   * Enter adds whatever was typed. Deferred one microtask: when a suggestion is active
   * the combobox picks it on the same keypress, and picking clears the query first, so
   * the typed fragment is not added on top of the suggestion.
   */
  protected commitTyped(event: Event): void {
    event.preventDefault();
    queueMicrotask(() => this.add(this.query()));
  }

  protected remove(value: string): void {
    this.values.set(this.values().filter((existing) => existing !== value));
  }

  private add(raw: string): void {
    const value = raw.trim();
    if (value !== '' && !this.values().includes(value)) {
      this.values.set([...this.values(), value]);
    }
    this.onQuery('');
    this.expanded.set(false);
  }
}
