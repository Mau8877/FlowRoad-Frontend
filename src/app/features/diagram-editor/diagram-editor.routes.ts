import { Routes } from '@angular/router';
import { DiagramEditor } from './diagram-editor';
import { GestionDiagramas } from './pages/gestion-diagramas/gestion-diagramas';

export const DIAGRAM_EDITOR_ROUTES: Routes = [
  {
    path: '',
    component: GestionDiagramas, // La tabla principal
  },
  {
    path: 'editor/:id',
    component: DiagramEditor, // Ruta para editar uno existente
  },
  // Opcional: Si quieres una ruta específica para creación que use el editor
  // aunque con la lógica de 'goToCreate' que hicimos, redirigimos directamente a 'editor/:id'
  {
    path: 'create/:id',
    component: DiagramEditor,
  },
];
