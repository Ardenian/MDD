import type { Routes } from '@angular/router';
import { provideEntriesTranslations } from './i18n/entries-translations';

/** Mounted in the app shell's `modal` outlet — see `EntryFormRoute`. */
export const entriesRoutes: Routes = [
  {
    path: '',
    providers: [provideEntriesTranslations()],
    children: [
      {
        path: 'new',
        loadComponent: () => import('./entry-form-route').then((m) => m.EntryFormRoute),
      },
      {
        path: ':entryId',
        loadComponent: () => import('./entry-form-route').then((m) => m.EntryFormRoute),
      },
    ],
  },
];
