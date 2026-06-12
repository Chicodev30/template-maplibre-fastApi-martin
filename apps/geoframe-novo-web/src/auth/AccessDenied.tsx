// Tela de acesso negado: usuario sem nenhum dos 3 papeis padrao do portal.
import { Button, Center, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from './useAuth';
import { DevRoleSwitcher } from './DevRoleSwitcher';

export function AccessDenied() {
  const { devBypass } = useAuth();

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={480} px="md">
        <Title order={2}>Acesso negado</Title>
        <Text c="dimmed" ta="center">
          Sua conta não possui nenhum dos papéis necessários para acessar o portal
          (Administrador, Contribuidor ou Visualizador). Procure um administrador
          para liberar seu acesso no Keycloak.
        </Text>
        {devBypass && (
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              Modo dev:
            </Text>
            <DevRoleSwitcher />
          </Group>
        )}
        <Button component={Link} to="/" variant="light">
          Voltar ao mapa
        </Button>
      </Stack>
    </Center>
  );
}
