// Tela de acesso negado: usuario sem nenhum dos 3 papeis padrao do portal.
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from './useAuth';

export function AccessDenied() {
  const { logout } = useAuth();

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={480} px="md">
        <Title order={2}>Acesso negado</Title>
        <Text c="dimmed" ta="center">
          Sua conta nao possui nenhum dos papeis necessarios para acessar o portal
          (Administrador, Contribuidor ou Visualizador). Procure um administrador
          para liberar seu acesso no Keycloak.
        </Text>
        <Button component={Link} to="/login" variant="light">
          Voltar ao login
        </Button>
        <Button variant="subtle" onClick={logout}>
          Sair
        </Button>
      </Stack>
    </Center>
  );
}
