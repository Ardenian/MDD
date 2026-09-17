import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { SLOTS_PER_DAY } from './calendar-dates';
import type { TimedLayout } from './calendar-layout';

export interface CalendarEntryView {
  readonly id: string;
  /** Tracker name — shown, so colour is never the only signal. */
  readonly name: string;
  readonly time: string;
  /** The full accessible description: Tracker, time, Fadeout, parent. */
  readonly label: string;
  readonly colorIndex: number;
  readonly isChild: boolean;
}

export interface TimedEntryView extends CalendarEntryView {
  readonly layout: TimedLayout;
}

export interface CalendarDayView {
  readonly key: string;
  readonly label: string;
  readonly isToday: boolean;
  readonly strip: readonly CalendarEntryView[];
  readonly timed: readonly TimedEntryView[];
  /** Where the current-time line sits, as a fraction of the day; `null` off today. */
  readonly nowFraction: number | null;
}

export interface SlotActivation {
  readonly day: string;
  readonly slot: number;
  readonly origin: HTMLElement;
}

const KEY_MOVES: Readonly<Record<string, readonly [day: number, slot: number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  PageUp: [0, -2],
  PageDown: [0, 2],
};

let nextId = 0;

/**
 * The Day or Week time grid. Presentation-only (ADR 0002); `ElementRef` is the framework
 * primitive it needs to move keyboard focus between slots.
 *
 * Every half hour is a button, but only one is in the Tab order at a time (a roving
 * tabindex): arrow keys move between slots and days, Enter or Space logs an Entry there.
 * Entries sit on a layer above the slots; that layer ignores the pointer except on the
 * Entries themselves, so empty space still reaches the slot underneath.
 */
