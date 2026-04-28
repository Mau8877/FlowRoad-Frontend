import { UiService } from '#/app/core/services/ui.service';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

// Icons
import {
  LogOut,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Menu,
  Settings,
  User,
  X,
} from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Menu, LogOut, User, Settings, X }),
    },
  ],
})
export class Header implements OnInit {
  // Inyecciones
  public authService = inject(AuthService);
  public uiService = inject(UiService);
  private router = inject(Router);

  public currentSection = 'Panel de Control';

  ngOnInit(): void {
    this.updateTitle(this.router.url);

    // Escuchar cambios de ruta para actualizar el título del Header
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.url);
      });
  }

  private updateTitle(url: string): void {
    if (url.includes('/config/cargos')) {
      this.currentSection = 'Gestión de Cargos';
    } else if (url.includes('/config/deptos')) {
      this.currentSection = 'Gestión de Departamentos';
    } else if (url.includes('/config/plantillas')) {
      this.currentSection = 'Plantillas Documentales';
    } else if (url.includes('/dashboard')) {
      this.currentSection = 'Dashboard';
    } else if (url.includes('/users')) {
      this.currentSection = 'Gestión de Usuarios';
    } else {
      this.currentSection = 'FlowRoad';
    }
  }

  LOGOUT() {
    this.authService.LOGOUT();
  }
}
