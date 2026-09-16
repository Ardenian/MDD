import { InjectionToken } from '@angular/core';
import type { AppSettings, SettingsPatch } from '../model/settings';

export interface SettingsRepository {
  /** Returns the documented fallback values when nothing has been saved yet. */
  get(): Promise<AppSettings>;
  save(patch: SettingsPatch): Promise<AppSettings>;
}

export const SETTINGS_REPOSITORY = new InjectionToken<SettingsRepository>('SettingsRepository');
