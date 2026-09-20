import { provideState, provideStore } from '@ngrx/store';
import { provideRouter } from '@angular/router';
import { scenario } from '../../../../playwright/gallery/scenario';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { provideInMemoryPorts } from '../../data/testing/scenario-ports';
import { localeFeature } from '../../core/state/locale/locale.feature';
import { UiLocaleService } from '../../ui/services/ui-locale.service';
import { CalendarPage } from './calendar-page';
import { provideCalendarTranslations } from './i18n/calendar-translations';

/**
 * The Calendar page is a route component, so it needs a router and — through
 * `UiLocaleService` — the locale slice of the app-wide store (ADR 0010). Both are stubs
 * here: the grid's keyboard behaviour is what the scenario is for, not navigation.
 */
const providers = [
  provideCalendarTranslations(),
  provideRouter([]),
  provideStore(),
  provideState(localeFeature),
  // `CalendarDataAccess` needs no entry here: it is `@Injectable()` with no
  // `providedIn` and `CalendarPage` provides it itself (ADR 0016), so the page builds it
  // per mount in its node injector, which falls back to the fakes below.
  //
  // These two are `@Service()` singletons, so left alone they would be built in the root
  // injector — where the fakes do not exist. Naming them here builds them in the
  // scenario's own injector instead, which is the whole point of having one.
  TrackerLookup,
  // Injects the Store provided just above.
  UiLocaleService,
  provideInMemoryPorts(),
];

/** One Tracker ready to log against, so quick-create has something to offer. */
export const oneTracker = scenario({
  component: CalendarPage,
  providers,
  setup: async (injector) => {
    await injector.get(TRACKER_REPOSITORY).create({
      name: 'Sleep',
      defaultTimeMode: 'point',
      fields: [{ name: 'Hours', dataType: 'decimal', required: false }],
    });
  },
});

/** A Tracker with no committed Version: nothing can be logged against it yet. */
export const noCommittedTracker = scenario({
  component: CalendarPage,
  providers,
  setup: async (injector) => {
    await injector.get(TRACKER_REPOSITORY).create({ name: 'Snack', defaultTimeMode: 'point' });
  },
});
