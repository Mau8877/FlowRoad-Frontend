import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterModule, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { UiService } from '#/app/core/services/ui.service';
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
  X,
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
        X,
      }),
    },
  ],
})
export class Sidebar implements OnInit {
  // Inyecciones
  public authService = inject(AuthService);
  private router = inject(Router);
  public uiService = inject(UiService);

  // Signals de estado
  public openMenus = signal<string[]>([]);

  // Menu filtrado por roles
  public filteredMenu = computed(() => {
    const user = this.authService.currentUser();

    // Si no hay usuario, devolvemos menú vacío por seguridad
    if (!user) return [];

    // En el nuevo modelo, 'role' es un string directo (ej: 'ADMIN')
    const userRole = user.role;

    return MENU_ITEMS.filter((item) => item.roles.includes(userRole));
  });

  ngOnInit(): void {
    if (window.innerWidth >= 1024) {
      this.uiService.openSidebar();
    }

    this.AUTO_EXPAND_MENU();
    this.LISTEN_ROUTING();
  }

  /**
   * Escucha los cambios de ruta para cerrar el menú en móvil
   * y expandir los acordeones necesarios.
   */
  private LISTEN_ROUTING(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // 1. Cerrar si estamos en resolución móvil
        this.CLOSE_ON_MOBILE();

        // 2. Expandir acordeón si aplica
        this.CHECK_URL(event.url);
      });
  }

  /**
   * Cierra el sidebar solo si la pantalla es menor a 1024px (breakpoint 'lg')
   */
  public CLOSE_ON_MOBILE(): void {
    if (window.innerWidth < 1024) {
      this.uiService.closeSidebar();
    }
  }

  /**
   * Expande automáticamente el menú padre si la URL actual coincide con un hijo
   */
  private AUTO_EXPAND_MENU(): void {
    // Verificación inicial al cargar la página
    this.CHECK_URL(this.router.url);
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
   * Abre/Cierra menús acordeón de forma manual
   */
  TOGGLE_MENU(label: string): void {
    this.openMenus.update((menus: string[]) =>
      menus.includes(label) ? menus.filter((m) => m !== label) : [...menus, label],
    );
  }

  /**
   * Helper para verificar si un submenú está abierto en el HTML
   */
  IS_OPEN(label: string): boolean {
    return this.openMenus().includes(label);
  }
}