@Component({
  selector: 'app-calendar-grid',
  template: `
    <p class="visually-hidden" [id]="hintId">{{ keyboardHint() }}</p>

    <div class="grid" data-testid="calendar-grid">
      <div
        class="grid__columns"
        [style.grid-template-columns]="
          'var(--gutter-width) repeat(' + days().length + ', minmax(0, 1fr))'
        "
      >
        <div class="grid__corner" aria-hidden="true"></div>
        <div class="grid__gutter" aria-hidden="true">
          @for (label of hourLabels(); track $index) {
            <span class="grid__hour" [style.top.%]="($index / 24) * 100">{{ label }}</span>
          }
        </div>

        @for (day of days(); track day.key; let dayIndex = $index) {
          <div class="day" [attr.data-testid]="day.key">
            <div
              class="day__header"
              [class.day__header--today]="day.isToday"
              [style.grid-column]="dayIndex + 2"
            >
              <span class="day__label" data-testid="day-label">{{ day.label }}</span>
              @if (day.strip.length > 0) {
                <ul class="day__strip" data-testid="strip">
                  @for (entry of day.strip; track entry.id) {
                    <li
                      [attr.data-testid]="entry.id"
                      [style.--tracker]="trackerColor(entry.colorIndex)"
                    >
                      <button
                        type="button"
                        class="entry entry--strip"
                        [class.entry--child]="entry.isChild"
                        data-testid="entry-button"
                        [attr.aria-label]="entry.label"
                        (click)="entryOpened.emit(entry.id)"
                      >
                        {{ entry.name }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>

            <div
              class="day__body"
              role="group"
              [style.grid-column]="dayIndex + 2"
              [attr.aria-label]="day.label"
              [attr.aria-describedby]="hintId"
            >
              @for (slot of slots; track slot) {
                <button
                  type="button"
                  class="slot"
                  [class.slot--hour]="slot % 2 === 0"
                  [id]="cellId(dayIndex, slot)"
                  [attr.data-testid]="'slot-' + slot"
                  [attr.tabindex]="focus().day === dayIndex && focus().slot === slot ? 0 : -1"
                  [attr.aria-label]="slotLabel()(day.key, slot)"
                  (focus)="focus.set({ day: dayIndex, slot })"
                  (click)="activate(day.key, slot, $event)"
                  (keydown)="move($event, dayIndex, slot)"
                ></button>
              }

              <div class="day__layer" data-testid="timed-layer">
                @for (entry of day.timed; track entry.id) {
                  <div
                    class="timed"
                    [attr.data-testid]="entry.id"
                    [style.--tracker]="trackerColor(entry.colorIndex)"
                    [style.left.%]="(entry.layout.column / entry.layout.columns) * 100"
                    [style.width.%]="100 / entry.layout.columns"
                  >
                    @if (entry.layout.fadeBefore; as band) {
                      <div
                        class="band band--before"
                        data-testid="fade-before"
                        aria-hidden="true"
                        [style.top.%]="band.top * 100"
                        [style.height.%]="band.height * 100"
                      ></div>
                    }
                    <button
                      type="button"
                      class="entry"
                      [class.entry--point]="entry.layout.isPoint"
                      [class.entry--child]="entry.isChild"
                      data-testid="entry-button"
                      [attr.aria-label]="entry.label"
                      [style.top.%]="entry.layout.block.top * 100"
                      [style.height.%]="entry.layout.block.height * 100"
                      (click)="entryOpened.emit(entry.id)"
                    >
                      <span class="entry__name">
                        @if (entry.isChild) {
                          <span aria-hidden="true">&#8627; </span>
                        }
                        {{ entry.name }}
                      </span>
                      <span class="entry__time">{{ entry.time }}</span>
                    </button>
                    @if (entry.layout.fadeAfter; as band) {
                      <div
                        class="band band--after"
                        data-testid="fade-after"
                        aria-hidden="true"
                        [style.top.%]="band.top * 100"
                        [style.height.%]="band.height * 100"
                      ></div>
                    }
                  </div>
                }

                @if (day.nowFraction !== null) {
                  <div
                    class="now-line"
                    data-testid="now-line"
                    aria-hidden="true"
                    [style.top.%]="day.nowFraction * 100"
                  ></div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    /* 48 rows = SLOTS_PER_DAY; component styles must be static, so it is spelled out here. */
    :host {
      --gutter-width: 4rem;
      --slot-height: 1.5rem;
      display: block;
      min-width: 0;
    }

    .grid {
      max-height: 72vh;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .grid__columns {
      display: grid;
      grid-template-rows: auto calc(48 * var(--slot-height));
    }

    .day {
      display: contents;
    }

    .grid__corner,
    .day__header {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      grid-row: 1;
      padding: var(--space-2);
      border-bottom: 1px solid var(--color-border-strong);
      background: var(--color-surface);
    }

    .grid__corner {
      grid-column: 1;
    }

    .day__header {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      border-left: 1px solid var(--color-border);
    }

    .day__header--today .day__label {
      color: var(--color-accent-hover);
      font-weight: var(--weight-bold);
    }

    .day__label {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .day__strip {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .grid__gutter {
      position: relative;
      grid-row: 2;
      grid-column: 1;
    }

    .grid__hour {
      position: absolute;
      right: var(--space-2);
      color: var(--color-ink-muted);
      font-size: var(--text-xs);
      transform: translateY(-50%);
    }

    .grid__hour:first-child {
      transform: none;
    }

    .day__body {
      position: relative;
      display: grid;
      grid-row: 2;
      grid-template-rows: repeat(48, var(--slot-height));
      border-left: 1px solid var(--color-border);
    }

    .slot {
      display: block;
      margin: 0;
      padding: 0;
      border: none;
      border-top: 1px dotted var(--color-border);
      background: transparent;
      cursor: pointer;
    }

    .slot--hour {
      border-top: 1px solid var(--color-border);
    }

    .slot:hover {
      background: var(--color-surface-hover);
    }

    .slot:focus-visible {
      outline-offset: calc(-1 * var(--focus-ring-width));
      background: var(--color-accent-subtle);
    }

    .day__layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .timed {
      position: absolute;
      top: 0;
      bottom: 0;
      padding: 0 var(--space-1);
    }

    .entry {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      overflow: hidden;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-surface);
      border-radius: var(--radius-sm);
      background: var(--tracker);
      color: var(--color-ink-inverted);
      font-size: var(--text-xs);
      line-height: var(--leading-tight);
      text-align: start;
      cursor: pointer;
      pointer-events: auto;
    }

    .timed .entry {
      position: absolute;
      left: var(--space-1);
      right: var(--space-1);
    }

    .entry--strip {
      width: 100%;
    }

    .entry--point {
      border-left: 4px solid var(--color-ink);
    }

    .entry--child {
      border: 2px dashed var(--color-surface);
      box-shadow: inset 0 0 0 1px var(--tracker);
    }

    .entry__name {
      max-width: 100%;
      overflow: hidden;
      font-weight: var(--weight-medium);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry__time {
      opacity: 0.9;
    }

    .band {
      position: absolute;
      left: var(--space-1);
      right: var(--space-1);
      border-radius: var(--radius-sm);
    }

    .band--before {
      background: linear-gradient(
        to bottom,
        transparent,
        color-mix(in srgb, var(--tracker) 55%, transparent)
      );
    }

    .band--after {
      background: linear-gradient(
        to bottom,
        color-mix(in srgb, var(--tracker) 55%, transparent),
        transparent
      );
    }

    .now-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-danger);
    }
  `,
})
export class CalendarGrid {
  readonly days = input.required<readonly CalendarDayView[]>();
  readonly hourLabels = input.required<readonly string[]>();
  readonly slotLabel = input.required<(day: string, slot: number) => string>();
  readonly keyboardHint = input.required<string>();
  /** Where keyboard focus and scrolling start when the visible days change. */
  readonly initialSlot = input.required<number>();

