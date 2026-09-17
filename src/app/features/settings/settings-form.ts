import { type AppSettings, DEFAULT_SETTINGS, type SettingsPatch } from '../../data/model/settings';

/** Exactly the values the Settings page edits — the ADR 0003 record fields stay behind. */
export type SettingsDraft = Required<SettingsPatch>;

export type SettingsField =
  'expansionDepthCap' | 'lagMin' | 'lagMax' | 'lagRange' | 'minSampleSize' | 'pThreshold';

export type SettingsProblemCode =
  'not-a-number' | 'not-an-integer' | 'below-minimum' | 'range-inverted' | 'out-of-range';

export interface SettingsProblem {
  readonly field: SettingsField;
  readonly problem: SettingsProblemCode;
}

/** Unsaved settings read as the documented fallbacks, so the form starts from them too. */
export function draftFrom(saved: AppSettings | null): SettingsDraft {
  const source = saved ?? DEFAULT_SETTINGS;
  return {
    defaultBucketSize: source.defaultBucketSize,
    defaultLagRange: { ...source.defaultLagRange },
    guardrails: { ...source.guardrails },
    expansionDepthCap: source.expansionDepthCap,
    activeProfileId: source.activeProfileId,
  };
}

export function patchFrom(draft: SettingsDraft): SettingsPatch {
  return draft;
}

export function validateSettings(draft: SettingsDraft): readonly SettingsProblem[] {
  const problems: SettingsProblem[] = [];

  const cap = wholeNumberProblem(draft.expansionDepthCap, 1);
  if (cap !== null) {
    problems.push({ field: 'expansionDepthCap', problem: cap });
  }

  // A Lag counts whole Buckets in either direction, so both bounds are plain integers.
  const min = wholeNumberProblem(draft.defaultLagRange.min);
  const max = wholeNumberProblem(draft.defaultLagRange.max);
  if (min !== null) {
    problems.push({ field: 'lagMin', problem: min });
  }
  if (max !== null) {
    problems.push({ field: 'lagMax', problem: max });
  }
  // Only compare bounds that are readable — otherwise a half-typed number reads as a
  // second, confusing problem about the range as a whole.
  if (min === null && max === null && draft.defaultLagRange.min > draft.defaultLagRange.max) {
    problems.push({ field: 'lagRange', problem: 'range-inverted' });
  }

  const sample = wholeNumberProblem(draft.guardrails.minSampleSize, 1);
  if (sample !== null) {
    problems.push({ field: 'minSampleSize', problem: sample });
  }

  const p = draft.guardrails.pThreshold;
  if (Number.isNaN(p)) {
    problems.push({ field: 'pThreshold', problem: 'not-a-number' });
  } else if (p <= 0 || p > 1) {
    // Zero would accept nothing at all, and above 1 is not a probability.
    problems.push({ field: 'pThreshold', problem: 'out-of-range' });
  }

  return problems;
}

export function problemFor(
  problems: readonly SettingsProblem[],
  field: SettingsField,
): SettingsProblemCode | null {
  return problems.find((problem) => problem.field === field)?.problem ?? null;
}

function wholeNumberProblem(value: number, minimum?: number): SettingsProblemCode | null {
  if (Number.isNaN(value)) {
    return 'not-a-number';
  }
  if (!Number.isInteger(value)) {
    return 'not-an-integer';
  }
  if (minimum !== undefined && value < minimum) {
    return 'below-minimum';
  }
  return null;
}
