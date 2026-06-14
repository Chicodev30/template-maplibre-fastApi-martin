// Provider de autenticacao Keycloak.
import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet, setApiAuthHeaders } from '../app/http';
import type { AppRole, AuthUser } from './auth.types';
import { getValidKeycloakToken, initKeycloak, keycloak } from './keycloak';

interface AuthContextValue {
  user: AuthUser | null;
  role: AppRole | null;
  isLoading: boolean;
  isDenied: boolean;
  isAuthenticated: boolean;
  login: (redirectUri?: string) => void;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [kcReady, setKcReady] = useState(false);
  const [kcAuthenticated, setKcAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: ReturnType<typeof setInterval> | undefined;

    const refreshAuthHeaders = async () => {
      try {
        const token = await getValidKeycloakToken();
        setApiAuthHeaders(token ? { Authorization: `Bearer ${token}` } : {});
      } catch {
        setApiAuthHeaders({});
        if (mounted) setKcAuthenticated(false);
      }
    };

    initKeycloak()
      .then(async (authenticated) => {
        if (!mounted) return;
        setKcAuthenticated(authenticated);
        if (!authenticated) {
          setApiAuthHeaders({});
          return;
        }

        await refreshAuthHeaders();
        if (!mounted) return;

        // O access token do Keycloak expira em poucos minutos. Sem isso, o
        // header Authorization usado em todas as chamadas a API/tiles fica
        // com um token vencido e tudo passa a responder 401/500 ate o
        // usuario recarregar a pagina.
        refreshInterval = setInterval(refreshAuthHeaders, 20_000);
      })
      .catch(() => {
        if (!mounted) return;
        setApiAuthHeaders({});
        setKcAuthenticated(false);
      })
      .finally(() => {
        if (mounted) setKcReady(true);
      });

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  const query = useQuery<AuthUser, ApiError>({
    queryKey: ['auth', 'me', keycloak.token],
    queryFn: () => apiGet<AuthUser>('/auth/me'),
    enabled: kcReady && kcAuthenticated,
    retry: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: query.data ?? null,
      role: query.data?.effective_role ?? null,
      isLoading: !kcReady || query.isLoading,
      isDenied: query.error?.status === 403,
      isAuthenticated: kcAuthenticated,
      login: (redirectUri) => {
        keycloak.login({
          redirectUri: redirectUri ?? `${window.location.origin}/`,
        });
      },
      logout: () => {
        keycloak.logout({ redirectUri: `${window.location.origin}/login` });
      },
    }),
    [query.data, query.isLoading, query.error, kcReady, kcAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
