// Builder de um grupo de camadas: paleta de recursos (esq.), árvore (centro)
// e inspetor do nó selecionado (dir.). Monta a árvore que o app vai renderizar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  RangeSlider,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import {
  useCreateLayerGroup,
  useLayerGroup,
  useUpdateLayerGroup,
} from '../../catalog/api/groupLayers.api';
import { useResourceConfigProfiles } from '../../catalog/api/configProfiles.api';
import { useLayerStyle, useResourceStyles } from '../../catalog/api/layerStyles.api';
import { useCatalogResources, useResourceColumns } from '../../catalog/api/resources.api';
import { LayerTree } from '../../catalog/components/LayerTree';
import { RESOURCE_MIME, type TreeHandlers } from '../../catalog/components/LayerTreeNode';
import { StyleEditor } from '../../catalog/components/StyleEditor';
import {
  appendToRoot,
  findNode,
  moveNode,
  newFolder,
  newLayer,
  removeNode,
  updateNode,
  type DropPosition,
} from '../../catalog/utils/treeOps';
import type { CatalogResource } from '../../catalog/types/resource.types';
import type { LayerNode, TreeNode } from '../../catalog/types/catalog.types';
import { FILTER_OPERATORS, defaultLayerStyle, type FilterOperator } from '../../catalog/types/style.types';

function tableNameOf(resourceId: string) {
  return resourceId.split('.').slice(1).join('.') || resourceId;
}

