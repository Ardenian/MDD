import type { Routes } from '@angular/router';
import { provideCalendarTranslations } from './i18n/calendar-translations';

export const calendarRoutes: Routes = [
  {
    path: '',
    providers: [provideCalendarTranslations()],
    title: 'Calendar',
    loadComponent: () => import('./calendar-page').then((m) => m.CalendarPage),
  },
];
