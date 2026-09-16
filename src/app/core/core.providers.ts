import { inject, provideAppInitializer } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore, Store } from '@ngrx/store';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { FALLBACK_LOCALE } from './i18n/supported-locale';
import { StaticCommonTranslateLoader } from './i18n/static-translate-loader';
import { identityFeature } from './state/identity/identity.feature';
import { localeEffects } from './state/locale/locale.effects';
import { localeFeature } from './state/locale/locale.feature';

export function provideCoreState() {
  return [
    provideStore(),
    provideState(localeFeature),
    provideState(identityFeature),
    provideEffects(localeEffects),
    ...provideTranslateService({
      loader: StaticCommonTranslateLoader,
      fallbackLang: FALLBACK_LOCALE,
    }),
    provideAppInitializer(() => {
      const store = inject(Store);
      const translate = inject(TranslateService);
      return firstValueFrom(translate.use(store.selectSignal(localeFeature.selectUiLocale)()));
    }),
  ];
}
