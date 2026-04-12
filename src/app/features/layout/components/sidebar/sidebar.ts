import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterModule, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { MENU_ITEMS } from '#/app/features/layout/interfaces/navigation.model';

// Icons
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  House,
  Users,
  Briefcase,
  FileText,
  ChevronDown,
  HousePlus,
} from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterLinkActive, CommonModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        House,
        Users,
        Briefcase,
        FileText,
        ChevronDown,
        HousePlus,
      }),
    },
  ],
})
export class Sidebar implements OnInit {
  // Inyecciones
  public authService = inject(AuthService);
  private router = inject(Router);

  // Signals de estado
  public openMenus = signal<string[]>([]);

  // Menu filtrado por roles
  public filteredMenu = computed(() => {
    const user = this.authService.currentUser();
    const userRole = user?.roles && user.roles.length > 0 ? user.roles[0] : '';
    return MENU_ITEMS.filter((item) => item.roles.includes(userRole));
  });

  ngOnInit(): void {
    this.AUTO_EXPAND_MENU();
  }

  /**
   * Expande automáticamente el menú padre si la URL actual coincide con un hijo
   */
  private AUTO_EXPAND_MENU(): void {
    // Verificación inicial al cargar
    this.CHECK_URL(this.router.url);

    // Verificación en cada cambio de navegación
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.CHECK_URL(event.url);
      });
  }

  private CHECK_URL(url: string): void {
    if (url.includes('/config')) {
      this.openMenus.update((prev) =>
        prev.includes('Configuración Organizacional')
          ? prev
          : [...prev, 'Configuración Organizacional'],
      );
    }
  }

  /**
   * Abre/Cierra menús acordeón
   */
  TOGGLE_MENU(label: string): void {
    this.openMenus.update((menus: string[]) =>
      menus.includes(label) ? menus.filter((m) => m !== label) : [...menus, label],
    );
  }

  /**
   * Helper para el HTML
   */
  IS_OPEN(label: string): boolean {
    return this.openMenus().includes(label);
  }
}
