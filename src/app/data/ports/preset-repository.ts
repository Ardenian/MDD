import { InjectionToken } from '@angular/core';
import type { Preset, PresetInput } from '../model/preset';

export interface PresetRepository {
  listByTracker(trackerId: string): Promise<readonly Preset[]>;
  /** Live Preset count per Tracker id, in one read — the Tracker list shows one per row. */
  countsByTracker(): Promise<ReadonlyMap<string, number>>;
  get(id: string): Promise<Preset | undefined>;
  /** Pins `trackerVersion` to the Tracker's `currentVersion` at call time. */
  create(input: PresetInput): Promise<Preset>;
  /** Re-pins to the Tracker's `currentVersion`, clearing staleness (ADR 0005). */
  update(id: string, input: PresetInput): Promise<Preset>;
  delete(id: string): Promise<void>;
}

export const PRESET_REPOSITORY = new InjectionToken<PresetRepository>('PresetRepository');
