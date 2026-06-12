// Detalhe de um usuário: dados do Keycloak + grupos e papéis associados.
import { useParams, Link } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useUser } from '../../admin/users/users.api';
import { ROLE_LABEL } from '../../auth/auth.types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text>{value}</Text>
    </div>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const { data: user, isLoading, isError } = useUser(id);

  if (isLoading) {
    return (
      <Center h={240}>
        <Loader />
      </Center>
    );
  }
  if (isError || !user) {
    return <Text c="red">Usuário não encontrado.</Text>;
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/social/users" size="sm">
        ← Usuários
      </Anchor>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>{user.full_name ?? user.username}</Title>
          <Text c="dimmed" size="sm">
            {user.email ?? 'sem e-mail'}
          </Text>
        </div>
        <Badge size="lg" variant="light">
          {ROLE_LABEL[user.effective_role]}
        </Badge>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          Dados do Keycloak
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Field label="Usuário" value={user.username} />
          <Field label="Keycloak sub" value={user.keycloak_sub ?? '—'} />
          <Field label="E-mail" value={user.email ?? '—'} />
          <Field label="Ativo" value={user.is_active ? 'sim' : 'não'} />
          <Field
            label="Registrado em"
            value={new Date(user.created_at).toLocaleString('pt-BR')}
          />
          <Field
            label="Último acesso"
            value={
              user.last_login_at
                ? new Date(user.last_login_at).toLocaleString('pt-BR')
                : '—'
            }
          />
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="xs">
            Papéis
          </Title>
          <Group gap="xs">
            <Badge variant="light">{ROLE_LABEL[user.effective_role]}</Badge>
          </Group>
          <Text size="xs" c="dimmed" mt="sm">
            Papel efetivo (o maior, quando há mais de um). A lista completa de papéis do
            Keycloak entra com a integração real.
          </Text>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="xs">
            Grupos
          </Title>
          <Text size="sm" c="dimmed">
            Grupos do Keycloak associados ao usuário. Disponível com a integração real
            do Keycloak.
          </Text>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
