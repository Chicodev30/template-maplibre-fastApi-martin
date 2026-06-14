// Lista de estilos salvos (presets por recurso) - catalogo "Estilização".
import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useDeleteLayerStyle, useResourceStyles } from '../../catalog/api/layerStyles.api';
import type { ResourceStyleSummary } from '../../catalog/types/style.types';

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export function StylesPage() {
  const navigate = useNavigate();
  const styles = useResourceStyles();
  const deleteStyle = useDeleteLayerStyle();
  const [toDelete, setToDelete] = useState<ResourceStyleSummary | null>(null);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>Estilização</Title>
          <Text c="dimmed" size="sm">
            {styles.data?.length ?? 0} estilo(s) salvo(s). Estilos podem ser reutilizados em
            grupos de camadas.
          </Text>
        </div>
        <Button onClick={() => navigate('/admin/catalog/styles/new')}>Criar novo estilo</Button>
      </Group>

      {styles.isError && (
        <Alert color="red" title="Falha ao carregar">
          A API não respondeu. Verifique se o FastAPI está no ar.
        </Alert>
      )}

      {styles.isLoading ? (
        <Center h={240}>
          <Loader />
        </Center>
      ) : styles.data && styles.data.length === 0 ? (
        <Alert color="blue" title="Nenhum estilo ainda">
          Crie o primeiro estilo escolhendo uma camada do catálogo.
        </Alert>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Recurso</Table.Th>
              <Table.Th>Atualizado</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {styles.data?.map((style) => (
              <Table.Tr
                key={style.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/admin/catalog/styles/${style.id}`)}
              >
                <Table.Td>
                  <Text fw={600} size="sm">
                    {style.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {style.resourceId}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(style.updatedAt)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Excluir estilo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(style);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir estilo"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>? Essa ação não pode
            ser desfeita.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteStyle.isPending}
              onClick={() => {
                if (!toDelete) return;
                deleteStyle.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
              }}
            >
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
