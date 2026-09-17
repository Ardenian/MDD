import type { AggregateMeta } from './aggregate-meta';

export type BucketSize = 'hour' | 'day' | 'week' | 'month';

export interface LagRange {
  readonly min: number;
  readonly max: number;
}

export interface Guardrails {
  readonly minSampleSize: number;
  readonly pThreshold: number;
  readonly benjaminiHochberg: boolean;
}

export interface AppSettings extends AggregateMeta {
  readonly defaultBucketSize: BucketSize;
  readonly defaultLagRange: LagRange;
  readonly guardrails: Guardrails;
  readonly expansionDepthCap: number;
  /** Names the active Storage Profile; device-local, never exported (ADR 0009). */
  readonly activeProfileId: string;
}

export type SettingsPatch = Partial<
  Pick<
    AppSettings,
    'defaultBucketSize' | 'defaultLagRange' | 'guardrails' | 'expansionDepthCap' | 'activeProfileId'
  >
>;

/** Portable settings: everything except the device-local `activeProfileId` (ADR 0009). */
export type PortableSettings = Omit<SettingsPatch, 'activeProfileId'>;

export const SETTINGS_RECORD_ID = 'settings';

export const DEFAULT_SETTINGS = {
  defaultBucketSize: 'day',
  defaultLagRange: { min: -3, max: 3 },
  guardrails: { minSampleSize: 10, pThreshold: 0.05, benjaminiHochberg: true },
  expansionDepthCap: 5,
  activeProfileId: 'offline',
} as const satisfies Required<SettingsPatch>;
