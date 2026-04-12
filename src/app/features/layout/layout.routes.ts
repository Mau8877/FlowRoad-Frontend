import { Routes } from '@angular/router';
import { Layout } from '#/app/features/layout/layout';

export const ROUTES: Routes = [
  {
    path: '',
    component: Layout, // El Layout es el PADRE ÚNICO
    children: [
      // 1. La página de inicio del panel
      {
        path: 'dashboard',
        loadComponent: () => import('#/app/features/dashboard/dashboard').then((m) => m.Dashboard),
      },

      // 2. El módulo de Configuración Organizacional (Lazy Loading)
      {
        path: 'config',
        loadChildren: () =>
          import('#/app/features/config-org/config-org.routes').then((m) => m.CONFIG_ORG_ROUTES),
      },

      // 3. Otros módulos (Usuarios, Trámites, etc.)
      /*{
        path: 'users',
        loadComponent: () => import('#/app/features/users/users').then((m) => m.UsersComponent),
      },*/

      // Redirección por defecto dentro del layout
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
