import type { AggregateMeta, Uuid } from './common';

export interface PresetFieldValue {
  readonly fieldName: string;
  /** Shape depends on the target Field's data type. */
  readonly value: unknown;
}

export interface PresetChild {
  readonly fieldName: string;
  readonly trackerId: Uuid;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}

/** Pinned to the Tracker Version it was authored against (CONTEXT.md: Preset). */
export interface Preset extends AggregateMeta {
  readonly trackerId: Uuid;
  readonly trackerVersion: number;
  readonly name: string;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}

export interface PresetInput {
  readonly trackerId: Uuid;
  readonly name: string;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}

export interface PresetPatch {
  readonly name?: string;
  readonly values?: readonly PresetFieldValue[];
  readonly children?: readonly PresetChild[];
}

/** A stale Preset still works when used; staleness only flags it for review (ADR 0005). */
export function isPresetStale(preset: Pick<Preset, 'trackerVersion'>, currentVersion: number): boolean {
  return preset.trackerVersion < currentVersion;
}
