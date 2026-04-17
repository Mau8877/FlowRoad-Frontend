import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '#/app/features/auth/services/auth.service';

export const publicGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si el usuario YA está autenticado...
  if (authService.isAuthenticated()) {
    console.log('Usuario ya autenticado. Redirigiendo al Dashboard...');
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
