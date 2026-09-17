import type { Routes } from '@angular/router';
import { provideDataTransferTranslations } from './i18n/data-transfer-translations';

export const dataTransferRoutes: Routes = [
  {
    path: '',
    providers: [provideDataTransferTranslations()],
    title: 'Data Transfer',
    loadComponent: () => import('./data-transfer-page').then((m) => m.DataTransferPage),
  },
];
