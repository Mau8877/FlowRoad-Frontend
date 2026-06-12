import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '#/environments/environment';
import {
  ClientSearchResponse,
  UserResponse,
  RegisterWorkerRequest,
  UpdateUserRequest,
} from '../interfaces/users.model';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Rutas base según tus controllers
  private readonly USERS_URL = `${environment.BASE_URL}/users`;
  private readonly AUTH_URL = `${environment.BASE_URL}/auth`;

  GET_BY_ORGANIZATION(): Observable<UserResponse[]> {
    const orgId = this.authService.currentUser()?.orgId;
    if (!orgId) return throwError(() => new Error('Organización no identificada'));
    return this.http.get<UserResponse[]>(`${this.USERS_URL}/organization/${orgId}`);
  }

  // Se registra a través de /auth/register-worker
  searchClients(query: string, limit = 10): Observable<ClientSearchResponse[]> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<ClientSearchResponse[]>(`${this.USERS_URL}/clients/search`, { params });
  }

  CREATE(payload: RegisterWorkerRequest): Observable<any> {
    return this.http.post<any>(`${this.AUTH_URL}/register-worker`, payload);
  }

  UPDATE(id: string, payload: UpdateUserRequest): Observable<UserResponse> {
    return this.http.patch<UserResponse>(`${this.USERS_URL}/${id}`, payload);
  }

  DELETE(id: string): Observable<void> {
    return this.http.delete<void>(`${this.USERS_URL}/${id}`);
  }
}
