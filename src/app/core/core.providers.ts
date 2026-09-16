import { ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore, Store } from '@ngrx/store';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DesignTokenService } from '../ui/services/design-token.service';
import { ActivePortSet, provideDataAdapters } from './data-providers';
import { AppErrorHandler } from './error/app-error-handler';
import { FALLBACK_LOCALE } from './i18n/supported-locale';
import { StaticCommonTranslateLoader } from './i18n/static-translate-loader';
import { provideRouteAnnouncements } from './route-announcements';
import { provideOfflineShell } from './service-worker.providers';
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

/**
 * Everything the running app needs beyond state and i18n: the adapter set the active
 * Storage Profile resolves to, the design tokens, the single implicit Calendar, global
 * error handling, route announcements and the offline shell.
 */
export function provideCorePlatform() {
  return [
    ...provideCoreState(),
    ...provideDataAdapters(),
    { provide: ErrorHandler, useClass: AppErrorHandler },

    // Tokens go on before first render, so nothing paints unstyled (ADR 0007).
    provideAppInitializer(() => inject(DesignTokenService).apply()),

    provideAppInitializer(async () => {
      const ports = inject(ActivePortSet);
      await ports.bootstrap();
      await ports.get().maintenance.ensureCalendar();
    }),

    provideRouteAnnouncements(),
    ...provideOfflineShell(),
  ];
}
