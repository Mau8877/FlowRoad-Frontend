import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DocumentDownloadUrlResponse,
  DocumentManagementExpedientDetailResponse,
  DocumentManagementExpedientSummaryResponse,
  DocumentUploadResponse,
} from '../interfaces/document-expedient.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentExpedientService {
  private readonly http = inject(HttpClient);

  private readonly DOCUMENT_MANAGEMENT_URL = `${environment.BASE_URL}/document-management`;
  private readonly PROCESS_INSTANCES_URL = `${environment.BASE_URL}/process-instances`;

  getExpedients(): Observable<DocumentManagementExpedientSummaryResponse[]> {
    return this.http.get<DocumentManagementExpedientSummaryResponse[]>(
      `${this.DOCUMENT_MANAGEMENT_URL}/expedients`,
    );
  }

  getExpedient(processInstanceId: string): Observable<DocumentManagementExpedientDetailResponse> {
    return this.http.get<DocumentManagementExpedientDetailResponse>(
      `${this.DOCUMENT_MANAGEMENT_URL}/expedients/${processInstanceId}`,
    );
  }

  uploadDocument(
    processInstanceId: string,
    documentRequirementId: string,
    file: File,
    processAssignmentId?: string,
  ): Observable<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentRequirementId', documentRequirementId);

    if (processAssignmentId) {
      formData.append('processAssignmentId', processAssignmentId);
    }

    return this.http.post<DocumentUploadResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}/documents`,
      formData,
    );
  }

  replaceDocument(
    processInstanceId: string,
    documentFileId: string,
    file: File,
    processAssignmentId?: string,
  ): Observable<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (processAssignmentId) {
      formData.append('processAssignmentId', processAssignmentId);
    }

    return this.http.put<DocumentUploadResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}/documents/${documentFileId}/replace`,
      formData,
    );
  }

  getDownloadUrl(
    processInstanceId: string,
    documentFileId: string,
  ): Observable<DocumentDownloadUrlResponse> {
    return this.http.get<DocumentDownloadUrlResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}/documents/${documentFileId}/download-url`,
    );
  }
}
