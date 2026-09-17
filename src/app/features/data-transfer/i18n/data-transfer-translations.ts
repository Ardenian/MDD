import { provideFeatureTranslations } from '../../../core/i18n/feature-translations';
import de from './translations/de/data-transfer.json';
import en from './translations/en/data-transfer.json';

export const provideDataTransferTranslations = () => provideFeatureTranslations({ en, de });
