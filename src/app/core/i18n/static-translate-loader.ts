import { Injectable } from '@angular/core';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import { type Observable, of } from 'rxjs';
import { FALLBACK_LOCALE, isSupportedLocale } from './supported-locale';
import de from './translations/de/common.json';
import en from './translations/en/common.json';

const COMMON_TRANSLATIONS: Record<string, TranslationObject> = { en, de };

/**
 * Statically imports the "common" namespace instead of fetching it over HTTP:
 * this app is offline-first (ADR 0003) with no service-worker asset caching
 * yet, so a loader with zero runtime network dependency is the safer default.
 */
@Injectable()
export class StaticCommonTranslateLoader extends TranslateLoader {
  override getTranslation(lang: string): Observable<TranslationObject> {
    const locale = isSupportedLocale(lang) ? lang : FALLBACK_LOCALE;
    return of(COMMON_TRANSLATIONS[locale]);
  }
}
