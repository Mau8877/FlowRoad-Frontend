import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CookieService } from 'ngx-cookie-service';
import { jwtDecode } from 'jwt-decode';
import { tap } from 'rxjs';
import { environment } from '#/environments/environment';
import {
  LoginRequest,
  AuthResponse,
  User,
  RegisterRequest,
  JwtPayload,
} from '../interfaces/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private cookieService = inject(CookieService);
  private readonly URL = `${environment.BASE_URL}/auth`;

  // 1. Estado privado (Signals)
  private _token = signal<string | null>(null);
  private _user = signal<User | null>(null);

  // 2. Exposición pública
  public currentUser = this._user.asReadonly();
  public isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.CHECK_AUTH_STATUS();
  }

  // 3. Funciones principales (UpperCase)

  LOGIN(credentials: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.URL}/login`, credentials).pipe(
      tap((response) => {
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

  /**
   * Decodifica el JWT usando el tipado estricto JwtPayload
   * y mapea los datos al modelo User de la aplicación.
   */
  private DECODE_AND_SET_USER(token: string): void {
    try {
      // Usamos el Genérico <JwtPayload> para autocompletado y seguridad
      const decoded = jwtDecode<JwtPayload>(token);

      this._user.set({
        uid: decoded.userId, //userId del JWT -> uid
        email: decoded.sub, //sub del JWT -> email
        displayName: decoded.sub.split('@')[0], // Extrae el nombre del correo
        roles: [decoded.role], // Convierte el role único en Array
      });
    } catch (error) {
      console.error('Error decodificando el token', error);
      this.LOGOUT();
    }
  }
}
