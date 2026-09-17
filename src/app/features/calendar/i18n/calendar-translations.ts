import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/calendar.json';
import en from './translations/en/calendar.json';

export const provideCalendarTranslations = () => provideFeatureTranslations({ en, de });
