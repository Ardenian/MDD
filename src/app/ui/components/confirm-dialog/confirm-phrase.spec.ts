import { matchesConfirmPhrase } from './confirm-phrase';

describe('matchesConfirmPhrase', () => {
  it('accepts the exact phrase', () => {
    expect(matchesConfirmPhrase('clear', 'clear')).toBe(true);
  });

  it('accepts a different case — the guard is deliberateness, not accuracy', () => {
    expect(matchesConfirmPhrase('CLEAR', 'clear')).toBe(true);
  });

  it('accepts surrounding whitespace, which a paste or a trailing space adds', () => {
    expect(matchesConfirmPhrase('  clear ', 'clear')).toBe(true);
  });

  it('rejects anything else, including a prefix of the phrase', () => {
    expect(matchesConfirmPhrase('clea', 'clear')).toBe(false);
    expect(matchesConfirmPhrase('clear everything', 'clear')).toBe(false);
  });

  it('rejects an empty box, so the dialog never opens ready to fire', () => {
    expect(matchesConfirmPhrase('', 'clear')).toBe(false);
    expect(matchesConfirmPhrase('   ', 'clear')).toBe(false);
  });

  it('matches a translated phrase the same way', () => {
    expect(matchesConfirmPhrase('Löschen', 'löschen')).toBe(true);
  });
});
