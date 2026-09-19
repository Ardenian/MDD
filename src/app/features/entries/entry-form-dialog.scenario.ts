import { scenario } from '../../../../playwright/gallery/scenario';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { provideInMemoryPorts } from '../../data/testing/scenario-ports';
import { EntriesDataAccess } from './entries-data-access';
import { EntryFormDialog } from './entry-form-dialog';
import { provideEntriesTranslations } from './i18n/entries-translations';

const providers = [
  provideEntriesTranslations(),
  // Built in the scenario's injector rather than the root one, so they see the fakes.
  EntriesDataAccess,
  TrackerLookup,
  provideInMemoryPorts(),
];

/** A new Entry against a Tracker whose only Field is required and empty. */
export const requiredField = scenario({
  component: EntryFormDialog,
  providers,
  setup: async (injector) => {
    const tracker = await injector.get(TRACKER_REPOSITORY).create({
      name: 'Journal',
      defaultTimeMode: 'point',
      fields: [{ name: 'Notes', dataType: 'text', required: true }],
    });
    return { request: { trackerId: tracker.id } };
  },
});

/** A new Entry against optional Fields, for shape and placement validation. */
export const optionalFields = scenario({
  component: EntryFormDialog,
  providers,
  setup: async (injector) => {
    const tracker = await injector.get(TRACKER_REPOSITORY).create({
      name: 'Sleep',
      defaultTimeMode: 'point',
      fields: [
        { name: 'Satisfaction', dataType: 'integer', required: false },
        { name: 'Energy', dataType: 'singleSelect', required: false, options: ['low', 'high'] },
      ],
    });
    return { request: { trackerId: tracker.id } };
  },
});
