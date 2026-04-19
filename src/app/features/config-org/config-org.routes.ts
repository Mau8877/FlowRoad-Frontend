import { roleGuard } from '#/app/core/guards/role.guard';
import { Routes } from '@angular/router';
import { Cargos } from './pages/cargos/cargos';
import { Departamentos } from './pages/departamentos/departamentos';
import { Plantillas } from './pages/plantillas/plantillas';
import { PlantillasForm } from './pages/plantillas/plantillas-form/plantillas-form';

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
      {
        path: 'plantillas/create',
        component: PlantillasForm,
        title: 'Plantillas Documentales | FlowRoad',
      },
      {
        path: 'plantillas/edit/:id',
        component: PlantillasForm,
        title: 'Plantillas Documentales | FlowRoad',
      },
    ],
  },
];
