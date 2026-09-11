export type BucketSize = 'hour' | 'day' | 'week' | 'month';

export interface CorrelationDefaults {
  readonly bucketSize: BucketSize;
  readonly lagRangeMin: number;
  readonly lagRangeMax: number;
  readonly minSampleSize: number;
  readonly pValueThreshold: number;
  readonly benjaminiHochberg: boolean;
}

export interface Settings {
  readonly correlationDefaults: CorrelationDefaults;
  readonly expansionDepthCap: number;
}

export const DEFAULT_SETTINGS: Settings = {
  correlationDefaults: {
    bucketSize: 'day',
    lagRangeMin: -3,
    lagRangeMax: 3,
    minSampleSize: 10,
    pValueThreshold: 0.05,
    benjaminiHochberg: true,
  },
  expansionDepthCap: 5,
};

export interface SettingsPatch {
  readonly correlationDefaults?: Partial<CorrelationDefaults>;
  readonly expansionDepthCap?: number;
}
