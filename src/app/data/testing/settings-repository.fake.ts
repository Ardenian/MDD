import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../model/settings';
import type { SettingsRepository } from '../ports/settings-repository';

export class FakeSettingsRepository implements SettingsRepository {
  private settings: Settings = DEFAULT_SETTINGS;

  async get(): Promise<Settings> {
    return this.settings;
  }

  async save(patch: SettingsPatch): Promise<Settings> {
    this.settings = {
      expansionDepthCap: patch.expansionDepthCap ?? this.settings.expansionDepthCap,
      correlationDefaults: {
        ...this.settings.correlationDefaults,
        ...patch.correlationDefaults,
      },
    };
    return this.settings;
  }

  /** Test-only reset, used by `FakeMaintenancePort`. */
  clear(): void {
    this.settings = DEFAULT_SETTINGS;
  }
}
