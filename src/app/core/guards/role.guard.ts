import { AuthService } from '#/app/features/auth/services/auth.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Obtenemos los roles permitidos definidos en la ruta
  const allowedRoles = (route.data?.['roles'] ?? []) as string[];

  // 2. Obtenemos el rol del usuario desde nuestro signal (ya decodificado del token)
  const userRole = authService.currentUser()?.role;

  // 3. Verificamos si el rol del usuario está en la lista de permitidos
  if (userRole && allowedRoles.includes(userRole)) {
    return true;
  }

  // Si no tiene permiso, lo mandamos a una ruta segura (ej. Dashboard)
  console.error(`Acceso prohibido: Se requiere uno de los roles: ${allowedRoles}`);
  router.navigate(['/dashboard']);
  return false;
};
