import { InjectionToken } from '@angular/core';
import { scenario } from '../../../../playwright/gallery/scenario';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { createInMemoryDataLayer, type DataLayer } from '../../data/testing/in-memory-data-layer';
import { provideSettingsTranslations } from './i18n/settings-translations';
import { SettingsPage } from './settings-page';

/**
 * One in-memory layer per mount — the harness builds a fresh injector each time, so the
 * factory runs again and no scenario inherits the last one's data. These are the same
 * fakes Vitest uses (`data/testing`), never a second set (ADR 0014).
 */
const DATA_LAYER = new InjectionToken<DataLayer>('scenario data layer', {
  factory: createInMemoryDataLayer,
});

/**
 * The Settings page against empty storage, which reads as the documented defaults. Form
 * validation needs the page on screen and nothing else — no app boot, no IndexedDB.
 */
export const defaults = scenario({
  component: SettingsPage,
  providers: [
    provideSettingsTranslations(),
    { provide: DATA_LAYER, useFactory: createInMemoryDataLayer },
    {
      provide: SETTINGS_REPOSITORY,
      useFactory: (layer: DataLayer) => layer.settings,
      deps: [DATA_LAYER],
    },
    {
      provide: MAINTENANCE_PORT,
      useFactory: (layer: DataLayer) => layer.maintenance,
      deps: [DATA_LAYER],
    },
  ],
});
