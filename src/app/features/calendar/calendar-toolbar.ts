import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { CalendarView } from './calendar-dates';

/** View switch, date navigation and "Now". Presentation-only (ADR 0002). */
@Component({
  selector: 'app-calendar-toolbar',
  imports: [TranslatePipe],
  template: `
    <div class="toolbar" data-testid="calendar-toolbar">
      <h1 class="toolbar__title" data-testid="page-title">{{ title() }}</h1>

      <div class="toolbar__controls">
        <div
          class="toolbar__group"
          role="group"
          [attr.aria-label]="'calendar.view.label' | translate"
        >
          <button
            type="button"
            data-testid="view-day"
            [attr.aria-pressed]="view() === 'day'"
            (click)="viewChange.emit('day')"
          >
            {{ 'calendar.view.day' | translate }}
          </button>
          <button
            type="button"
            data-testid="view-week"
            [attr.aria-pressed]="view() === 'week'"
            (click)="viewChange.emit('week')"
          >
            {{ 'calendar.view.week' | translate }}
          </button>
        </div>

        <div class="toolbar__group">
          <button
            type="button"
            data-testid="previous"
            [attr.aria-label]="'calendar.previous' | translate"
            (click)="stepped.emit(-1)"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>
          <button type="button" data-testid="today" (click)="todayRequested.emit()">
            {{ 'calendar.today' | translate }}
          </button>
          <button
            type="button"
            data-testid="next"
            [attr.aria-label]="'calendar.next' | translate"
            (click)="stepped.emit(1)"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
        </div>

        <label class="toolbar__date">
          <span class="visually-hidden">{{ 'calendar.goToDate' | translate }}</span>
          <input
            type="date"
            data-testid="date-picker"
            [value]="day()"
            (change)="pickDate($any($event.target).value)"
          />
        </label>

        <button
          #nowButton
          type="button"
          class="toolbar__now"
          data-testid="now"
          (click)="nowRequested.emit(nowButton)"
        >
          {{ 'calendar.now' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .toolbar__title {
      margin: 0;
      font-size: var(--text-xl);
    }

    .toolbar__controls,
    .toolbar__group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .toolbar__controls {
      gap: var(--space-4);
    }

    button,
    input {
      min-height: var(--control-height);
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    button {
      cursor: pointer;
    }

    button[aria-pressed='true'] {
      border-color: var(--color-accent);
      background: var(--color-accent-subtle);
      color: var(--color-accent-hover);
      font-weight: var(--weight-medium);
    }

    .toolbar__now {
      border-color: transparent;
      background: var(--color-accent);
      color: var(--color-ink-inverted);
    }
  `,
})
export class CalendarToolbar {
  readonly view = input.required<CalendarView>();
  readonly day = input.required<string>();
  readonly title = input.required<string>();

  readonly viewChange = output<CalendarView>();
  readonly stepped = output<-1 | 1>();
  readonly todayRequested = output<void>();
  readonly dateChange = output<string>();
  readonly nowRequested = output<HTMLElement>();

  protected pickDate(value: string): void {
    if (value !== '') {
      this.dateChange.emit(value);
    }
  }
}
