import { Component, input, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Fadeout, Placement } from '../../data/model/placement';
import type { TimeMode } from '../../data/model/tracker';
import { Select } from '../../ui/components/select/select';
import { withTimeMode } from './fadeout';
import { fromLocalDateTimeInput, minutesFromInput, toLocalDateTimeInput } from './placement-input';

/**
 * Mode, time(s) and Fadeout for one Entry. Presentation-only (ADR 0002): two-way bound to
 * the placement, leaving validation and "now" to the form that owns the state.
 */
@Component({
  selector: 'app-placement-editor',
  imports: [TranslatePipe, Select],
  template: `
    <fieldset class="placement" data-testid="placement">
      <legend class="visually-hidden">{{ 'entries.placement.mode' | translate }}</legend>

      <ui-select
        data-testid="mode"
        [label]="'entries.placement.mode' | translate"
        [options]="[
          { value: 'point', label: 'entries.placement.modes.point' | translate },
          { value: 'period', label: 'entries.placement.modes.period' | translate },
          { value: 'dayBucketed', label: 'entries.placement.modes.dayBucketed' | translate },
        ]"
        [value]="placement().kind"
        [clearable]="false"
        (valueChange)="changeMode($event)"
      />

      <div class="placement__times">
        @switch (placement().kind) {
          @case ('point') {
            <label>
              <span>{{ 'entries.placement.at' | translate }}</span>
              <input
                type="datetime-local"
                data-testid="at"
                [value]="local($any(placement()).at)"
                [attr.aria-describedby]="problemId()"
                (input)="setInstant('at', $any($event.target).value)"
              />
            </label>
          }
          @case ('period') {
            <label>
              <span>{{ 'entries.placement.start' | translate }}</span>
              <input
                type="datetime-local"
                data-testid="start"
                [value]="local($any(placement()).start)"
                [attr.aria-describedby]="problemId()"
                (input)="setInstant('start', $any($event.target).value)"
              />
            </label>
            <label>
              <span>{{ 'entries.placement.end' | translate }}</span>
              <input
                type="datetime-local"
                data-testid="end"
                [value]="local($any(placement()).end)"
                [attr.aria-describedby]="problemId()"
                (input)="setInstant('end', $any($event.target).value)"
              />
            </label>
          }
          @case ('dayBucketed') {
            <label>
              <span>{{ 'entries.placement.day' | translate }}</span>
              <input
                type="date"
                data-testid="day"
                [value]="$any(placement()).day"
                [attr.aria-describedby]="problemId()"
                (input)="setDay($any($event.target).value)"
              />
            </label>
          }
        }

        @if (placement().kind !== 'dayBucketed') {
          <label>
            <span>{{ 'entries.placement.fadeoutBefore' | translate }}</span>
            <input
              type="number"
              min="0"
              step="1"
              data-testid="fadeout-before"
              [value]="fadeout().beforeMinutes"
              [attr.aria-describedby]="problemId()"
              (input)="setFadeout('beforeMinutes', $any($event.target).value)"
            />
          </label>
          <label>
            <span>{{ 'entries.placement.fadeoutAfter' | translate }}</span>
            <input
              type="number"
              min="0"
              step="1"
              data-testid="fadeout-after"
              [value]="fadeout().afterMinutes"
              [attr.aria-describedby]="problemId()"
              (input)="setFadeout('afterMinutes', $any($event.target).value)"
            />
          </label>
        }

        <button
          type="button"
          class="placement__now"
          data-testid="now"
          (click)="nowRequested.emit()"
        >
          {{ 'entries.placement.now' | translate }}
        </button>
      </div>

      @if (problem() !== null) {
        <p class="placement__problem" data-testid="placement-problem" [id]="problemId()">
          {{ problem() }}
        </p>
      }
    </fieldset>
  `,
  styles: `
    .placement {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      border: none;
    }

    .placement__times {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-4);
    }

    .placement label {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .placement input {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .placement input[type='number'] {
      width: 7rem;
    }

    .placement__now {
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .placement__problem {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class PlacementEditor {
  /**
   * A model, not an input: the next placement is derived from this one, and a model
   * updates locally the moment it is set, so an edit made before the parent re-renders
   * never builds on a stale value.
   */
  readonly placement = model.required<Placement>();
  /** Already translated. */
  readonly problem = input<string | null>(null);
  readonly idPrefix = input.required<string>();

  readonly nowRequested = output<void>();

  protected problemId(): string | null {
    return this.problem() === null ? null : `${this.idPrefix()}-placement-problem`;
  }

  protected fadeout(): Fadeout {
    const current = this.placement();
    return current.kind === 'dayBucketed'
      ? { beforeMinutes: 0, afterMinutes: 0 }
      : (current.fadeout ?? { beforeMinutes: 0, afterMinutes: 0 });
  }

  protected local(iso: string): string {
    return toLocalDateTimeInput(iso);
  }

  protected changeMode(mode: string | null): void {
    if (mode !== null) {
      this.placement.set(withTimeMode(this.placement(), mode as TimeMode));
    }
  }

  /** A half-typed datetime is not a placement yet, so nothing is emitted for it. */
  protected setInstant(key: 'at' | 'start' | 'end', value: string): void {
    const iso = fromLocalDateTimeInput(value);
    if (iso !== null) {
      this.placement.set({ ...this.placement(), [key]: iso } as Placement);
    }
  }

  protected setDay(day: string): void {
    if (day !== '') {
      this.placement.set({ kind: 'dayBucketed', day });
    }
  }

  protected setFadeout(side: keyof Fadeout, value: string): void {
    const current = this.placement();
    if (current.kind !== 'dayBucketed') {
      this.placement.set({
        ...current,
        fadeout: { ...this.fadeout(), [side]: minutesFromInput(value) },
      });
    }
  }
}