  readonly slotActivated = output<SlotActivation>();
  readonly entryOpened = output<string>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly prefix = `calendar-grid-${++nextId}`;

  protected readonly hintId = `${this.prefix}-hint`;
  protected readonly slots = Array.from({ length: SLOTS_PER_DAY }, (_, slot) => slot);
  protected readonly focus = linkedSignal({
    source: this.initialSlot,
    computation: (slot) => ({ day: 0, slot }),
  });

  constructor() {
    afterRenderEffect(() => {
      const slot = this.initialSlot();
      const target = this.host.nativeElement.querySelector<HTMLElement>(
        `#${this.cellId(0, Math.max(0, slot - 2))}`,
      );
      const scroller = this.host.nativeElement.querySelector<HTMLElement>('.grid');
      if (target !== null && scroller !== null) {
        scroller.scrollTop = target.offsetTop;
      }
    });
  }

  protected cellId(day: number, slot: number): string {
    return `${this.prefix}-${day}-${slot}`;
  }

  protected trackerColor(index: number): string {
    return `var(--color-tracker-${index + 1})`;
  }

  protected activate(day: string, slot: number, event: Event): void {
    this.slotActivated.emit({ day, slot, origin: event.currentTarget as HTMLElement });
  }

  protected move(event: KeyboardEvent, day: number, slot: number): void {
    let target: readonly [number, number] | undefined;
    if (event.key === 'Home') {
      target = [day, 0];
    } else if (event.key === 'End') {
      target = [day, SLOTS_PER_DAY - 1];
    } else {
      const step = KEY_MOVES[event.key];
      target = step === undefined ? undefined : [day + step[0], slot + step[1]];
    }
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    const next = {
      day: Math.min(Math.max(target[0], 0), this.days().length - 1),
      slot: Math.min(Math.max(target[1], 0), SLOTS_PER_DAY - 1),
    };
    this.focus.set(next);
    this.host.nativeElement
      .querySelector<HTMLElement>(`#${this.cellId(next.day, next.slot)}`)
      ?.focus();
  }
}
