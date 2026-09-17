import type { Routes } from '@angular/router';
import { provideSettingsTranslations } from './i18n/settings-translations';

export const settingsRoutes: Routes = [
  {
    path: '',
    providers: [provideSettingsTranslations()],
    title: 'Settings',
    loadComponent: () => import('./settings-page').then((m) => m.SettingsPage),
  },
];
