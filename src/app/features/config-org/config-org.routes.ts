import { Routes } from '@angular/router';
import { roleGuard } from '#/app/core/guards/role.guard';
import { Cargos } from './pages/cargos/cargos';
import { Departamentos } from './pages/departamentos/departamentos';
import { Plantillas } from './pages/plantillas/plantillas';

export const CONFIG_ORG_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'DESIGNER'] },
    children: [
      {
        path: 'cargos',
        component: Cargos,
        title: 'Gestión de Cargos | FlowRoad',
      },
      {
        path: 'deptos',
        component: Departamentos,
        title: 'Gestión de Departamentos | FlowRoad',
      },
      {
        path: 'plantillas',
        component: Plantillas,
        title: 'Plantillas Documentales | FlowRoad',
      },
    ],
  },
];
