import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { DocumentCollaborationService } from '../../services/document-collaboration.service';

declare const DocsAPI: any;

@Component({
  selector: 'app-document-collaboration-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-collaboration-editor.html',
  styleUrl: './document-collaboration-editor.css',
})
export class DocumentCollaborationEditor implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentCollaborationService = inject(DocumentCollaborationService);

  private editor: any | null = null;
  private processInstanceId: string | null = null;
  private documentFileId: string | null = null;
  private returnTo: string | null = null;
  private assignmentId: string | null = null;

  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);
  public documentTitle = signal('Documento colaborativo');
  public modeLabel = signal('Modo lectura');

  ngOnInit(): void {
    this.processInstanceId = this.route.snapshot.paramMap.get('processInstanceId');
    this.documentFileId = this.route.snapshot.paramMap.get('documentFileId');
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    this.assignmentId = this.route.snapshot.queryParamMap.get('assignmentId');

    if (!this.processInstanceId || !this.documentFileId) {
      this.errorMessage.set('No se encontro el documento colaborativo solicitado.');
      return;
    }

    this.loadEditorConfig(this.documentFileId);
  }

  ngOnDestroy(): void {
    this.editor?.destroyEditor?.();
    this.editor = null;
  }

  goBack(): void {
    if (this.returnTo === 'assignment' && this.assignmentId) {
      this.router.navigate(['/process', 'tasks', this.assignmentId], {
        queryParams: { fromCollaboration: true },
      });
      return;
    }

    if (this.processInstanceId) {
      this.router.navigate(['/document-management', this.processInstanceId], {
        queryParams: { fromCollaboration: true },
      });
      return;
    }

    this.router.navigate(['/document-management']);
  }

  retry(): void {
    if (!this.documentFileId) {
      return;
    }

    this.loadEditorConfig(this.documentFileId);
  }

  refreshExpedient(): void {
    this.goBack();
  }

  private loadEditorConfig(documentFileId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.documentCollaborationService
      .getOnlyOfficeEditorConfig(documentFileId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: async (response) => {
          try {
            const editorMode = response.config?.['editorConfig']?.['mode'];
            this.documentTitle.set(
              response.config?.['document']?.['title'] ?? 'Documento colaborativo',
            );
            this.modeLabel.set(editorMode === 'edit' ? 'Edicion' : 'Solo lectura');
            await this.loadOnlyOfficeScript(response.documentServerUrl);
            this.createEditor(response.config);
          } catch (error) {
            console.error('[DOCUMENT-COLLABORATION][EDITOR_LOAD_ERROR]', error);
            this.errorMessage.set(
              'No se pudo cargar ONLYOFFICE. Verifica que el servidor este disponible.',
            );
          }
        },
        error: (error) => {
          console.error('[DOCUMENT-COLLABORATION][CONFIG_ERROR]', error);
          const message = String(error?.error?.message ?? '');
          this.errorMessage.set(
            message.includes('Solo se puede abrir un documento activo')
              ? 'El documento todavia se esta actualizando. Intenta nuevamente en unos segundos.'
              : error?.error?.message || 'No se pudo preparar la configuracion del editor.',
          );
        },
      });
  }

  private loadOnlyOfficeScript(documentServerUrl: string): Promise<void> {
    const scriptUrl = `${documentServerUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-onlyoffice-api="true"][src="${scriptUrl}"]`,
    );

    if ((window as any).DocsAPI) {
      return Promise.resolve();
    }

    if (existingScript) {
      return this.waitForExistingScript(existingScript);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.dataset['onlyofficeApi'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('ONLYOFFICE script load failed.'));
      document.body.appendChild(script);
    });
  }

  private waitForExistingScript(script: HTMLScriptElement): Promise<void> {
    if ((window as any).DocsAPI) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('ONLYOFFICE script load failed.')), {
        once: true,
      });
    });
  }

  private createEditor(config: Record<string, any>): void {
    if (!(window as any).DocsAPI) {
      throw new Error('DocsAPI no esta disponible.');
    }

    this.editor?.destroyEditor?.();
    this.editor = new DocsAPI.DocEditor('onlyoffice-editor', config);
  }
}
