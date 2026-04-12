export interface NavItem {
  label: string;
  icon?: string;
  route?: string; // Opcional si es un padre
  roles: string[];
  children?: NavItem[]; // Lista de hijos
}

export const MENU_ITEMS: NavItem[] = [
  { label: 'Inicio', icon: 'house', route: '/dashboard', roles: ['ADMIN', 'CLIENT'] },
  { label: 'Gestión Usuarios', icon: 'users', route: '/users', roles: ['ADMIN'] },

  // NUEVO MENÚ PADRE
  {
    label: 'Configuración Organizacional',
    icon: 'briefcase',
    roles: ['ADMIN'],
    children: [
      { label: 'Gestionar Cargos', icon: 'users', route: '/config/cargos', roles: ['ADMIN'] },
      {
        label: 'Gestionar Departamentos',
        icon: 'house-plus',
        route: '/config/deptos',
        roles: ['ADMIN'],
      },
      {
        label: 'Plantillas Documentales',
        icon: 'file-text',
        route: '/config/plantillas',
        roles: ['ADMIN'],
      },
    ],
  },

  { label: 'Mis Trámites', icon: 'file-text', route: '/tramites', roles: ['USER'] },
];
