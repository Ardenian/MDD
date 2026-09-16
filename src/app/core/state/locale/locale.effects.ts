import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';
import { writeStoredLocale } from '../../i18n/locale-storage';
import { localeActions } from './locale.actions';

export const persistUiLocaleOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    return actions$.pipe(
      ofType(localeActions.languageSelected),
      tap(({ locale }) => writeStoredLocale(locale)),
    );
  },
  { functional: true, dispatch: false },
);

export const applyUiLocaleOnChange = createEffect(
  () => {
    const actions$ = inject(Actions);
    const translate = inject(TranslateService);
    return actions$.pipe(
      ofType(localeActions.languageSelected),
      tap(({ locale }) => translate.use(locale)),
    );
  },
  { functional: true, dispatch: false },
);

export const localeEffects = { persistUiLocaleOnChange, applyUiLocaleOnChange };
