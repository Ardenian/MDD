import { Routes } from '@angular/router';

/**
 * Top-level routes, each lazy-loaded (core/SPEC.md). Feature route targets are
 * placeholders until each feature's own `SPEC.md` is implemented.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'calendar' },
  {
    path: 'calendar',
    title: 'Calendar',
    loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
  },
  {
    path: 'trackers',
    title: 'Trackers',
    loadComponent: () => import('./features/trackers/trackers.page').then((m) => m.TrackersPage),
  },
  {
    path: 'correlation',
    title: 'Correlation',
    loadComponent: () => import('./features/correlation/correlation.page').then((m) => m.CorrelationPage),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },
];
