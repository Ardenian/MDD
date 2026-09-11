import { Injectable } from '@angular/core';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../../model/settings';
import type { SettingsRepository } from '../../ports/settings-repository';
import { STORE } from './database';
import { getRecord, putRecord } from './store.util';

const SETTINGS_KEY = 'settings';

interface SettingsRecord extends Settings {
  readonly id: typeof SETTINGS_KEY;
}

@Injectable()
export class SettingsRepositoryIndexedDbAdapter implements SettingsRepository {
  async get(): Promise<Settings> {
    const record = await getRecord<SettingsRecord>(STORE.settings, SETTINGS_KEY);
    return record ?? DEFAULT_SETTINGS;
  }

  async save(patch: SettingsPatch): Promise<Settings> {
    const current = await this.get();
    const updated: SettingsRecord = {
      id: SETTINGS_KEY,
      expansionDepthCap: patch.expansionDepthCap ?? current.expansionDepthCap,
      correlationDefaults: {
        ...current.correlationDefaults,
        ...patch.correlationDefaults,
      },
    };
    return putRecord(STORE.settings, updated);
  }
}
