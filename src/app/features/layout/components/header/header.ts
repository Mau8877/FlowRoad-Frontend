import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '#/app/features/auth/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  public authService = inject(AuthService);

  public currentSection = 'Panel de Control';

  LOGOUT() {
    this.authService.LOGOUT();
  }
}
