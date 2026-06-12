import { Routes } from '@angular/router';

export const DOCUMENT_COLLABORATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/document-collaboration-editor/document-collaboration-editor').then(
        (m) => m.DocumentCollaborationEditor,
      ),
  },
];
