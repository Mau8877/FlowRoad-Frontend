import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '#/app/features/auth/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ON_SUBMIT() {
    if (this.loginForm.valid) {
      const credentials = this.loginForm.getRawValue();
      this.authService.LOGIN(credentials as any).subscribe({
        next: (response) => {
          console.log('Login exitoso:', response.message);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error('Error de autenticación:', err);
        },
      });
    }
  }
}
