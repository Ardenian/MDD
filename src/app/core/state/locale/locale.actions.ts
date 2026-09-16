import { createActionGroup, props } from '@ngrx/store';
import type { SupportedLocale } from '../../i18n/supported-locale';

export const localeActions = createActionGroup({
  source: 'Locale',
  events: {
    'Language Selected': props<{ locale: SupportedLocale }>(),
  },
});
