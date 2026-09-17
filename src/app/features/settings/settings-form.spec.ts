import { DEFAULT_SETTINGS } from '../../data/model/settings';
import {
  draftFrom,
  patchFrom,
  problemFor,
  type SettingsDraft,
  validateSettings,
} from './settings-form';

function draft(overrides: Partial<SettingsDraft> = {}): SettingsDraft {
  return { ...draftFrom(null), ...overrides };
}

describe('draftFrom', () => {
  it('falls back to the documented defaults before anything has been saved', () => {
    expect(draftFrom(null)).toEqual({
      defaultBucketSize: 'day',
      defaultLagRange: { min: -3, max: 3 },
      guardrails: { minSampleSize: 10, pThreshold: 0.05, benjaminiHochberg: true },
      expansionDepthCap: 5,
      activeProfileId: 'offline',
    });
  });

  it('drops the record metadata, keeping only what the form edits', () => {
    const saved = {
      ...DEFAULT_SETTINGS,
      id: 'settings',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: null,
      revision: 2,
      ownerId: 'owner',
      userId: 'user',
      expansionDepthCap: 3,
    };

    expect(draftFrom(saved)).toEqual({ ...draftFrom(null), expansionDepthCap: 3 });
  });
});

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(draft())).toEqual([]);
  });

  describe('expansion-depth cap', () => {
    it('rejects a cap below 1', () => {
      expect(
        problemFor(validateSettings(draft({ expansionDepthCap: 0 })), 'expansionDepthCap'),
      ).toBe('below-minimum');
    });

    it('accepts a cap of exactly 1', () => {
      expect(validateSettings(draft({ expansionDepthCap: 1 }))).toEqual([]);
    });

    it('rejects a fractional cap rather than rounding it', () => {
      expect(
        problemFor(validateSettings(draft({ expansionDepthCap: 2.5 })), 'expansionDepthCap'),
      ).toBe('not-an-integer');
    });

    it('reports a blank cap as not a number', () => {
      expect(
        problemFor(validateSettings(draft({ expansionDepthCap: Number.NaN })), 'expansionDepthCap'),
      ).toBe('not-a-number');
    });
  });

  describe('Lag range', () => {
    it('accepts min below max', () => {
      expect(validateSettings(draft({ defaultLagRange: { min: -7, max: 7 } }))).toEqual([]);
    });

    it('accepts a zero-width range, which scans Lag 0 only', () => {
      expect(validateSettings(draft({ defaultLagRange: { min: 0, max: 0 } }))).toEqual([]);
    });

    it('rejects a range whose min is above its max', () => {
      expect(
        problemFor(validateSettings(draft({ defaultLagRange: { min: 2, max: -2 } })), 'lagRange'),
      ).toBe('range-inverted');
    });

    it('rejects fractional bounds — a Lag counts whole Buckets', () => {
      const problems = validateSettings(draft({ defaultLagRange: { min: -1.5, max: 3 } }));

      expect(problemFor(problems, 'lagMin')).toBe('not-an-integer');
      expect(problemFor(problems, 'lagMax')).toBeNull();
    });

    it('does not also report an inverted range when a bound is unreadable', () => {
      const problems = validateSettings(draft({ defaultLagRange: { min: Number.NaN, max: -2 } }));

      expect(problemFor(problems, 'lagMin')).toBe('not-a-number');
      expect(problemFor(problems, 'lagRange')).toBeNull();
    });
  });

  describe('guardrails', () => {
    it('rejects a minimum sample size below 1', () => {
      const problems = validateSettings(
        draft({ guardrails: { ...draft().guardrails, minSampleSize: 0 } }),
      );

      expect(problemFor(problems, 'minSampleSize')).toBe('below-minimum');
    });

    it('rejects a p threshold of 0', () => {
      const problems = validateSettings(
        draft({ guardrails: { ...draft().guardrails, pThreshold: 0 } }),
      );

      expect(problemFor(problems, 'pThreshold')).toBe('out-of-range');
    });

    it('accepts a p threshold of exactly 1', () => {
      expect(
        validateSettings(draft({ guardrails: { ...draft().guardrails, pThreshold: 1 } })),
      ).toEqual([]);
    });

    it('rejects a p threshold above 1', () => {
      const problems = validateSettings(
        draft({ guardrails: { ...draft().guardrails, pThreshold: 1.01 } }),
      );

      expect(problemFor(problems, 'pThreshold')).toBe('out-of-range');
    });

    it('allows a fractional p threshold', () => {
      expect(
        validateSettings(draft({ guardrails: { ...draft().guardrails, pThreshold: 0.001 } })),
      ).toEqual([]);
    });
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const problems = validateSettings(
      draft({
        expansionDepthCap: 0,
        defaultLagRange: { min: 5, max: 1 },
        guardrails: { minSampleSize: 0, pThreshold: 2, benjaminiHochberg: false },
      }),
    );

    expect(problems.map((problem) => problem.field)).toEqual([
      'expansionDepthCap',
      'lagRange',
      'minSampleSize',
      'pThreshold',
    ]);
  });
});

describe('patchFrom', () => {
  it('carries every editable value through, the Storage Profile included', () => {
    expect(patchFrom(draft({ expansionDepthCap: 4 }))).toEqual({
      defaultBucketSize: 'day',
      defaultLagRange: { min: -3, max: 3 },
      guardrails: { minSampleSize: 10, pThreshold: 0.05, benjaminiHochberg: true },
      expansionDepthCap: 4,
      activeProfileId: 'offline',
    });
  });
});
