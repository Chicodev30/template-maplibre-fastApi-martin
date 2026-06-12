// Papéis (roles) do portal.
import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';

const ROLES = [
  {
    label: 'Administrador',
    kc: 'gfr-admin',
    color: 'red',
    desc: 'Acesso total ao portal por padrão. Gerencia recursos, permissões e usuários.',
  },
  {
    label: 'Contribuidor',
    kc: 'gfr-contribuidor',
    color: 'blue',
    desc: 'Edição de dados nos recursos permitidos. (Detalhes a definir.)',
  },
  {
    label: 'Visualizador',
    kc: 'gfr-visualizador',
    color: 'gray',
    desc: 'Apenas visualização dos recursos permitidos. (Detalhes a definir.)',
  },
];

export function RolesPage() {
  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Papéis</Title>
        <Text c="dimmed" size="sm">
          Papéis padrão do Keycloak. Quando um usuário tem mais de um, o maior prevalece.
        </Text>
      </div>
      <Stack gap="sm">
        {ROLES.map((r) => (
          <Card key={r.kc} withBorder padding="md" radius="md">
            <Group justify="space-between" mb={4}>
              <Title order={5}>{r.label}</Title>
              <Badge color={r.color} variant="light">
                {r.kc}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {r.desc}
            </Text>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
