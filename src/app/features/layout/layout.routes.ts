import { Routes } from '@angular/router';
import { Layout } from '#/app/features/layout/layout';

export const ROUTES: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('#/app/features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'config',
        loadChildren: () =>
          import('#/app/features/config-org/config-org.routes').then((m) => m.CONFIG_ORG_ROUTES),
      },

      /*{
        path: 'users',
        loadComponent: () => import('#/app/features/users/users').then((m) => m.UsersComponent),
      },*/

      // Redirección por defecto dentro del layout
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
