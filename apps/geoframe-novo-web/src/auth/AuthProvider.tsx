// Provider de autenticação.
// Modo dev (bypass): o papel vem de um seletor e e enviado no header X-Dev-Role.
// Quando o Keycloak entrar, troca-se a fonte do token sem mexer no resto.
import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet, setApiAuthHeaders } from '../app/http';
import { env } from '../app/env';
import type { AppRole, AuthUser } from './auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  role: AppRole | null;
  isLoading: boolean;
  isDenied: boolean;
  devBypass: boolean;
  devRole: string;
  setDevRole: (role: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_ROLE_KEY = 'gfr.devRole';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devRole, setDevRole] = useState(
    () => localStorage.getItem(DEV_ROLE_KEY) ?? 'gfr-admin',
  );

  // Mantem o header de auth em sincronia com o papel escolhido em dev.
  useEffect(() => {
    if (env.authDevBypass) {
      setApiAuthHeaders({ 'X-Dev-Role': devRole });
      localStorage.setItem(DEV_ROLE_KEY, devRole);
    }
  }, [devRole]);

  const query = useQuery<AuthUser, ApiError>({
    queryKey: ['auth', 'me', env.authDevBypass ? devRole : 'kc'],
    queryFn: () => apiGet<AuthUser>('/auth/me'),
    retry: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: query.data ?? null,
      role: query.data?.effective_role ?? null,
      isLoading: query.isLoading,
      isDenied: query.error?.status === 403,
      devBypass: env.authDevBypass,
      devRole,
      setDevRole,
    }),
    [query.data, query.isLoading, query.error, devRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
