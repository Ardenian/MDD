import { DEFAULT_SETTINGS, type Settings } from '../../data/model/settings';
import { validateSettings } from './settings-validation';

describe('validateSettings', () => {
  it('accepts the documented defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects an expansion-depth cap below 1', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, expansionDepthCap: 0 };
    expect(validateSettings(settings).some((e) => e.field === 'expansionDepthCap')).toBe(true);
  });

  it('rejects a non-integer expansion-depth cap', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, expansionDepthCap: 2.5 };
    expect(validateSettings(settings).some((e) => e.field === 'expansionDepthCap')).toBe(true);
  });

  it('rejects a Lag range where min > max', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, lagRangeMin: 5, lagRangeMax: 3 },
    };
    expect(validateSettings(settings).some((e) => e.field === 'lagRange')).toBe(true);
  });

  it('allows a zero-width Lag range (lag-0 only)', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, lagRangeMin: 0, lagRangeMax: 0 },
    };
    expect(validateSettings(settings)).toEqual([]);
  });

  it('rejects a minimum sample size below 1', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, minSampleSize: 0 },
    };
    expect(validateSettings(settings).some((e) => e.field === 'minSampleSize')).toBe(true);
  });

  it('rejects a p-value threshold of 0 or above 1, accepts exactly 1', () => {
    const at0 = validateSettings({
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, pValueThreshold: 0 },
    });
    const above1 = validateSettings({
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, pValueThreshold: 1.5 },
    });
    const at1 = validateSettings({
      ...DEFAULT_SETTINGS,
      correlationDefaults: { ...DEFAULT_SETTINGS.correlationDefaults, pValueThreshold: 1 },
    });

    expect(at0.some((e) => e.field === 'pValueThreshold')).toBe(true);
    expect(above1.some((e) => e.field === 'pValueThreshold')).toBe(true);
    expect(at1.some((e) => e.field === 'pValueThreshold')).toBe(false);
  });
});
