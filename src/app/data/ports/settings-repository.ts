import { InjectionToken } from '@angular/core';
import type { Settings, SettingsPatch } from '../model/settings';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface SettingsRepository {
  get(): Promise<Settings>;
  save(patch: SettingsPatch): Promise<Settings>;
}

export const SETTINGS_REPOSITORY = new InjectionToken<SettingsRepository>('SettingsRepository');
