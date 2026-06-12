// Proteção de rotas autenticadas.
import type { ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuth } from './useAuth';
import { AccessDenied } from './AccessDenied';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isDenied, role } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  // Sem nenhum dos 3 papeis padrao -> acesso negado.
  if (isDenied || !role) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
