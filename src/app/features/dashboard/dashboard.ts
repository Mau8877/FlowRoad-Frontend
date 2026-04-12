import { Component, inject } from '@angular/core';
import { AuthService } from '#/app/features/auth/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  public authService = inject(AuthService);

  constructor() {
    console.log('Datos del usuario logueado:', this.authService.currentUser());
  }
}
