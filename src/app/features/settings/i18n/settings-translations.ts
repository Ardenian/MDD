import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/settings.json';
import en from './translations/en/settings.json';

export const provideSettingsTranslations = () => provideFeatureTranslations({ en, de });
