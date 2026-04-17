import { AuthService } from '#/app/features/auth/services/auth.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificamos si el signal de autenticación es true
  if (authService.isAuthenticated()) {
    return true;
  }

  // Si no está autenticado, lo mandamos al login de FlowRoad
  console.warn('Acceso denegado. Redirigiendo...');
  router.navigate(['/auth/login']);
  return false;
};
