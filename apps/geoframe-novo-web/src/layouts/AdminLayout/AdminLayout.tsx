// Layout do portal admin.
import { AppShell, Group, Title, Anchor, Burger, Badge, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet } from 'react-router-dom';
import { env } from '../../app/env';
import { useAuth } from '../../auth/useAuth';
import { ROLE_LABEL } from '../../auth/auth.types';
import { AdminSidebar } from './AdminSidebar';

export function AdminLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { user, role, logout } = useAuth();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>{env.appTitle}</Title>
            <Title order={5} c="dimmed" fw={400}>
              Admin
            </Title>
          </Group>
          <Group gap="md">
            {user && role && (
              <Group gap={6}>
                <Text size="sm" visibleFrom="sm">
                  {user.full_name ?? user.username}
                </Text>
                <Badge variant="light">{ROLE_LABEL[role]}</Badge>
              </Group>
            )}
            <Anchor component={Link} to="/" size="sm">
              Mapa
            </Anchor>
            <Button size="xs" variant="subtle" onClick={logout}>
              Sair
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AdminSidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
