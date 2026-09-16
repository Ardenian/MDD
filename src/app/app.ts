import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { isSupportedLocale, SUPPORTED_LOCALES, type SupportedLocale } from './core/i18n/supported-locale';
import { UiLocaleService } from './ui/services/ui-locale.service';

@Component({
  imports: [RouterOutlet, TranslatePipe],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('ArdAngularSkeleton');

  // core/ is the bootstrapping root, the one exception to "only a feature's
  // top-level component injects a ui/ service" (core/SPEC.md).
  protected readonly uiLocale = inject(UiLocaleService);
  protected readonly supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES;

  protected onLocaleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isSupportedLocale(value)) {
      this.uiLocale.selectLanguage(value);
    }
  }
}
