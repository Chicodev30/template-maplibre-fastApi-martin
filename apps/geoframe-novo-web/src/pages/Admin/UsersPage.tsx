// Gestao de usuarios.
// Espelho dos usuarios reais do Keycloak: a lista cresce conforme as pessoas logam.
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
        <Title order={3}>Usuarios</Title>
        <Text c="dimmed" size="sm">
          Usuarios reais do Keycloak que ja acessaram a aplicacao (registrados no
          primeiro login). Clique para ver os detalhes.
        </Text>
      </div>

      {isError && (
        <Alert color="red" title="Falha ao carregar usuarios">
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
              <Table.Th>Usuario</Table.Th>
              <Table.Th>E-mail</Table.Th>
              <Table.Th>Papel</Table.Th>
              <Table.Th>Ultimo acesso</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center" py="md">
                    Nenhum usuario real do Keycloak registrado ainda.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {data?.map((u) => (
              <Table.Tr
                key={u.id}
                onClick={() => navigate(`/admin/social/users/${u.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>{u.full_name ?? u.username}</Table.Td>
                <Table.Td>{u.email ?? '-'}</Table.Td>
                <Table.Td>
                  <Badge color={ROLE_COLOR[u.effective_role]} variant="light">
                    {ROLE_LABEL[u.effective_role]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {u.last_login_at
                    ? new Date(u.last_login_at).toLocaleString('pt-BR')
                    : '-'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
