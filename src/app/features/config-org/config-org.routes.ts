import { Routes } from '@angular/router';
import { Cargos } from './pages/cargos/cargos';
import { Departamentos } from './pages/departamentos/departamentos';
import { Plantillas } from './pages/plantillas/plantillas';

export const CONFIG_ORG_ROUTES: Routes = [
  {
    path: '',
    children: [
      { path: 'cargos', component: Cargos },
      { path: 'deptos', component: Departamentos },
      { path: 'plantillas', component: Plantillas },
    ],
  },
];
