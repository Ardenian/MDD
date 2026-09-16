const LOCALE_STORAGE_KEY = 'diary-calendar.uiLocale';

export function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage disabled or unavailable (e.g. private browsing) — treat as unset.
    return null;
  }
}

export function writeStoredLocale(locale: string): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage disabled or unavailable — the choice just won't survive a reload.
  }
}
