import type { Provider } from '@angular/core';
import {
  provideChildTranslateService,
  provideTranslateLoader,
  type TranslateLoader,
  type TranslationObject,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { FALLBACK_LOCALE, isSupportedLocale, type SupportedLocale } from './supported-locale';

export type FeatureTranslations = Readonly<Record<SupportedLocale, TranslationObject>>;

/**
 * A feature's own strings, loaded with its lazy chunk and statically imported for the
 * same offline-first reason `common` is (core/SPEC.md). Any key the feature does not
 * define falls back to the root service, so shared chrome stays in `common`.
 */
export function provideFeatureTranslations(translations: FeatureTranslations): Provider[] {
  return provideChildTranslateService({
    loader: provideTranslateLoader((): TranslateLoader => ({
      getTranslation: (language: string) =>
        of(translations[isSupportedLocale(language) ? language : FALLBACK_LOCALE]),
    })),
  });
}
