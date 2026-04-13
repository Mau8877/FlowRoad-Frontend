import { Routes } from '@angular/router';
import { Layout } from './features/layout/layout';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // ZONA PÚBLICA (Sin Layout)
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // ZONA PRIVADA (Todo bajo el mismo Layout)
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'DESIGNER', 'CLIENT', 'WORKER', 'RECEP'] },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'config',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'DESIGNER'] },
        loadChildren: () =>
          import('./features/config-org/config-org.routes').then((m) => m.CONFIG_ORG_ROUTES),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USER_ROUTES),
      },
      // Si entran a la raíz estando logueados, los mandamos al dashboard
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Redirección global
  { path: '**', redirectTo: 'auth', pathMatch: 'full' },
];
