import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import type { Entry } from '../../data/model/entry';
import { localDayOf, type Placement, resolveCoveredInterval } from '../../data/model/placement';
import type { TimeMode } from '../../data/model/tracker';
import { OverlayService } from '../../ui/services/overlay.service';
import { UiLocaleService } from '../../ui/services/ui-locale.service';
import { CalendarDataAccess, type CalendarQuery } from './calendar-data-access';
import {
  type CalendarView,
  dayBounds,
  daysInView,
  isDayKey,
  rangeOf,
  shiftView,
  slotOf,
  slotStart,
} from './calendar-dates';
import { CalendarGrid, type CalendarDayView, type CalendarEntryView } from './calendar-grid';
import { layoutDay } from './calendar-layout';
import {
  CALENDAR_PREFERENCES_KEY,
  type CalendarPreferences,
  DEFAULT_CALENDAR_PREFERENCES,
  forKnownTrackers,
  parsePreferences,
  serializePreferences,
} from './calendar-preferences';
import { CalendarToolbar } from './calendar-toolbar';
import { QuickCreatePopover } from './quick-create-popover';
import { type TrackerToggle, TrackerToggles } from './tracker-toggles';

/** One colour token per Tracker, cycling through `--color-tracker-1…8`. */
const TRACKER_COLOURS = 8;
/** Where the grid opens on a day other than today: 07:00. */
const MORNING_SLOT = 14;

/**
 * The Calendar feature's top-level (route) component — the only place in this feature
 * that injects a facade or a `ui/` service (ADR 0002).
 *
 * The visible date is the `date` query parameter rather than stored state: a reload keeps
 * it, while a fresh visit opens on today. View, Tracker toggles and the child filter are
 * this device's preferences, kept in `localStorage` (calendar/SPEC.md).
 */
