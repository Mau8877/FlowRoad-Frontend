import { Routes } from '@angular/router';
import { Layout } from './features/layout/layout';

export const routes: Routes = [
  // ZONA PÚBLICA (Sin Layout)
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // ZONA PRIVADA (Todo bajo el mismo Layout)
  {
    path: '',
    component: Layout, // 👈 EL ÚNICO LAYOUT
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'config',
        loadChildren: () =>
          import('./features/config-org/config-org.routes').then((m) => m.CONFIG_ORG_ROUTES),
      },
      // Si entran a la raíz estando logueados, los mandamos al dashboard
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Redirección global
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
];
