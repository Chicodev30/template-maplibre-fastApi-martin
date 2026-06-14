// Tela inicial de autenticacao SSO-PMPA.
import { useEffect } from 'react';
import { Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { APP_NAME } from '../../config/constants';

type LoginLocationState = {
  from?: string;
};

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isDenied, role, login } = useAuth();
  const from = (location.state as LoginLocationState | null)?.from ?? '/';

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      navigate(from, { replace: true });
    }
  }, [from, isAuthenticated, isLoading, navigate, role]);

  if (isDenied) return <Navigate to="/login" replace />;

  return (
    <Center h="100vh" px="md" bg="gray.0">
      <Paper withBorder radius="md" p="xl" w="100%" maw={420}>
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={2}>{APP_NAME}</Title>
            <Text c="dimmed">
              Entre com seu usuario do Keycloak para acessar o portal administrativo.
            </Text>
          </Stack>

          <Button
            size="md"
            loading={isLoading}
            onClick={() => login(`${window.location.origin}${from}`)}
          >
            Entrar com Keycloak
          </Button>

          <Text size="sm" c="dimmed">
            E necessario ter pelo menos um papel: gfr-admin, gfr-contribuidor ou
            gfr-visualizador.
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
