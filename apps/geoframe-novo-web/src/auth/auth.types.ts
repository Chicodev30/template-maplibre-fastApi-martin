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

// Papeis padrao do Keycloak usados no bypass de dev (header X-Dev-Role).
export const DEV_ROLE_OPTIONS = [
  { value: 'gfr-admin', label: 'Administrador' },
  { value: 'gfr-contribuidor', label: 'Contribuidor' },
  { value: 'gfr-visualizador', label: 'Visualizador' },
  { value: '', label: 'Sem papel (acesso negado)' },
] as const;

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrador',
  contribuidor: 'Contribuidor',
  visualizador: 'Visualizador',
};
