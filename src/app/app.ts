import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { isSupportedLocale, SUPPORTED_LOCALES, type SupportedLocale } from './core/i18n/supported-locale';
import { ToastList } from './ui/components/toast-list/toast-list';
import { ToastService } from './ui/services/toast.service';
import { UiLocaleService } from './ui/services/ui-locale.service';

interface NavItem {
  readonly path: string;
  readonly labelKey: string;
}

/**
 * The layout shell. `core/` is the bootstrapping root, the one exception to "only a
 * feature's top-level component injects a `ui/` service" (core/SPEC.md) — which is why
 * it may own the toast host and the locale switcher.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ToastList],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly uiLocale = inject(UiLocaleService);
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;
  protected readonly supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES;

  protected readonly navigation: readonly NavItem[] = [
    { path: '/calendar', labelKey: 'app.nav.calendar' },
    { path: '/trackers', labelKey: 'app.nav.trackers' },
    { path: '/correlation', labelKey: 'app.nav.correlation' },
    { path: '/settings', labelKey: 'app.nav.settings' },
    { path: '/data-transfer', labelKey: 'app.nav.dataTransfer' },
  ];

  protected onLocaleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isSupportedLocale(value)) {
      this.uiLocale.selectLanguage(value);
    }
  }

  protected dismissToast(id: string): void {
    this.toastService.dismiss(id);
  }
}
