import type { Settings } from '../../data/model/settings';

export interface SettingsValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * Validates a fully-merged Settings object (current settings + patch applied) rather
 * than a raw patch in isolation — a patch touching only `lagRangeMin`, say, can only be
 * judged valid or not once merged against whatever `lagRangeMax` already is.
 */
export function validateSettings(settings: Settings): readonly SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];

  if (!Number.isInteger(settings.expansionDepthCap) || settings.expansionDepthCap < 1) {
    errors.push({
      field: 'expansionDepthCap',
      message: 'Expansion depth cap must be an integer of at least 1.',
    });
  }

  const { correlationDefaults } = settings;

  if (correlationDefaults.lagRangeMin > correlationDefaults.lagRangeMax) {
    errors.push({ field: 'lagRange', message: 'Lag range minimum must be less than or equal to the maximum.' });
  }

  if (!Number.isInteger(correlationDefaults.minSampleSize) || correlationDefaults.minSampleSize < 1) {
    errors.push({ field: 'minSampleSize', message: 'Minimum sample size must be an integer of at least 1.' });
  }

  if (!(correlationDefaults.pValueThreshold > 0 && correlationDefaults.pValueThreshold <= 1)) {
    errors.push({ field: 'pValueThreshold', message: 'p-value threshold must be in (0, 1].' });
  }

  return errors;
}
