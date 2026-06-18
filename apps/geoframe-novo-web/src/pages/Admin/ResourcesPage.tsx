// Gestao de resources: lista de camadas GeoServer cadastradas.
import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import {
  useAddResource,
  useCatalogResources,
  useDeleteResource,
  useGeoServerLayers,
  useGeoServerWorkspaces,
} from '../../catalog/api/resources.api';

function AddResourceModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [layer, setLayer] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  const workspaces = useGeoServerWorkspaces();
  const layers = useGeoServerLayers(workspace);
  const add = useAddResource();

  function handleWorkspaceChange(ws: string | null) {
    setWorkspace(ws);
    setLayer(null);
  }

  function handleLayerChange(l: string | null) {
    setLayer(l);
    if (l && !label) setLabel(l);
  }

  function handleSubmit() {
    if (!workspace || !layer) return;
    add.mutate(
      { source_id: `${workspace}.${layer}`, layer_label: label || layer },
      {
        onSuccess: () => {
          setWorkspace(null);
          setLayer(null);
          setLabel('');
          onClose();
        },
      },
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Adicionar Recurso" size="md">
      <Stack gap="sm">
        <Select
          label="Workspace"
          placeholder="Selecione o workspace"
          data={workspaces.data ?? []}
          value={workspace}
          onChange={handleWorkspaceChange}
          disabled={workspaces.isLoading}
          searchable
        />
        <Select
          label="Camada"
          placeholder={workspace ? 'Selecione a camada' : 'Escolha o workspace primeiro'}
          data={layers.data ?? []}
          value={layer}
          onChange={handleLayerChange}
          disabled={!workspace || layers.isLoading}
          searchable
        />
        <TextInput
          label="Nome de exibição"
          placeholder="Ex.: Áreas Alagáveis"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        {add.isError && (
          <Alert color="red" title="Erro">
            Falha ao adicionar recurso. Verifique se ele já existe.
          </Alert>
        )}
        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={add.isPending}
            disabled={!workspace || !layer}
          >
            Adicionar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ResourcesPage() {
  const catalog = useCatalogResources();
  const deleteResource = useDeleteResource();
  const [search, setSearch] = useState('');
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const navigate = useNavigate();

  const resources = useMemo(() => {
    const list = catalog.data ?? [];
    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          (r) => r.layerLabel.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
        )
      : list;
  }, [catalog.data, search]);

  function handleDelete(e: React.MouseEvent, sourceId: string) {
    e.stopPropagation();
    if (confirm(`Remover recurso "${sourceId}"?`)) {
      deleteResource.mutate(sourceId);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>Recursos</Title>
          <Text c="dimmed" size="sm">
            {catalog.data?.length ?? 0} camadas cadastradas
          </Text>
        </div>
        <Group gap="sm">
          <TextInput
            placeholder="Filtrar..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={240}
          />
          <Button onClick={openModal}>Adicionar Recurso</Button>
        </Group>
      </Group>

      {catalog.isError && (
        <Alert color="red" title="Falha ao carregar recursos">
          Verifique se a API está no ar.
        </Alert>
      )}

      {catalog.isLoading ? (
        <Center h={200}>
          <Loader />
        </Center>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>ID (workspace.layer)</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resources.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" ta="center" py="md">
                    Nenhum recurso cadastrado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              resources.map((r) => (
                <Table.Tr
                  key={r.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/catalog/resources/${encodeURIComponent(r.id)}`)}
                >
                  <Table.Td fw={500}>{r.layerLabel}</Table.Td>
                  <Table.Td c="dimmed" ff="monospace" fz="sm">
                    {r.id}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Remover recurso">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={(e) => handleDelete(e, r.id)}
                        loading={deleteResource.isPending && deleteResource.variables === r.id}
                        aria-label="Remover"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      )}

      <AddResourceModal opened={modalOpened} onClose={closeModal} />
    </Stack>
  );
}
