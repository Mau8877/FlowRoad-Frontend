import { environment } from '#/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CompleteAssignmentRequest } from '../interfaces/process-assignment.model';
import {
  CreateProcessInstanceRequest,
  ProcessInstanceDetailResponse,
  ProcessInstanceSummaryResponse,
} from '../interfaces/process-instance.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessInstanceService {
  private http = inject(HttpClient);

  private readonly PROCESS_INSTANCES_URL = `${environment.BASE_URL}/process-instances`;

  GET_ALL(): Observable<ProcessInstanceSummaryResponse[]> {
    return this.http.get<ProcessInstanceSummaryResponse[]>(this.PROCESS_INSTANCES_URL);
  }

  GET_BY_ID(
    processInstanceId: string,
    includeDiagram = false,
  ): Observable<ProcessInstanceDetailResponse> {
    const params = new HttpParams().set('includeDiagram', String(includeDiagram));

    return this.http.get<ProcessInstanceDetailResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}`,
      { params },
    );
  }

  CREATE(request: CreateProcessInstanceRequest): Observable<ProcessInstanceSummaryResponse> {
    return this.http.post<ProcessInstanceSummaryResponse>(this.PROCESS_INSTANCES_URL, request);
  }

  CANCEL(processInstanceId: string): Observable<ProcessInstanceSummaryResponse> {
    return this.http.put<ProcessInstanceSummaryResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}/cancel`,
      {},
    );
  }

  COMPLETE_ASSIGNMENT(
    processInstanceId: string,
    assignmentId: string,
    request: CompleteAssignmentRequest,
  ): Observable<ProcessInstanceDetailResponse> {
    return this.http.post<ProcessInstanceDetailResponse>(
      `${this.PROCESS_INSTANCES_URL}/${processInstanceId}/assignments/${assignmentId}/complete`,
      request,
    );
  }
}
