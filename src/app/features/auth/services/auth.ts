import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CookieService } from 'ngx-cookie-service';
import { jwtDecode } from 'jwt-decode';
import { tap } from 'rxjs';
import { environment } from '#/environments/environment';
import { LoginRequest, AuthResponse, User, RegisterRequest } from '../interfaces/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private cookieService = inject(CookieService);
  private readonly URL = `${environment.BASE_URL}/auth`;

  // 1. Estado privado
  private _token = signal<string | null>(null);
  private _user = signal<User | null>(null);

  // 2. Exposición pública (Signals de solo lectura)
  public currentUser = this._user.asReadonly();
  public isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.CHECK_AUTH_STATUS();
  }

  // 3. Funciones principales (UpperCase)

  LOGIN(credentials: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.URL}/login`, credentials).pipe(
      tap((response) => {
        // Guardamos en Cookie por seguridad
        this.cookieService.set('auth_token', response.token, 1, '/');
        this._token.set(response.token);
        this.DECODE_AND_SET_USER(response.token);
      }),
    );
  }

  REGISTER(data: RegisterRequest) {
    return this.http.post<AuthResponse>(`${this.URL}/register`, data).pipe(
      tap((response) => {
        this.cookieService.set('auth_token', response.token, 1, '/');
        this._token.set(response.token);
        this.DECODE_AND_SET_USER(response.token);
      }),
    );
  }

  LOGOUT(): void {
    this.cookieService.delete('auth_token', '/');
    this._token.set(null);
    this._user.set(null);
  }

  private CHECK_AUTH_STATUS(): void {
    const token = this.cookieService.get('auth_token');
    if (token) {
      this._token.set(token);
      this.DECODE_AND_SET_USER(token);
    }
  }

  private DECODE_AND_SET_USER(token: string): void {
    try {
      const decoded: any = jwtDecode(token);
      this._user.set({
        uid: decoded.sub || decoded.id,
        email: decoded.email,
        displayName: decoded.name || 'Usuario',
        roles: decoded.roles || [],
      });
    } catch (error) {
      console.error('Error decodificando el token', error);
      this.LOGOUT();
    }
  }
}