@Component({
  selector: 'app-calendar-page',
  imports: [TranslatePipe, CalendarToolbar, TrackerToggles, CalendarGrid],
  template: `
    <div class="calendar">
      <app-calendar-toolbar
        [view]="preferences().view"
        [day]="day()"
        [title]="title()"
        (viewChange)="setView($event)"
        (stepped)="step($event)"
        (todayRequested)="goTo(null)"
        (dateChange)="goTo($event)"
        (nowRequested)="quickCreate($event, now(), 'point')"
      />

      <div class="calendar__layout">
        <app-tracker-toggles
          [trackers]="toggles()"
          [showChildren]="preferences().showChildren"
          (visibilityChange)="setTrackerVisible($event.id, $event.visible)"
          (allSet)="setAllVisible($event)"
          (showChildrenChange)="setShowChildren($event)"
        />

        <app-calendar-grid
          [days]="dayViews()"
          [hourLabels]="hourLabels()"
          [slotLabel]="slotLabel()"
          [keyboardHint]="'calendar.grid.hint' | translate"
          [initialSlot]="initialSlot()"
          (slotActivated)="quickCreate($event.origin, slotStartOf($event.day, $event.slot))"
          (entryOpened)="openEntry($event)"
        />
      </div>
    </div>
  `,
  styles: `
    .calendar {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .calendar__layout {
      display: grid;
      grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
      align-items: start;
      gap: var(--space-5);
    }

    @media (max-width: 48rem) {
      .calendar__layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class CalendarPage {
  /** Query parameter; anything that is not a real day falls back to today. */
  readonly date = input<string>();

  private readonly calendar = inject(CalendarDataAccess);
  private readonly lookup = inject(TrackerLookup);
  private readonly overlays = inject(OverlayService);
  private readonly locale = inject(UiLocaleService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly now = signal(Date.now());
  protected readonly preferences = signal<CalendarPreferences>(this.readPreferences());

  private readonly today = computed(() => localDayOf(this.now()));
  protected readonly day = computed(() => {
    const requested = this.date();
    return isDayKey(requested) ? requested : this.today();
  });
  private readonly days = computed(() => daysInView(this.preferences().view, this.day()));

  /** Equal by value, so the minute tick of `now` never triggers a re-read on its own. */
  private readonly query = computed<CalendarQuery>(
    () => ({ ...rangeOf(this.days()), includeChildren: this.preferences().showChildren }),
    {
      equal: (a, b) =>
        a.start === b.start && a.end === b.end && a.includeChildren === b.includeChildren,
    },
  );
  private readonly loaded = this.calendar.entriesFor(this.query);

  private readonly hidden = computed(() => new Set(this.preferences().hiddenTrackerIds));
  private readonly trackersById = computed(
    () =>
      new Map(
        this.lookup
          .list()
          .map((tracker, index) => [
            tracker.id,
            { ...tracker, colorIndex: index % TRACKER_COLOURS },
          ]),
      ),
  );
  private readonly entriesById = computed(
    () => new Map(this.loaded.entries().map((entry) => [entry.id, entry])),
  );

  protected readonly toggles = computed<readonly TrackerToggle[]>(() =>
    [...this.trackersById().values()].map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      archived: tracker.archived,
      colorIndex: tracker.colorIndex,
      visible: !this.hidden().has(tracker.id),
    })),
  );

  private readonly timeFormat = computed(
    () => new Intl.DateTimeFormat(this.locale.uiLocale(), { hour: '2-digit', minute: '2-digit' }),
  );
  private readonly dayFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale.uiLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
  );

  protected readonly title = computed(() => {
    const days = this.days();
    const first = dayBounds(days[0] ?? this.day()).start;
    if (days.length === 1) {
      return new Intl.DateTimeFormat(this.locale.uiLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(first);
    }
    const last = dayBounds(days[days.length - 1] ?? this.day()).start;
    return new Intl.DateTimeFormat(this.locale.uiLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatRange(first, last);
  });

  protected readonly hourLabels = computed(() =>
    Array.from({ length: 24 }, (_, hour) => this.timeFormat().format(new Date(2000, 0, 1, hour))),
  );

  protected readonly slotLabel = computed(() => {
    const time = this.timeFormat();
    const day = this.dayFormat();
    return (dayKey: string, slot: number) =>
      this.translate.instant('calendar.grid.slot', {
        day: day.format(dayBounds(dayKey).start),
        time: time.format(slotStart(dayKey, slot)),
      });
  });

  /** Only recomputed when the visible days change, so the minute tick never moves focus. */
  protected readonly initialSlot = computed(() => {
    const day = this.day();
    return untracked(() => (day === localDayOf(Date.now()) ? slotOf(Date.now()) : MORNING_SLOT));
  });

  protected readonly dayViews = computed<readonly CalendarDayView[]>(() => {
    const byId = this.entriesById();
    const visible = this.loaded.entries().filter((entry) => this.isVisible(entry, byId));
    const items = visible.map((entry) => ({ id: entry.id, placement: entry.placement }));
    const today = this.today();
    const now = this.now();

    return this.days().map((key) => {
      const bounds = dayBounds(key);
      const layout = layoutDay(items, bounds);
      const view = (id: string) => this.entryView(byId.get(id)!, byId);
      return {
        key,
        label: this.dayFormat().format(bounds.start),
        isToday: key === today,
        strip: layout.strip.map(view),
        timed: layout.timed.map((timed) => ({ ...view(timed.id), layout: timed })),
        nowFraction: key === today ? (now - bounds.start) / (bounds.end - bounds.start) : null,
      };
    });
  });

  protected readonly slotStartOf = slotStart;

  constructor() {
    // The lookup is an app-wide singleton; refresh it on arrival rather than trust that
    // every screen which changed a Tracker remembered to.
    this.lookup.reload();

    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => this.writePreferences(this.preferences()));

    // A stored toggle for a Tracker that no longer exists is dropped once the list is known.
    effect(() => {
      if (this.lookup.isLoading()) {
        return;
      }
      const known = new Set(this.lookup.list().map((tracker) => tracker.id));
      untracked(() => {
        const current = this.preferences();
        const pruned = forKnownTrackers(current, known);
        if (pruned.hiddenTrackerIds.length !== current.hiddenTrackerIds.length) {
          this.preferences.set(pruned);
        }
      });
    });

    // The Entry form closes by navigating its outlet away; that is when an Entry changed.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.loaded.reload());
  }

  protected setView(view: CalendarView): void {
    this.preferences.update((current) => ({ ...current, view }));
  }

  protected step(direction: -1 | 1): void {
    this.goTo(shiftView(this.preferences().view, this.day(), direction));
  }

  protected goTo(day: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: day },
      queryParamsHandling: 'merge',
    });
  }

  protected setTrackerVisible(id: string, visible: boolean): void {
    this.preferences.update((current) => ({
      ...current,
      hiddenTrackerIds: visible
        ? current.hiddenTrackerIds.filter((hidden) => hidden !== id)
        : [...new Set([...current.hiddenTrackerIds, id])],
    }));
  }

  protected setAllVisible(visible: boolean): void {
    this.preferences.update((current) => ({
      ...current,
      hiddenTrackerIds: visible ? [] : [...this.trackersById().keys()],
    }));
  }

  protected setShowChildren(showChildren: boolean): void {
    this.preferences.update((current) => ({ ...current, showChildren }));
  }

  /**
   * Opens the Tracker pick where the user asked to log something. Choosing hands off to the
   * Entry form by navigating into the shell's `modal` outlet — never by importing the
   * entries feature. Focus goes back to the slot first, so the form returns it there.
   */
  protected quickCreate(origin: HTMLElement, at: number, mode?: TimeMode): void {
    const trackers = [...this.trackersById().values()]
      .filter((tracker) => !tracker.archived && tracker.hasVersion)
      .map((tracker) => ({ id: tracker.id, name: tracker.name, colorIndex: tracker.colorIndex }));
    const heading =
      mode === 'point'
        ? this.translate.instant('calendar.quickCreate.headingNow')
        : this.translate.instant('calendar.quickCreate.heading', {
            time: `${this.dayFormat().format(at)} ${this.timeFormat().format(at)}`,
          });

    const handle = this.overlays.openPopover(QuickCreatePopover, {
      origin,
      inputs: { trackers, heading },
      injector: this.injector,
    });
    let handedOff = false;

    handle.component.picked.subscribe((trackerId) => {
      handedOff = true;
      handle.close();
      origin.focus();
      void this.router.navigate([{ outlets: { modal: ['entry', 'new'] } }], {
        queryParams: { trackerId, at: new Date(at).toISOString(), mode: mode ?? null },
        queryParamsHandling: 'merge',
      });
    });
    handle.component.cancelled.subscribe(() => handle.close());
    void handle.closed.then(() => {
      if (!handedOff) {
        origin.focus();
      }
    });
  }

  /** A child is only edited through its parent, so opening one opens the Entry it belongs to. */
  protected openEntry(entryId: string): void {
    const byId = this.entriesById();
    let root = byId.get(entryId);
    while (root?.parentEntryId != null && byId.has(root.parentEntryId)) {
      root = byId.get(root.parentEntryId);
    }
    void this.router.navigate([{ outlets: { modal: ['entry', root?.id ?? entryId] } }], {
      queryParamsHandling: 'preserve',
    });
  }

  /** Hidden if its own Tracker is toggled off — or any ancestor's, since it sits at theirs. */
  private isVisible(entry: Entry, byId: ReadonlyMap<string, Entry>): boolean {
    let current: Entry | undefined = entry;
    while (current !== undefined) {
      if (this.hidden().has(current.trackerId)) {
        return false;
      }
      current = current.parentEntryId === null ? undefined : byId.get(current.parentEntryId);
    }
    return true;
  }

  private entryView(entry: Entry, byId: ReadonlyMap<string, Entry>): CalendarEntryView {
    const tracker = this.trackersById().get(entry.trackerId);
    const name = tracker?.name ?? '';
    const time = this.describeTime(entry.placement);
    let label: string = this.translate.instant('calendar.entry.label', { tracker: name, time });

    const fadeout = this.describeFadeout(entry.placement);
    if (fadeout !== null) {
      label = this.translate.instant('calendar.entry.fadeout', { label, ...fadeout });
    }
    if (entry.parentEntryId !== null) {
      const parent = byId.get(entry.parentEntryId);
      const parentName =
        parent === undefined ? '' : (this.trackersById().get(parent.trackerId)?.name ?? '');
      label = this.translate.instant('calendar.entry.child', { label, parent: parentName });
    }

    return {
      id: entry.id,
      name,
      time,
      label,
      colorIndex: tracker?.colorIndex ?? 0,
      isChild: entry.parentEntryId !== null,
    };
  }

  private describeTime(placement: Placement): string {
    const format = this.timeFormat();
    switch (placement.kind) {
      case 'point':
        return format.format(Date.parse(placement.at));
      case 'period':
        return `${format.format(Date.parse(placement.start))}–${format.format(Date.parse(placement.end))}`;
      case 'dayBucketed':
        return this.translate.instant('calendar.entry.dayBucketed');
    }
  }

  private describeFadeout(placement: Placement): { from: string; to: string } | null {
    if (placement.kind === 'dayBucketed' || placement.fadeout === undefined) {
      return null;
    }
    const { beforeMinutes, afterMinutes } = placement.fadeout;
    if (beforeMinutes === 0 && afterMinutes === 0) {
      return null;
    }
    const covered = resolveCoveredInterval(placement);
    return {
      from: this.timeFormat().format(covered.start),
      to: this.timeFormat().format(covered.end),
    };
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /** Read defensively: storage can be absent, blocked, or hold something unreadable. */
  private readPreferences(): CalendarPreferences {
    try {
      return parsePreferences(this.storage()?.getItem(CALENDAR_PREFERENCES_KEY) ?? null);
    } catch {
      return DEFAULT_CALENDAR_PREFERENCES;
    }
  }

  private writePreferences(preferences: CalendarPreferences): void {
    try {
      this.storage()?.setItem(CALENDAR_PREFERENCES_KEY, serializePreferences(preferences));
    } catch {
      // Convenience state only; failing to keep it must never break the Calendar.
    }
  }
}
