import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { jwtDecode } from 'jwt-decode';
import { tap, of, catchError } from 'rxjs';
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
  private router = inject(Router);
  private readonly URL = `${environment.BASE_URL}`;

  private _token = signal<string | null>(null);
  private _user = signal<User | null>(null);

  public currentUser = this._user.asReadonly();
  public isAuthenticated = computed(() => !!this._token());

  public displayName = computed(() => {
    const user = this._user();
    if (user?.profile?.nombre) {
      return user.profile.nombre;
    }
    return user?.email.split('@')[0] || 'Usuario';
  });

  public displayLastName = computed(() => {
    const user = this._user();
    return user?.profile?.apellido || '';
  });

  constructor() {
    this.CHECK_AUTH_STATUS();
  }

  /**
   * Obtiene la información completa del usuario (/me)
   * Si ya existe en el signal, no hace la petición (Cache)
   */
  GET_ME() {
    if (this._user()?.profile) {
      console.log('GET_ME: Datos recuperados de caché (Signal)', this._user());
      return of(this._user());
    }

    return this.http.get<User>(`${this.URL}/users/me`).pipe(
      tap((user) => {
        this._user.set(user);
        console.log('GET_ME: Datos recibidos del servidor', user);
        console.log('Signal actualizado:', this._user());
      }),
      catchError((err) => {
        console.error('GET_ME: Error al obtener perfil', err);
        return of(null);
      }),
    );
  }

  // 3. Funciones principales (UpperCase)

  LOGIN(credentials: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.URL}/auth/login`, credentials).pipe(
      tap((response) => {
        this.cookieService.set('auth_token', response.token, 1, '/');
        this._token.set(response.token);
        this.DECODE_AND_SET_USER(response.token);
        this.GET_ME().subscribe();
      }),
    );
  }

  REGISTER(data: RegisterRequest) {
    return this.http.post<AuthResponse>(`${this.URL}/auth/register`, data).pipe(
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
    this.router.navigate(['/auth/login']);
  }

  private CHECK_AUTH_STATUS(): void {
    const token = this.cookieService.get('auth_token');
    if (token) {
      this._token.set(token);
      this.DECODE_AND_SET_USER(token);
      this.GET_ME().subscribe();
    }
  }

  /**
   * Decodifica el JWT usando el tipado estricto JwtPayload
   * y mapea los datos al modelo User de la aplicación.
   */
  private DECODE_AND_SET_USER(token: string): void {
    try {
      const decoded = jwtDecode<JwtPayload>(token);

      this._user.set({
        id: decoded.userId,
        email: decoded.sub,
        role: decoded.role,
        orgId: decoded.orgId,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as User);
    } catch (error) {
      console.error('Error decodificando el token', error);
      this.LOGOUT();
    }
  }
}
