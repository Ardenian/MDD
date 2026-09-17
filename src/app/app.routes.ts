import { Routes } from '@angular/router';

/**
 * Every feature route is lazy (ADR 0006's bundle discipline): the heavier CDK modules
 * each feature uses — drag-drop, tree, table — must never reach the initial chunk.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'calendar' },
  {
    path: 'calendar',
    loadChildren: () => import('./features/calendar/calendar.routes').then((m) => m.calendarRoutes),
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
    loadChildren: () => import('./features/settings/settings.routes').then((m) => m.settingsRoutes),
  },
  {
    path: 'data-transfer',
    title: 'Data Transfer',
    loadComponent: () =>
      import('./features/data-transfer/data-transfer-page').then((m) => m.DataTransferPage),
  },
  {
    // Feature-neutral dialog outlet: any feature opens the Entry form by URL rather than by
    // importing the entries feature (see EntryFormRoute).
    path: 'entry',
    outlet: 'modal',
    loadChildren: () => import('./features/entries/entries.routes').then((m) => m.entriesRoutes),
  },
  { path: '**', redirectTo: 'calendar' },
];
