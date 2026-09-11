import { Injectable, InjectionToken, inject } from '@angular/core';
import { dataError } from '../../data/model/data-error';
import type { Settings, SettingsPatch } from '../../data/model/settings';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { validateSettings } from './settings-validation';

export interface RecordCounts {
  readonly trackers: number;
  readonly entries: number;
  readonly presets: number;
}

// listByRange has no "all time" sentinel — these bounds comfortably cover any real
// Entry, since the app didn't exist before 1970 and won't still be running in 9999.
const ALL_TIME_START = '1970-01-01T00:00:00.000Z';
const ALL_TIME_END = '9999-12-31T23:59:59.999Z';

/**
 * Feature-local facade (ADR 0002): the Settings page's only way to reach
 * `SettingsRepository` and `MaintenancePort`. The Correlation and Trackers features
 * read defaults by injecting `SettingsRepository` themselves (`settings/SPEC.md`) —
 * this facade is not a shared dependency of theirs.
 */
export interface SettingsFacade {
  getSettings(): Promise<Settings>;
  /** Validates the merged (current + patch) result; throws `DataError('invalid-input')`
   *  without saving anything if it fails. */
  saveSettings(patch: SettingsPatch): Promise<Settings>;
  recordCounts(): Promise<RecordCounts>;
  clearAllData(): Promise<void>;
}

export const SETTINGS_FACADE = new InjectionToken<SettingsFacade>('SettingsFacade');

@Injectable()
export class SettingsFacadeService implements SettingsFacade {
  private readonly settingsRepository = inject(SETTINGS_REPOSITORY);
  private readonly maintenancePort = inject(MAINTENANCE_PORT);
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);
  private readonly entryRepository = inject(ENTRY_REPOSITORY);
  private readonly presetRepository = inject(PRESET_REPOSITORY);

  getSettings(): Promise<Settings> {
    return this.settingsRepository.get();
  }

  async saveSettings(patch: SettingsPatch): Promise<Settings> {
    const current = await this.settingsRepository.get();
    const merged: Settings = {
      expansionDepthCap: patch.expansionDepthCap ?? current.expansionDepthCap,
      correlationDefaults: { ...current.correlationDefaults, ...patch.correlationDefaults },
    };

    const errors = validateSettings(merged);
    if (errors.length > 0) {
      throw dataError('invalid-input', 'Settings failed validation', errors);
    }

    return this.settingsRepository.save(patch);
  }

  async recordCounts(): Promise<RecordCounts> {
    const trackers = await this.trackerRepository.list();
    const entries = await this.entryRepository.listByRange(ALL_TIME_START, ALL_TIME_END, {
      includeChildren: true,
    });
    const presetsByTracker = await Promise.all(
      trackers.map((tracker) => this.presetRepository.listByTracker(tracker.id)),
    );

    return {
      trackers: trackers.length,
      entries: entries.length,
      presets: presetsByTracker.reduce((sum, presets) => sum + presets.length, 0),
    };
  }

  clearAllData(): Promise<void> {
    return this.maintenancePort.clearAll();
  }
}
