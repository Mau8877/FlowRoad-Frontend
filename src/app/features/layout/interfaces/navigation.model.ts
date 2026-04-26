export interface NavItem {
  label: string;
  icon?: string;
  route?: string;
  roles: string[];
  children?: NavItem[];
}

export const MENU_ITEMS: NavItem[] = [
  { label: 'Inicio', icon: 'house', route: '/dashboard', roles: ['ADMIN', 'CLIENT'] },

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
  { label: 'Gestión Usuarios', icon: 'users', route: '/users', roles: ['ADMIN'] },

  {
    label: 'Diagrama De Actividades',
    icon: 'workflow',
    route: '/diagram',
    roles: ['ADMIN', 'DESIGNER'],
  },

  {
    label: 'Mis Procesos',
    icon: 'list-checks',
    route: '/process',
    roles: ['ADMIN', 'WORKER', 'RECEP'],
  },
  {
    label: 'Iniciar Procesos',
    icon: 'list-plus',
    route: '/process/list',
    roles: ['ADMIN', 'RECEP'],
  },

  { label: 'Mis Trámites', icon: 'file-text', route: '/tramites', roles: ['USER'] },
];
