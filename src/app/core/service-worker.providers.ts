import {
  type EnvironmentProviders,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../ui/services/toast.service';

/**
 * Caches the app shell so the app opens with no network on a repeat visit. Data offline
 * is the IndexedDB adapter's job — the worker caches no data (core/SPEC.md).
 */
export function provideOfflineShell(): EnvironmentProviders[] {
  return [
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      const updates = inject(SwUpdate);
      if (!updates.isEnabled) {
        return;
      }
      const toasts = inject(ToastService);
      const translate = inject(TranslateService);

      updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          toasts.show(translate.instant('serviceWorker.updateAvailable'));
        }
      });
    }),
  ];
}
