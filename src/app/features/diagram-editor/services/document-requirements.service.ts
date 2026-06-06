import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DocumentRequirement,
  DocumentRequirementRequest,
} from '../interfaces/document-requirement.models';

@Injectable({
  providedIn: 'root',
})
export class DocumentRequirementsService {
  private readonly http = inject(HttpClient);
  private readonly URL = environment.BASE_URL;

  LIST_BY_NODE(diagramId: string, nodeId: string): Observable<DocumentRequirement[]> {
    return this.http.get<DocumentRequirement[]>(
      `${this.URL}/diagrams/${diagramId}/nodes/${nodeId}/document-requirements`,
    );
  }

  CREATE(
    diagramId: string,
    nodeId: string,
    payload: DocumentRequirementRequest,
  ): Observable<DocumentRequirement> {
    return this.http.post<DocumentRequirement>(
      `${this.URL}/diagrams/${diagramId}/nodes/${nodeId}/document-requirements`,
      payload,
    );
  }

  UPDATE(
    requirementId: string,
    payload: DocumentRequirementRequest,
  ): Observable<DocumentRequirement> {
    return this.http.put<DocumentRequirement>(
      `${this.URL}/document-requirements/${requirementId}`,
      payload,
    );
  }

  DELETE(requirementId: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/document-requirements/${requirementId}`);
  }
}
