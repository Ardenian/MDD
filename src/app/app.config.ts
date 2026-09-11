import {
  ApplicationConfig,
  ErrorHandler,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { DATA_PROVIDERS } from './core/providers/data-providers';
import { provideCalendarBootstrap } from './core/providers/calendar-bootstrap.provider';
import { GlobalErrorHandler } from './core/services/global-error-handler';
import { provideDesignTokens } from './ui/providers/design-tokens.provider';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    ...DATA_PROVIDERS,
    provideCalendarBootstrap(),
    provideDesignTokens(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
