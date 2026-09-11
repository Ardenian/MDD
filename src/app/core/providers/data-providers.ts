import type { Provider } from '@angular/core';
import { CalendarRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/calendar-repository.adapter';
import { CorrelationDataSourceIndexedDbAdapter } from '../../data/adapters/indexeddb/correlation-data-source.adapter';
import { EntryRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/entry-repository.adapter';
import { MaintenancePortIndexedDbAdapter } from '../../data/adapters/indexeddb/maintenance-port.adapter';
import { PresetRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/preset-repository.adapter';
import { SettingsRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/settings-repository.adapter';
import { TagRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/tag-repository.adapter';
import { TrackerRepositoryIndexedDbAdapter } from '../../data/adapters/indexeddb/tracker-repository.adapter';
import { TRACKER_LOOKUP, TrackerLookupFacade } from '../../data/facades/tracker-lookup';
import { CALENDAR_REPOSITORY } from '../../data/ports/calendar-repository';
import { CORRELATION_DATA_SOURCE } from '../../data/ports/correlation-data-source';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { IDENTITY_CONTEXT } from '../../data/ports/identity-context';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TAG_REPOSITORY } from '../../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { DevIdentityContext } from '../services/identity-context.service';

/**
 * The single switch point (ADR 0002 / ADR 0003): every port binds to its IndexedDB
 * adapter today. Swapping to a backend later means changing only this file's
 * `useClass` values (or selecting between two sets by environment) — no feature code
 * changes, because features never see these tokens directly (only facades do).
 */
export const DATA_PROVIDERS: Provider[] = [
  { provide: IDENTITY_CONTEXT, useClass: DevIdentityContext },
  { provide: TRACKER_REPOSITORY, useClass: TrackerRepositoryIndexedDbAdapter },
  { provide: ENTRY_REPOSITORY, useClass: EntryRepositoryIndexedDbAdapter },
  { provide: PRESET_REPOSITORY, useClass: PresetRepositoryIndexedDbAdapter },
  { provide: TAG_REPOSITORY, useClass: TagRepositoryIndexedDbAdapter },
  { provide: SETTINGS_REPOSITORY, useClass: SettingsRepositoryIndexedDbAdapter },
  { provide: CORRELATION_DATA_SOURCE, useClass: CorrelationDataSourceIndexedDbAdapter },
  { provide: MAINTENANCE_PORT, useClass: MaintenancePortIndexedDbAdapter },
  { provide: CALENDAR_REPOSITORY, useClass: CalendarRepositoryIndexedDbAdapter },
  { provide: TRACKER_LOOKUP, useClass: TrackerLookupFacade },
];
