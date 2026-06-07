import { Routes } from '@angular/router';

export const DOCUMENT_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/document-expedient-list/document-expedient-list').then(
        (m) => m.DocumentExpedientList,
      ),
  },
  {
    path: ':processInstanceId',
    loadComponent: () =>
      import('./pages/document-expedient-detail/document-expedient-detail').then(
        (m) => m.DocumentExpedientDetail,
      ),
  },
];
