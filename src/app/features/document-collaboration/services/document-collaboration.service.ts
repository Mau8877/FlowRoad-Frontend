import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface OnlyOfficeEditorConfigResponse {
  documentServerUrl: string;
  config: Record<string, any>;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentCollaborationService {
  private readonly http = inject(HttpClient);
  private readonly ONLYOFFICE_URL = `${environment.BASE_URL}/document-collaboration/onlyoffice`;

  getOnlyOfficeEditorConfig(documentFileId: string): Observable<OnlyOfficeEditorConfigResponse> {
    return this.http.post<OnlyOfficeEditorConfigResponse>(
      `${this.ONLYOFFICE_URL}/files/${documentFileId}/editor-config`,
      {},
    );
  }
}
