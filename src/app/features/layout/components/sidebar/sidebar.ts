import { UiService } from '#/app/core/services/ui.service';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { ProcessNotificationStateService } from '#/app/features/process-management/services/process-notification-state.service';
import { MENU_ITEMS, NavItem } from '#/app/features/layout/interfaces/navigation.model';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLinkActive, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

// Icons
import {
  Briefcase,
  ChevronDown,
  FileText,
  House,
  HousePlus,
  ListChecks,
  ListPlus,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Users,
  Workflow,
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
        Workflow,
        ListChecks,
        ListPlus,
      }),
    },
  ],
})
export class Sidebar implements OnInit {
  // Inyecciones
  public authService = inject(AuthService);
  private router = inject(Router);
  public uiService = inject(UiService);
  public processNotificationState = inject(ProcessNotificationStateService);

  // Signals de estado
  public openMenus = signal<string[]>([]);

  public processUnreadCount = computed(() => this.processNotificationState.unreadAssignmentsCount());
  private readonly configMenuLabel =
    MENU_ITEMS.find((item) => item.children?.some((child) => child.route?.startsWith('/config')))
      ?.label ?? 'Configuracion Organizacional';

  // Menu filtrado por roles
  public filteredMenu = computed(() => {
    const user = this.authService.currentUser();

    // Si no hay usuario, devolvemos menu vacio por seguridad
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
   * Escucha los cambios de ruta para cerrar el menu en movil
   * y expandir los acordeones necesarios.
   */
  private LISTEN_ROUTING(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // 1. Cerrar si estamos en resolucion movil
        this.CLOSE_ON_MOBILE();

        // 2. Expandir acordeon si aplica
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
   * Expande automaticamente el menu padre si la URL actual coincide con un hijo
   */
  private AUTO_EXPAND_MENU(): void {
    // Verificacion inicial al cargar la pagina
    this.CHECK_URL(this.router.url);
  }

  private CHECK_URL(url: string): void {
    if (url.includes('/config')) {
      this.openMenus.update((prev) =>
        prev.includes(this.configMenuLabel) ? prev : [...prev, this.configMenuLabel],
      );
    }
  }

  public shouldShowProcessBadge(item: NavItem): boolean {
    return item.route === '/process' && this.processUnreadCount() > 0;
  }

  /**
   * Abre/Cierra menus acordeon de forma manual
   */
  TOGGLE_MENU(label: string): void {
    this.openMenus.update((menus: string[]) =>
      menus.includes(label) ? menus.filter((m) => m !== label) : [...menus, label],
    );
  }

  /**
   * Helper para verificar si un submenu esta abierto en el HTML
   */
  IS_OPEN(label: string): boolean {
    return this.openMenus().includes(label);
  }
}
