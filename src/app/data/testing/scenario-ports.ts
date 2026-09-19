import { InjectionToken, type Provider } from '@angular/core';
import { CORRELATION_DATA_SOURCE } from '../ports/correlation-data-source';
import { ENTRY_REPOSITORY } from '../ports/entry-repository';
import { MAINTENANCE_PORT } from '../ports/maintenance-port';
import { PRESET_REPOSITORY } from '../ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../ports/settings-repository';
import { TAG_REPOSITORY } from '../ports/tag-repository';
import { TRACKER_REPOSITORY } from '../ports/tracker-repository';
import { createInMemoryDataLayer, type DataLayer } from './in-memory-data-layer';

/**
 * The one in-memory layer every port in a scenario reads from, so a Tracker created
 * through `TRACKER_REPOSITORY` is the same Tracker `ENTRY_REPOSITORY` pins against.
 */
export const SCENARIO_DATA_LAYER = new InjectionToken<DataLayer>('scenario data layer');

/**
 * Binds all seven `data/` ports to one in-memory layer, for a mount-harness scenario
 * (ADR 0014). These are the same fakes Vitest runs against, never a second set.
 *
 * The layer is built by a factory, so each scenario injector gets its own and no mount
 * inherits the last one's data.
 */
export function provideInMemoryPorts(): Provider[] {
  const fromLayer = <K extends keyof DataLayer>(key: K): Provider[] => [
    {
      provide: portToken(key),
      useFactory: (layer: DataLayer) => layer[key],
      deps: [SCENARIO_DATA_LAYER],
    },
  ];

  return [
    { provide: SCENARIO_DATA_LAYER, useFactory: () => createInMemoryDataLayer() },
    ...fromLayer('trackers'),
    ...fromLayer('entries'),
    ...fromLayer('presets'),
    ...fromLayer('tags'),
    ...fromLayer('settings'),
    ...fromLayer('correlation'),
    ...fromLayer('maintenance'),
  ];
}

function portToken(key: keyof DataLayer): InjectionToken<unknown> {
  switch (key) {
    case 'trackers':
      return TRACKER_REPOSITORY;
    case 'entries':
      return ENTRY_REPOSITORY;
    case 'presets':
      return PRESET_REPOSITORY;
    case 'tags':
      return TAG_REPOSITORY;
    case 'settings':
      return SETTINGS_REPOSITORY;
    case 'correlation':
      return CORRELATION_DATA_SOURCE;
    case 'maintenance':
      return MAINTENANCE_PORT;
    default:
      throw new Error(`No port token for "${String(key)}"`);
  }
}
