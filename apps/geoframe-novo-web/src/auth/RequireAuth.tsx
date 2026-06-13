// Protecao de rotas autenticadas.
import type { ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AccessDenied } from './AccessDenied';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isLoading, isDenied, role, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isDenied || !role) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
