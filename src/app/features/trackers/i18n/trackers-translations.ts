import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/trackers.json';
import en from './translations/en/trackers.json';

export const provideTrackersTranslations = () => provideFeatureTranslations({ en, de });
