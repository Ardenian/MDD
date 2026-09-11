import type { MaintenancePort } from '../ports/maintenance-port';
import type { FakeCalendarRepository } from './calendar-repository.fake';
import type { FakeEntryRepository } from './entry-repository.fake';
import type { FakePresetRepository } from './preset-repository.fake';
import type { FakeSettingsRepository } from './settings-repository.fake';
import type { FakeTrackerRepository } from './tracker-repository.fake';

/**
 * A real `clearAll()` can't be expressed generically over interfaces alone (there's no
 * port method to wipe a repository) — this fake takes the concrete fakes it must reset,
 * mirroring what `MaintenancePortIndexedDbAdapter` does by clearing every IndexedDB
 * store and re-seeding the Calendar.
 */
export class FakeMaintenancePort implements MaintenancePort {
  constructor(
    private readonly trackerRepository: FakeTrackerRepository,
    private readonly entryRepository: FakeEntryRepository,
    private readonly presetRepository: FakePresetRepository,
    private readonly settingsRepository: FakeSettingsRepository,
    private readonly calendarRepository: FakeCalendarRepository,
  ) {}

  async clearAll(): Promise<void> {
    this.trackerRepository.clear();
    this.entryRepository.clear();
    this.presetRepository.clear();
    this.settingsRepository.clear();
    this.calendarRepository.clear();
    await this.calendarRepository.ensureExists();
  }
}
