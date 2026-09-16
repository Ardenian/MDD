import type { Routes } from '@angular/router';
import { provideTrackersTranslations } from './i18n/trackers-translations';

/**
 * The feature's own strings are provided once for the whole route subtree, so they load
 * with this lazy chunk rather than the app shell (core/SPEC.md).
 */
export const trackersRoutes: Routes = [
  {
    path: '',
    providers: [provideTrackersTranslations()],
    children: [
      {
        path: '',
        title: 'Trackers',
        loadComponent: () => import('./trackers-page').then((m) => m.TrackersPage),
      },
      {
        path: ':trackerId',
        title: 'Tracker designer',
        loadComponent: () =>
          import('./tracker-designer-page').then((m) => m.TrackerDesignerPage),
      },
    ],
  },
];
