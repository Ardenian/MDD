import { Routes } from '@angular/router';

/**
 * Every feature route is lazy (ADR 0006's bundle discipline): the heavier CDK modules
 * each feature uses — drag-drop, tree, table — must never reach the initial chunk.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'calendar' },
  {
    path: 'calendar',
    title: 'Calendar',
    loadComponent: () => import('./features/calendar/calendar-page').then((m) => m.CalendarPage),
  },
  {
    path: 'trackers',
    loadChildren: () => import('./features/trackers/trackers.routes').then((m) => m.trackersRoutes),
  },
  {
    path: 'correlation',
    title: 'Correlation',
    loadComponent: () =>
      import('./features/correlation/correlation-page').then((m) => m.CorrelationPage),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: 'data-transfer',
    title: 'Data Transfer',
    loadComponent: () =>
      import('./features/data-transfer/data-transfer-page').then((m) => m.DataTransferPage),
  },
  { path: '**', redirectTo: 'calendar' },
];
