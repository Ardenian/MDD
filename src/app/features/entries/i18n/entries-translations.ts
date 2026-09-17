import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/entries.json';
import en from './translations/en/entries.json';

export const provideEntriesTranslations = () => provideFeatureTranslations({ en, de });
