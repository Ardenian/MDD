import { createFeature, createReducer, on } from '@ngrx/store';
import { readStoredLocale } from '../../i18n/locale-storage';
import { resolveInitialLocale } from '../../i18n/resolve-initial-locale';
import type { SupportedLocale } from '../../i18n/supported-locale';
import { localeActions } from './locale.actions';

export interface LocaleState {
  uiLocale: SupportedLocale;
  isExplicit: boolean;
}

function readInitialLocaleState(): LocaleState {
  const resolved = resolveInitialLocale({
    storedLocale: readStoredLocale(),
    browserLanguages: navigator.languages ?? [navigator.language],
  });
  return { uiLocale: resolved.locale, isExplicit: resolved.isExplicit };
}

export const localeFeature = createFeature({
  name: 'locale',
  reducer: createReducer(
    readInitialLocaleState(),
    on(
      localeActions.languageSelected,
      (_state, { locale }): LocaleState => ({ uiLocale: locale, isExplicit: true }),
    ),
  ),
});
