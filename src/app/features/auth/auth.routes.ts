import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { publicGuard } from '#/app/core/guards/public.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    component: Login,
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
