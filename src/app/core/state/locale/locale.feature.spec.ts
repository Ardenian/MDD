import { localeActions } from './locale.actions';
import { localeFeature, type LocaleState } from './locale.feature';

describe('locale reducer', () => {
  it('sets the chosen locale and marks it explicit on Language Selected', () => {
    const previousState: LocaleState = { uiLocale: 'en', isExplicit: false };

    const nextState = localeFeature.reducer(
      previousState,
      localeActions.languageSelected({ locale: 'de' }),
    );

    expect(nextState).toEqual({ uiLocale: 'de', isExplicit: true });
  });
});
