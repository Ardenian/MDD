import type { AggregateMeta } from './aggregate-meta';

export interface PresetFieldValue {
  readonly fieldName: string;
  readonly value: unknown;
}

export interface PresetChild {
  readonly fieldName: string;
  readonly trackerId: string;
  readonly trackerVersion: number;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}

/** A reusable value bundle pinned to the Tracker Version it was authored against. */
export interface Preset extends AggregateMeta {
  readonly trackerId: string;
  readonly trackerVersion: number;
  readonly name: string;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}

export interface PresetInput {
  readonly trackerId: string;
  readonly name: string;
  readonly values: readonly PresetFieldValue[];
  readonly children: readonly PresetChild[];
}
