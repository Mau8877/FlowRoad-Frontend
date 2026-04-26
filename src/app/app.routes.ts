import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { DiagramEditor } from './features/diagram-editor/diagram-editor';
import { Layout } from './features/layout/layout';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // RUTAS PRIVADAS SIN LAYOUT PARA EL EDITOR
  {
    path: 'diagram/editor/:id',
    component: DiagramEditor,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'DESIGNER'] },
  },
  {
    path: 'diagram/create/:id',
    component: DiagramEditor,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'DESIGNER'] },
  },

  // RUTAS PRIVADAS CON LAYOUT
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
      {
        path: 'diagram',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'DESIGNER'] },
        loadChildren: () =>
          import('./features/diagram-editor/diagram-editor.routes').then(
            (m) => m.DIAGRAM_EDITOR_ROUTES,
          ),
      },
      {
        path: 'process',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'WORKER', 'RECEP'] },
        loadChildren: () =>
          import('./features/process-management/process-management.routes').then(
            (m) => m.PROCESS_MANAGEMENT_ROUTES,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'auth', pathMatch: 'full' },
];
