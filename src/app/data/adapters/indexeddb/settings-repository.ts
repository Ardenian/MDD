import {
  type AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_RECORD_ID,
  type SettingsPatch,
} from '../../model/settings';
import type { SettingsRepository } from '../../ports/settings-repository';
import type { IdbEngine } from './idb-engine';
import { stampCreate, stampUpdate, type StampContext } from './record-meta';
import type { WriteQueue } from './write-queue';

export class IndexedDbSettingsRepository implements SettingsRepository {
  constructor(
    private readonly engine: IdbEngine,
    private readonly context: StampContext,
    private readonly queue: WriteQueue,
  ) {}

  /** Never writes: unsaved settings simply read as the documented fallbacks. */
  async get(): Promise<AppSettings> {
    const stored = await this.engine.get<AppSettings>('settings', SETTINGS_RECORD_ID);
    return stored ?? this.defaults();
  }

  async save(patch: SettingsPatch): Promise<AppSettings> {
    return this.queue.run(async () => {
      const stored = await this.engine.get<AppSettings>('settings', SETTINGS_RECORD_ID);
      const settings =
        stored === undefined
          ? { ...this.defaults(), ...patch }
          : stampUpdate(stored, patch, this.context);
      await this.engine.put('settings', SETTINGS_RECORD_ID, settings);
      return settings;
    });
  }

  private defaults(): AppSettings {
    return { ...stampCreate(DEFAULT_SETTINGS, this.context), id: SETTINGS_RECORD_ID };
  }
}
