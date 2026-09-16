import { FALLBACK_LOCALE, isSupportedLocale, type SupportedLocale } from './supported-locale';

export interface InitialLocale {
  locale: SupportedLocale;
  isExplicit: boolean;
}

export interface ResolveInitialLocaleInput {
  storedLocale: string | null;
  browserLanguages: readonly string[];
}

/**
 * A stored (explicitly chosen) locale always wins over the browser's. Among
 * browser languages, only the primary subtag ("de" out of "de-DE") is matched
 * against what this app actually supports.
 */
export function resolveInitialLocale(input: ResolveInitialLocaleInput): InitialLocale {
  if (isSupportedLocale(input.storedLocale)) {
    return { locale: input.storedLocale, isExplicit: true };
  }

  for (const browserLanguage of input.browserLanguages) {
    const primarySubtag = browserLanguage.split('-')[0];
    if (isSupportedLocale(primarySubtag)) {
      return { locale: primarySubtag, isExplicit: false };
    }
  }

  return { locale: FALLBACK_LOCALE, isExplicit: false };
}
