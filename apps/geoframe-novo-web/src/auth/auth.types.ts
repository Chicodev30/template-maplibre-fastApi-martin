// Tipos de usuário, roles e permissões.

export type AppRole = 'admin' | 'contribuidor' | 'visualizador';

export interface AuthUser {
  id: number;
  keycloak_sub: string | null;
  username: string;
  email: string | null;
  full_name: string | null;
  effective_role: AppRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrador',
  contribuidor: 'Contribuidor',
  visualizador: 'Visualizador',
};
