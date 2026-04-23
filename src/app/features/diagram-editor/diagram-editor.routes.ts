import { Routes } from '@angular/router';
import { GestionDiagramas } from './pages/gestion-diagramas/gestion-diagramas';

export const DIAGRAM_EDITOR_ROUTES: Routes = [
  {
    path: '',
    component: GestionDiagramas, // La tabla principal
  },
];
