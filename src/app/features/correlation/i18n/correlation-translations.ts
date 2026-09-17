import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/correlation.json';
import en from './translations/en/correlation.json';

export const provideCorrelationTranslations = () => provideFeatureTranslations({ en, de });
