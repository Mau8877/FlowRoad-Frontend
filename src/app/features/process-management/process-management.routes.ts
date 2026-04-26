import { Routes } from '@angular/router';

import { ProcessManagement } from './process-management';

export const PROCESS_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    component: ProcessManagement,
  },
  {
    path: 'list',
    loadComponent: () =>
      import('./pages/process-create/process-create').then((m) => m.ProcessCreate),
  },
  {
    path: 'tasks/:assignmentId',
    loadComponent: () =>
      import('./pages/assignment-detail/assignment-detail').then((m) => m.AssignmentDetail),
  },
];
