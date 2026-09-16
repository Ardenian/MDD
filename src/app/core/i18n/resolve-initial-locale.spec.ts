import { resolveInitialLocale } from './resolve-initial-locale';

describe('resolveInitialLocale', () => {
  it('uses a stored supported locale over any browser language', () => {
    const result = resolveInitialLocale({
      storedLocale: 'de',
      browserLanguages: ['en-US'],
    });

    expect(result).toEqual({ locale: 'de', isExplicit: true });
  });

  it('ignores a stored locale that is not supported', () => {
    const result = resolveInitialLocale({
      storedLocale: 'fr',
      browserLanguages: ['de-DE'],
    });

    expect(result).toEqual({ locale: 'de', isExplicit: false });
  });

  it('falls back to the browser language when nothing is stored', () => {
    const result = resolveInitialLocale({
      storedLocale: null,
      browserLanguages: ['de-DE', 'en-US'],
    });

    expect(result).toEqual({ locale: 'de', isExplicit: false });
  });

  it('matches a browser language by its primary subtag', () => {
    const result = resolveInitialLocale({
      storedLocale: null,
      browserLanguages: ['en-GB'],
    });

    expect(result).toEqual({ locale: 'en', isExplicit: false });
  });

  it('skips unsupported browser languages before finding a supported one', () => {
    const result = resolveInitialLocale({
      storedLocale: null,
      browserLanguages: ['fr-FR', 'de-AT'],
    });

    expect(result).toEqual({ locale: 'de', isExplicit: false });
  });

  it('falls back to the default locale when nothing matches', () => {
    const result = resolveInitialLocale({
      storedLocale: null,
      browserLanguages: ['fr-FR', 'it-IT'],
    });

    expect(result).toEqual({ locale: 'en', isExplicit: false });
  });

  it('falls back to the default locale when no browser languages are given', () => {
    const result = resolveInitialLocale({
      storedLocale: null,
      browserLanguages: [],
    });

    expect(result).toEqual({ locale: 'en', isExplicit: false });
  });
});
