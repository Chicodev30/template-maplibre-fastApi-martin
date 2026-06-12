// Gestão de usuários.
// Espelho dos usuarios do Keycloak: a lista cresce conforme as pessoas logam.
import { Alert, Badge, Center, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../../admin/users/users.api';
import { ROLE_LABEL } from '../../auth/auth.types';
import type { AppRole } from '../../auth/auth.types';

const ROLE_COLOR: Record<AppRole, string> = {
  admin: 'red',
  contribuidor: 'blue',
  visualizador: 'gray',
};

export function UsersPage() {
  const { data, isLoading, isError } = useUsers();
  const navigate = useNavigate();

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Usuários</Title>
        <Text c="dimmed" size="sm">
          Lista fixa de quem já acessou a aplicação (registrado no primeiro login).
          Clique para ver os detalhes.
        </Text>
      </div>

      {isError && (
        <Alert color="red" title="Falha ao carregar usuários">
          Apenas administradores podem ver esta lista.
        </Alert>
      )}

      {isLoading ? (
        <Center h={200}>
          <Loader />
        </Center>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Usuário</Table.Th>
              <Table.Th>E-mail</Table.Th>
              <Table.Th>Papel</Table.Th>
              <Table.Th>Último acesso</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.map((u) => (
              <Table.Tr
                key={u.id}
                onClick={() => navigate(`/admin/social/users/${u.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>{u.full_name ?? u.username}</Table.Td>
                <Table.Td>{u.email ?? '—'}</Table.Td>
                <Table.Td>
                  <Badge color={ROLE_COLOR[u.effective_role]} variant="light">
                    {ROLE_LABEL[u.effective_role]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {u.last_login_at
                    ? new Date(u.last_login_at).toLocaleString('pt-BR')
                    : '—'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
