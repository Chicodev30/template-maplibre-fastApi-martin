// Editor de um estilo salvo (preset por recurso) - catalogo "Estilização".
// Mapa interativo com preview ao lado das opções de estilo, em tempo real.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Anchor,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  useCreateLayerStyle,
  useLayerStyle,
  useUpdateLayerStyle,
} from '../../catalog/api/layerStyles.api';
import { useCatalogResources, useResourceColumns } from '../../catalog/api/resources.api';
import { ResourceThumbnail } from '../../catalog/components/ResourceThumbnail';
import { StyleEditor } from '../../catalog/components/StyleEditor';
import { defaultLayerStyle, type LayerStyle } from '../../catalog/types/style.types';

function tableNameOf(resourceId: string) {
  return resourceId.split('.').slice(1).join('.') || resourceId;
}

export function StyleBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editingId = id && id !== 'new' ? Number(id) : null;

  const existing = useLayerStyle(editingId);
  const catalog = useCatalogResources();
  const createStyle = useCreateLayerStyle();
  const updateStyle = useUpdateLayerStyle(editingId ?? 0);

  const [resourceId, setResourceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<LayerStyle>(defaultLayerStyle());
  const hydrated = useRef(false);

  // Hidrata o estado uma vez quando editando um estilo existente.
  useEffect(() => {
    if (editingId == null || hydrated.current || !existing.data) return;
    setResourceId(existing.data.resourceId);
    setName(existing.data.name);
    setStyle(existing.data.style);
    hydrated.current = true;
  }, [editingId, existing.data]);

  const columns = useResourceColumns(resourceId ? tableNameOf(resourceId) : null);

  const resourceOptions = (catalog.data ?? []).map((r) => ({ value: r.id, label: r.layerLabel }));

  function save() {
    if (!resourceId) return;
    const payload = { resourceId, name: name.trim() || 'Sem nome', style };
    if (editingId != null) {
      updateStyle.mutate(payload);
    } else {
      createStyle.mutate(payload, {
        onSuccess: (saved) => navigate(`/admin/catalog/styles/${saved.id}`),
      });
    }
  }

  const saving = createStyle.isPending || updateStyle.isPending;
  const saved = createStyle.isSuccess || updateStyle.isSuccess;

  if (editingId != null && existing.isLoading) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }
  if (editingId != null && existing.isError) {
    return <Text c="red">Estilo não encontrado.</Text>;
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/catalog/styles" size="sm">
        Voltar para estilização
      </Anchor>

      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>{editingId != null ? 'Editar estilo' : 'Criar novo estilo'}</Title>
          <Text c="dimmed" size="sm">
            Escolha uma camada do catálogo e ajuste o estilo com preview em tempo real.
          </Text>
        </div>
      </Group>

      <Card withBorder radius="md" padding="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Select
            label="Camada do catálogo"
            placeholder="Selecione uma camada"
            data={resourceOptions}
            value={resourceId}
            onChange={setResourceId}
            searchable
            disabled={editingId != null}
          />
          <TextInput
            label="Nome do estilo"
            placeholder="Ex.: Padrão, Destaque..."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </SimpleGrid>
      </Card>

      {!resourceId ? (
        <Center h={160}>
          <Text size="sm" c="dimmed">
            Selecione uma camada do catálogo para começar a estilizar.
          </Text>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Card withBorder radius="md" padding="md">
            <Title order={5} mb="sm">
              Preview
            </Title>
            <ResourceThumbnail
              sourceId={resourceId}
              height={420}
              lazy={false}
              interactive
              previewStyle={style}
            />
          </Card>

          <Card withBorder radius="md" padding="md">
            <Group justify="space-between" mb="sm">
              <Title order={5}>Estilo</Title>
              <Button loading={saving} onClick={save}>
                {editingId != null ? 'Salvar alterações' : 'Criar estilo'}
              </Button>
            </Group>
            {saved && (
              <Text size="xs" c="green" mb="xs">
                Salvo.
              </Text>
            )}
            {(createStyle.isError || updateStyle.isError) && (
              <Text size="xs" c="red" mb="xs">
                Falha ao salvar (precisa papel admin).
              </Text>
            )}
            <StyleEditor
              style={style}
              columns={columns.data ?? []}
              onChange={(patch) => setStyle((current) => ({ ...current, ...patch }))}
            />
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}
