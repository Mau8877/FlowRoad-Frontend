import { Routes } from '@angular/router';
import { Layout } from '#/app/features/layout/layout';
import { authGuard } from '#/app/core/guards/auth.guard';
import { roleGuard } from '#/app/core/guards/role.guard';

export const ROUTES: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [authGuard], // Primer nivel: ¿Está logueado?
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard], // Segundo nivel: ¿Tiene permiso?
        data: { roles: ['ADMIN', 'DESIGNER', 'CLIENT', 'WORKER', 'RECEP'] },
        loadComponent: () => import('#/app/features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'config',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'DESIGNER'] },
        loadChildren: () =>
          import('#/app/features/config-org/config-org.routes').then((m) => m.CONFIG_ORG_ROUTES),
      },

      /*{
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('#/app/features/users/users').then((m) => m.UsersComponent),
      },*/

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
