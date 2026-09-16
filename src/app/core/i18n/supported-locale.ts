export const SUPPORTED_LOCALES = ['en', 'de'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const FALLBACK_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '');
}