export function GroupLayerBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editingId = id && id !== 'new' ? Number(id) : null;

  const existing = useLayerGroup(editingId);
  const catalog = useCatalogResources();
  const createGroup = useCreateLayerGroup();
  const updateGroup = useUpdateLayerGroup(editingId ?? 0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const hydrated = useRef(false);

  // Hidrata o estado uma vez quando editando um grupo existente.
  useEffect(() => {
    if (editingId == null || hydrated.current || !existing.data) return;
    setName(existing.data.name);
    setDescription(existing.data.description ?? '');
    setVisible(existing.data.visible);
    setTree(existing.data.tree);
    hydrated.current = true;
  }, [editingId, existing.data]);

  const selectedNode = useMemo(
    () => (selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );
  const selectedLayer = selectedNode?.kind === 'layer' ? selectedNode : null;
  const columns = useResourceColumns(selectedLayer ? tableNameOf(selectedLayer.resourceId) : null);

  const resources = useMemo(() => {
    const list = catalog.data ?? [];
    const q = search.trim().toLowerCase();
    return q
      ? list.filter((r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      : list;
  }, [catalog.data, search]);

  const resourceById = useMemo(() => {
    const map = new Map<string, CatalogResource>();
    for (const r of catalog.data ?? []) map.set(r.id, r);
    return map;
  }, [catalog.data]);

  function patchNode(nodeId: string, patch: Partial<TreeNode>) {
    setTree((current) => updateNode(current, nodeId, patch));
  }

  function patchLayer(patch: Partial<LayerNode>) {
    if (selectedLayer) patchNode(selectedLayer.id, patch as Partial<TreeNode>);
  }

  function addLayer(resource: CatalogResource) {
    const layer = newLayer(resource);
    setTree((current) => {
      const withLayer = appendToRoot(current, layer);
      // Se há uma folder selecionada, joga a camada para dentro dela.
      if (selectedNode?.kind === 'folder') {
        return moveNode(withLayer, layer.id, selectedNode.id, 'inside');
      }
      return withLayer;
    });
    setSelectedId(layer.id);
  }

  function addFolder() {
    const folder = newFolder();
    setTree((current) => {
      const withFolder = appendToRoot(current, folder);
      if (selectedNode?.kind === 'folder') {
        return moveNode(withFolder, folder.id, selectedNode.id, 'inside');
      }
      return withFolder;
    });
    setSelectedId(folder.id);
  }

  function handleDrop(
    payload: { nodeId?: string; resourceId?: string },
    targetId: string,
    position: DropPosition,
  ) {
    if (payload.nodeId) {
      setTree((current) => moveNode(current, payload.nodeId!, targetId, position));
      return;
    }
    if (payload.resourceId) {
      const resource = resourceById.get(payload.resourceId);
      if (!resource) return;
      const layer = newLayer(resource);
      setTree((current) => moveNode(appendToRoot(current, layer), layer.id, targetId, position));
      setSelectedId(layer.id);
    }
  }

  function handleDropToRoot(payload: { nodeId?: string; resourceId?: string }) {
    if (payload.nodeId) {
      setTree((current) => moveNode(current, payload.nodeId!, null, 'after'));
      return;
    }
    if (payload.resourceId) {
      const resource = resourceById.get(payload.resourceId);
      if (!resource) return;
      const layer = newLayer(resource);
      setTree((current) => appendToRoot(current, layer));
      setSelectedId(layer.id);
    }
  }

  const handlers: TreeHandlers = {
    selectedId,
    onSelect: setSelectedId,
    onToggleVisible: (nodeId) => {
      const node = findNode(tree, nodeId);
      if (node) patchNode(nodeId, { visible: !node.visible });
    },
    onToggleExpand: (nodeId) => {
      const node = findNode(tree, nodeId);
      if (node?.kind === 'folder') patchNode(nodeId, { expanded: !node.expanded } as Partial<TreeNode>);
    },
    onRemove: (nodeId) => {
      setTree((current) => removeNode(current, nodeId).tree);
      setSelectedId((sel) => (sel === nodeId ? null : sel));
    },
    onDrop: handleDrop,
  };

  function save() {
    const payload = { name: name.trim() || 'Sem nome', description, visible, tree };
    if (editingId != null) {
      updateGroup.mutate(payload);
    } else {
      createGroup.mutate(payload, {
        onSuccess: (saved) => navigate(`/admin/catalog/group-layers/${saved.id}`),
      });
    }
  }

  const saving = createGroup.isPending || updateGroup.isPending;
  const saved = createGroup.isSuccess || updateGroup.isSuccess;

  if (editingId != null && existing.isLoading) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }
  if (editingId != null && existing.isError) {
    return <Text c="red">Grupo de camadas não encontrado.</Text>;
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/catalog/group-layers" size="sm">
        Voltar para grupos de camadas
      </Anchor>

      <Group justify="space-between" align="flex-end">
        <div style={{ flex: 1, maxWidth: 640 }}>
          <TextInput
            label="Nome do grupo"
            placeholder="Ex.: Mapa base, Infraestrutura..."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            mb="xs"
          />
          <TextInput
            label="Descrição"
            placeholder="Opcional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </div>
        <Stack gap="xs" align="flex-end">
          <Switch
            label="Visível no app"
            checked={visible}
            onChange={(e) => setVisible(e.currentTarget.checked)}
          />
          <Button loading={saving} onClick={save}>
            {editingId != null ? 'Salvar alterações' : 'Criar grupo'}
          </Button>
          {saved && (
            <Text size="xs" c="green">
              Salvo.
            </Text>
          )}
          {(createGroup.isError || updateGroup.isError) && (
            <Text size="xs" c="red">
              Falha ao salvar (precisa papel admin).
            </Text>
          )}
        </Stack>
      </Group>

      <Grid gap="md">
        {/* Paleta de recursos */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder radius="md" padding="sm" h="100%">
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                Recursos
              </Text>
              <Badge variant="light" size="sm">
                {resources.length}
              </Badge>
            </Group>
            <Button variant="light" size="xs" fullWidth mb="xs" onClick={addFolder}>
              + Grupo interno
            </Button>
            <TextInput
              placeholder="Filtrar..."
              size="xs"
              mb="xs"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            {catalog.isLoading ? (
              <Center h={120}>
                <Loader size="sm" />
              </Center>
            ) : (
              <ScrollArea h={460}>
                <Stack gap={4}>
                  {resources.map((resource) => (
                    <Group
                      key={resource.id}
                      gap={6}
                      wrap="nowrap"
                      px={6}
                      py={4}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(RESOURCE_MIME, resource.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      style={{ borderRadius: 6, cursor: 'grab', border: '1px solid var(--mantine-color-gray-2)' }}
                    >
                      <Text size="sm" style={{ flex: 1 }} lineClamp={1} title={resource.id}>
                        {resource.title}
                      </Text>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label={`Adicionar ${resource.title}`}
                        onClick={() => addLayer(resource)}
                      >
                        +
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Card>
        </Grid.Col>

        {/* Árvore */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="md" padding="sm" h="100%">
            <Text fw={600} size="sm" mb="xs">
              Árvore do grupo
            </Text>
            <ScrollArea h={520}>
              <LayerTree nodes={tree} handlers={handlers} onDropToRoot={handleDropToRoot} />
            </ScrollArea>
          </Card>
        </Grid.Col>

        {/* Inspetor */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" padding="md" h="100%">
            {!selectedNode ? (
              <Center h={200}>
                <Text size="sm" c="dimmed" ta="center">
                  Selecione um nó da árvore para editar suas propriedades.
                </Text>
              </Center>
            ) : selectedNode.kind === 'folder' ? (
              <Stack gap="sm">
                <Title order={5}>Grupo interno</Title>
                <TextInput
                  label="Rótulo"
                  value={selectedNode.label}
                  onChange={(e) => patchNode(selectedNode.id, { label: e.currentTarget.value })}
                />
                <Switch
                  label="Visível por padrão"
                  checked={selectedNode.visible}
                  onChange={(e) => patchNode(selectedNode.id, { visible: e.currentTarget.checked })}
                />
                <Switch
                  label="Expandido por padrão"
                  checked={selectedNode.expanded}
                  onChange={(e) =>
                    patchNode(selectedNode.id, { expanded: e.currentTarget.checked } as Partial<TreeNode>)
                  }
                />
              </Stack>
            ) : (
              <LayerInspector
                layer={selectedLayer!}
                columns={columns.data ?? []}
                onPatch={patchLayer}
              />
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function LayerInspector({
  layer,
  columns,
  onPatch,
}: {
  layer: LayerNode;
  columns: { name: string; data_type: string; nullable: boolean }[];
  onPatch: (patch: Partial<LayerNode>) => void;
}) {
  const style = layer.style ?? defaultLayerStyle();
  const zoom: [number, number] = [layer.minZoom ?? 0, layer.maxZoom ?? 22];
  const fieldOptions = columns.map((c) => ({ value: c.name, label: c.name }));

  const configProfiles = useResourceConfigProfiles(layer.resourceId);
  const configProfileOptions = [
    { value: '', label: 'Nenhum (default)' },
    ...(configProfiles.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const presets = useResourceStyles(layer.resourceId);
  const [presetId, setPresetId] = useState<number | null>(null);
  const presetDetail = useLayerStyle(presetId);
  const presetOptions = [
    { value: '', label: 'Nenhum (personalizado)' },
    ...(presets.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
  ];

  // Reseta a seleção de preset ao trocar de camada selecionada.
  useEffect(() => {
    setPresetId(null);
  }, [layer.id]);

  // Aplica o estilo do preset escolhido (copia "one-shot", sem vínculo continuo).
  useEffect(() => {
    if (presetId == null || !presetDetail.data) return;
    onPatch({ style: { ...presetDetail.data.style } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetDetail.data]);

  return (
    <ScrollArea h={560}>
      <Stack gap="sm" pr="xs">
        <div>
          <Title order={5}>Camada</Title>
          <Text size="xs" c="dimmed">
            {layer.resourceId}
          </Text>
        </div>

        <TextInput
          label="Rótulo"
          value={layer.label}
          onChange={(e) => onPatch({ label: e.currentTarget.value })}
        />

        <Switch
          label="Visível por padrão"
          checked={layer.visible}
          onChange={(e) => onPatch({ visible: e.currentTarget.checked })}
        />

        <div>
          <Text size="sm" fw={500} mb={4}>
            Escala de zoom — {zoom[0]} a {zoom[1]}
          </Text>
          <RangeSlider
            min={0}
            max={22}
            step={1}
            minRange={0}
            value={zoom}
            onChange={([min, max]) => onPatch({ minZoom: min, maxZoom: max })}
            marks={[
              { value: 0, label: '0' },
              { value: 11, label: '11' },
              { value: 22, label: '22' },
            ]}
          />
        </div>

        <Select
          label="Configuracao"
          description="Perfil de campos/seguranca/zoom desta camada. Sem perfil, vale o default do recurso."
          data={configProfileOptions}
          value={layer.configProfileId != null ? String(layer.configProfileId) : ''}
          onChange={(value) =>
            onPatch({ configProfileId: value ? Number(value) : null })
          }
        />

        <Divider label="Filtro" labelPosition="left" mt="sm" />
        <Text size="xs" c="dimmed">
          Regras de campo (vira filtro MapLibre no app). Adicione uma ou mais.
        </Text>
        <Stack gap="xs">
          {layer.filterRules.map((rule) => (
            <Group key={rule.id} gap={4} wrap="nowrap" align="flex-end">
              <Select
                placeholder="Campo"
                data={fieldOptions}
                value={rule.field || null}
                searchable
                size="xs"
                style={{ flex: 1 }}
                onChange={(field) =>
                  onPatch({
                    filterRules: layer.filterRules.map((r) =>
                      r.id === rule.id ? { ...r, field: field ?? '' } : r,
                    ),
                  })
                }
              />
              <Select
                data={FILTER_OPERATORS}
                value={rule.operator}
                size="xs"
                w={96}
                onChange={(op) =>
                  onPatch({
                    filterRules: layer.filterRules.map((r) =>
                      r.id === rule.id ? { ...r, operator: (op as FilterOperator) ?? 'equals' } : r,
                    ),
                  })
                }
              />
              <TextInput
                placeholder="Valor"
                value={rule.value}
                size="xs"
                w={90}
                onChange={(e) =>
                  onPatch({
                    filterRules: layer.filterRules.map((r) =>
                      r.id === rule.id ? { ...r, value: e.currentTarget.value } : r,
                    ),
                  })
                }
              />
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label="Remover regra"
                onClick={() =>
                  onPatch({ filterRules: layer.filterRules.filter((r) => r.id !== rule.id) })
                }
              >
                ×
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="light"
            size="xs"
            onClick={() =>
              onPatch({
                filterRules: [
                  ...layer.filterRules,
                  { id: crypto.randomUUID(), field: '', operator: 'equals', value: '' },
                ],
              })
            }
          >
            + Regra de filtro
          </Button>
        </Stack>

        <Textarea
          label="SQL filter (avançado, opcional)"
          placeholder="ex.: populacao > 1000 AND tipo = 'urbano'"
          autosize
          minRows={2}
          value={layer.sqlFilter ?? ''}
          onChange={(e) => onPatch({ sqlFilter: e.currentTarget.value })}
        />

        <Divider label="Estilo" labelPosition="left" mt="sm" />
        <Select
          label="Estilo salvo"
          description="Aplica um preset salvo em Catálogo > Estilização (cópia única, editável depois)."
          data={presetOptions}
          value={presetId != null ? String(presetId) : ''}
          onChange={(value) => setPresetId(value ? Number(value) : null)}
          allowDeselect={false}
        />
        <Box>
          <StyleEditor
            style={style}
            columns={columns}
            onChange={(patch) => onPatch({ style: { ...style, ...patch } })}
          />
        </Box>
      </Stack>
    </ScrollArea>
  );
}
