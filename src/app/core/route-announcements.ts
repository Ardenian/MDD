import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  DestroyRef,
  type EnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';

/**
 * A route change moves focus nowhere by itself, so a screen-reader user gets no signal
 * that the page changed. Announcing the new page title through the shared live region
 * is the minimum that fixes it.
 */
export function provideRouteAnnouncements(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const router = inject(Router);
    const announcer = inject(LiveAnnouncer);
    const translate = inject(TranslateService);
    const destroyRef = inject(DestroyRef);

    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        const page = deepestTitle(router);
        if (page !== undefined) {
          void announcer.announce(translate.instant('app.routeAnnouncement', { page }), 'polite');
        }
      });
  });
}

function deepestTitle(router: Router): string | undefined {
  let route = router.routerState.snapshot.root;
  while (route.firstChild !== null) {
    route = route.firstChild;
  }
  return route.title;
}
