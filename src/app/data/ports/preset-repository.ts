import { InjectionToken } from '@angular/core';
import type { Uuid } from '../model/common';
import type { Preset, PresetInput, PresetPatch } from '../model/preset';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface PresetRepository {
  listByTracker(trackerId: Uuid): Promise<readonly Preset[]>;
  get(id: Uuid): Promise<Preset | null>;
  create(input: PresetInput): Promise<Preset>;
  update(id: Uuid, patch: PresetPatch): Promise<Preset>;
  delete(id: Uuid): Promise<void>;
}

export const PRESET_REPOSITORY = new InjectionToken<PresetRepository>('PresetRepository');
