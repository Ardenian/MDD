import type { Routes } from '@angular/router';
import { provideCorrelationTranslations } from './i18n/correlation-translations';

export const correlationRoutes: Routes = [
  {
    path: '',
    providers: [provideCorrelationTranslations()],
    title: 'Correlation',
    loadComponent: () => import('./correlation-page').then((m) => m.CorrelationPage),
  },
];
