import { inject, Service } from '@angular/core';
import { Store } from '@ngrx/store';
import { localeActions } from '../../core/state/locale/locale.actions';
import { localeFeature } from '../../core/state/locale/locale.feature';
import type { SupportedLocale } from '../../core/i18n/supported-locale';

/**
 * The only thing presentation code injects for locale (ADR 0010) — never the
 * raw NgRx Store. A feature's top-level component reads `uiLocale` and calls
 * `selectLanguage` for a Settings-style language picker.
 */
@Service()
export class UiLocaleService {
  private readonly store = inject(Store);

  readonly uiLocale = this.store.selectSignal(localeFeature.selectUiLocale);
  readonly isExplicit = this.store.selectSignal(localeFeature.selectIsExplicit);

  selectLanguage(locale: SupportedLocale): void {
    this.store.dispatch(localeActions.languageSelected({ locale }));
  }
}
