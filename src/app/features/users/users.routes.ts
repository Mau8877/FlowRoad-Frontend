import { Routes } from '@angular/router';
import { UsersComponent } from './users';
import { roleGuard } from '#/app/core/guards/role.guard';

export const USER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },
    component: UsersComponent,
    title: 'Gestión de Usuarios | FlowRoad',
  },
];
