import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '#/environments/environment';
import { CargoResponse, CreateCargoRequest, UpdateCargoRequest } from '../interfaces/cargo.model';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CargoService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly URL = `${environment.BASE_URL}/cargos`;

  GET_BY_ORGANIZATION(): Observable<CargoResponse[]> {
    const orgId = this.authService.currentUser()?.orgId;
    if (!orgId) return throwError(() => new Error('Organización no identificada'));
    return this.http.get<CargoResponse[]>(`${this.URL}/organization/${orgId}`);
  }

  CREATE(payload: CreateCargoRequest): Observable<CargoResponse> {
    return this.http.post<CargoResponse>(`${this.URL}`, payload);
  }

  UPDATE(id: string, payload: UpdateCargoRequest): Observable<CargoResponse> {
    return this.http.patch<CargoResponse>(`${this.URL}/${id}`, payload);
  }

  // Nuevo método DELETE para desactivación directa 👈
  DELETE(id: string): Observable<void> {
    // DELETE /api/v1/cargos/{id}
    return this.http.delete<void>(`${this.URL}/${id}`);
  }
}
