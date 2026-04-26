import { environment } from '#/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AssignmentResponse,
  ProcessAssignmentStatus,
} from '../interfaces/process-assignment.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessAssignmentService {
  private http = inject(HttpClient);

  private readonly PROCESS_ASSIGNMENTS_URL = `${environment.BASE_URL}/process-assignments`;

  GET_MY_ASSIGNMENTS(status?: ProcessAssignmentStatus): Observable<AssignmentResponse[]> {
    let params = new HttpParams();

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<AssignmentResponse[]>(`${this.PROCESS_ASSIGNMENTS_URL}/my`, {
      params,
    });
  }

  GET_MY_PENDING_ASSIGNMENTS(): Observable<AssignmentResponse[]> {
    return this.GET_MY_ASSIGNMENTS('PENDING');
  }

  GET_MY_COMPLETED_ASSIGNMENTS(): Observable<AssignmentResponse[]> {
    return this.GET_MY_ASSIGNMENTS('COMPLETED');
  }

  GET_BY_ID(assignmentId: string): Observable<AssignmentResponse> {
    return this.http.get<AssignmentResponse>(`${this.PROCESS_ASSIGNMENTS_URL}/${assignmentId}`);
  }
}
