import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { LoginRequest } from '#/app/features/auth/interfaces/auth.model';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-modal.html',
})
export class LoginModal {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Signals para la UI
  public IS_LOADING = signal(false);
  public ERROR_MSG = signal<string | null>(null);
  public SHOW_PASSWORD = signal(false);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ON_SUBMIT() {
    if (this.loginForm.invalid) return;

    this.IS_LOADING.set(true);
    this.ERROR_MSG.set(null);

    const credentials = this.loginForm.getRawValue() as LoginRequest;

    this.authService.LOGIN(credentials).subscribe({
      next: () => {
        // Redirigir basado en el rol tras login exitoso
        const user = this.authService.currentUser();
        const role = user?.role;

        if (role === 'ADMIN') {
          this.router.navigate(['/dashboard']);
        } else if (role === 'DESIGNER') {
          this.router.navigate(['/diagram']);
        } else if (role === 'RECEP' || role === 'WORKER') {
          this.router.navigate(['/process']);
        } else {
          // Fallback por defecto
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.IS_LOADING.set(false);
        this.ERROR_MSG.set('Credenciales incorrectas. Intenta de nuevo.');
        console.error('Login Error:', err);
      },
    });
  }

  TOGGLE_PASSWORD() {
    this.SHOW_PASSWORD.update((v) => !v);
  }
}
