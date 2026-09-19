import { provideRouter } from '@angular/router';
import { scenario } from '../../../../playwright/gallery/scenario';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { provideInMemoryPorts } from '../../data/testing/scenario-ports';
import { provideTrackersTranslations } from './i18n/trackers-translations';
import { TrackerDesignerPage } from './tracker-designer-page';
import { TrackersDataAccess } from './trackers-data-access';

const providers = [
  provideTrackersTranslations(),
  // The designer links back to the Tracker list, and a RouterLink needs a router.
  provideRouter([]),
  // Built in the scenario's injector rather than the root one, so they see the fakes.
  TrackersDataAccess,
  TrackerLookup,
  provideInMemoryPorts(),
];

/** A Tracker with an empty, uncommitted Draft — the state Draft validation starts from. */
export const emptyDraft = scenario({
  component: TrackerDesignerPage,
  providers,
  setup: async (injector) => {
    const trackers = injector.get(TRACKER_REPOSITORY);
    const tracker = await trackers.create({ name: 'Sleep', defaultTimeMode: 'point' });
    return { trackerId: tracker.id };
  },
});

/** A committed Tracker with two Fields, for reordering. */
export const twoFields = scenario({
  component: TrackerDesignerPage,
  providers,
  setup: async (injector) => {
    const trackers = injector.get(TRACKER_REPOSITORY);
    const tracker = await trackers.create({
      name: 'Sleep',
      defaultTimeMode: 'point',
      fields: [
        { name: 'Satisfaction', dataType: 'integer', required: false },
        { name: 'Energy', dataType: 'text', required: false },
      ],
    });
    return { trackerId: tracker.id };
  },
});

/** A committed Tracker with one required text Field, for Preset editor validation. */
export const requiredTextField = scenario({
  component: TrackerDesignerPage,
  providers,
  setup: async (injector) => {
    const trackers = injector.get(TRACKER_REPOSITORY);
    const tracker = await trackers.create({
      name: 'Journal',
      defaultTimeMode: 'point',
      fields: [{ name: 'Notes', dataType: 'text', required: true }],
    });
    return { trackerId: tracker.id };
  },
});

/** A committed Tracker with one integer Field, for shape validation on a filled value. */
export const integerField = scenario({
  component: TrackerDesignerPage,
  providers,
  setup: async (injector) => {
    const trackers = injector.get(TRACKER_REPOSITORY);
    const tracker = await trackers.create({
      name: 'Sleep',
      defaultTimeMode: 'point',
      fields: [{ name: 'Satisfaction', dataType: 'integer', required: false }],
    });
    return { trackerId: tracker.id };
  },
});
