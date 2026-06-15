// Painel "Legendas": mostra as camadas publicadas na ordem dos grupos e
// permite ajustes temporarios de opacidade e rotulo no mapa.
import { useQueries } from '@tanstack/react-query';
import { ActionIcon, Box, Center, Group, Loader, Paper, Slider, Stack, Switch, Text } from '@mantine/core';
import { apiGet } from '../../app/http';
import { BASE, useLayerGroups } from '../../catalog/api/groupLayers.api';
import { useResourceMetadata } from '../../catalog/api/resources.api';
import type { LayerGroup, LayerNode, TreeNode } from '../../catalog/types/catalog.types';
import { EyeIcon, FolderIcon, LabelIcon } from './icons';

export interface LegendOverride {
  opacity?: number;
  labelVisible?: boolean;
}

interface LegendLayer {
  layer: LayerNode;
  visible: boolean;
}

function flattenLayers(
  nodes: TreeNode[],
  overrides: Record<string, boolean>,
  parentVisible = true,
  out: LegendLayer[] = [],
) {
  for (const node of nodes) {
    const visible = (overrides[node.id] ?? node.visible) && parentVisible;
    if (node.kind === 'folder') flattenLayers(node.children, overrides, visible, out);
    else out.push({ layer: node, visible });
  }
  return out;
}

export type GeometryKind = 'polygon' | 'line' | 'point' | 'unknown';

export function geometryKind(geometryType?: string | null): GeometryKind {
  const value = geometryType?.toLowerCase() ?? '';
  if (value.includes('polygon') || value.includes('surface')) return 'polygon';
  if (value.includes('line') || value.includes('curve')) return 'line';
  if (value.includes('point')) return 'point';
  return 'unknown';
}

function LegendSymbol({
  layer,
  opacity,
  geometryType,
}: {
  layer: LayerNode;
  opacity: number;
  geometryType?: string | null;
}) {
  const lineColor = layer.style.outlineColor || layer.style.color;
  const lineWidth = Math.max(1, layer.style.outlineWidth || 1);
  const kind = geometryKind(geometryType);

  if (kind === 'line') {
    return (
      <Box w={30} h={22} style={{ position: 'relative', flex: '0 0 auto' }} aria-hidden="true">
        <Box
          style={{
            position: 'absolute',
            left: 3,
            right: 3,
            top: 10,
            height: Math.max(2, lineWidth),
            borderRadius: 99,
            background: lineColor,
          }}
        />
      </Box>
    );
  }

  if (kind === 'point') {
    return (
      <Box w={30} h={22} style={{ position: 'relative', flex: '0 0 auto' }} aria-hidden="true">
        <Box
          style={{
            position: 'absolute',
            left: 10,
            top: 6,
            width: 10,
            height: 10,
            borderRadius: 99,
            background: layer.style.color,
            border: `${lineWidth}px solid ${lineColor}`,
            opacity,
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      w={30}
      h={22}
      style={{ position: 'relative', flex: '0 0 auto' }}
      aria-hidden="true"
    >
      <Box
        style={{
          position: 'absolute',
          left: 5,
          top: 4,
          width: 18,
          height: 14,
          borderRadius: 3,
          background: layer.style.color,
          border: `${lineWidth}px solid ${lineColor}`,
          opacity,
        }}
      />
    </Box>
  );
}

function LegendLayerRow({
  layer,
  visible,
  geometryType,
  override,
  onOpacityChange,
  onLabelVisibleChange,
}: {
  layer: LayerNode;
  visible: boolean;
  geometryType?: string | null;
  override?: LegendOverride;
  onOpacityChange: (layerId: string, opacity: number) => void;
  onLabelVisibleChange: (layerId: string, visible: boolean) => void;
}) {
  const opacity = override?.opacity ?? layer.style.opacity;
  const labelVisible = override?.labelVisible ?? layer.style.label.enabled;
  const hasLabel = !!layer.style.label.field;

  return (
    <Paper withBorder radius="sm" p={8} bg={visible ? 'white' : 'gray.0'} style={{ opacity: visible ? 1 : 0.62 }}>
      <Stack gap={6}>
        <Group gap={8} wrap="nowrap" align="center">
          <LegendSymbol layer={layer} opacity={opacity} geometryType={geometryType} />
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={500} lineClamp={1}>
              {layer.label}
            </Text>
            <Text size="10px" c="dimmed" lineClamp={1}>
              {layer.resourceId}
            </Text>
          </Box>
          <ActionIcon variant="subtle" color={visible ? 'blue' : 'gray'} size="xs" aria-label={visible ? 'Visivel' : 'Oculta'}>
            <EyeIcon off={!visible} />
          </ActionIcon>
        </Group>

        <Group gap={8} wrap="nowrap">
          <Text size="10px" c="dimmed" w={72}>
            Transparencia
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(value) => onOpacityChange(layer.id, value)}
            label={(value) => `${Math.round(value * 100)}%`}
            size="xs"
            color="teal"
            style={{ flex: 1 }}
          />
          <Text size="10px" c="dimmed" w={32} ta="right">
            {Math.round(opacity * 100)}%
          </Text>
        </Group>

        <Group justify="space-between" gap={8} wrap="nowrap">
          <Group gap={5} wrap="nowrap" c={hasLabel ? 'gray.7' : 'dimmed'}>
            <LabelIcon />
            <Text size="10px">Rotulo</Text>
          </Group>
          <Switch
            size="xs"
            checked={labelVisible && hasLabel}
            disabled={!hasLabel}
            aria-label="Exibir rotulo"
            onChange={(event) => onLabelVisibleChange(layer.id, event.currentTarget.checked)}
          />
        </Group>
      </Stack>
    </Paper>
  );
}

export function LegendsPanel({
  visibilityOverrides,
  legendOverrides,
  onOpacityChange,
  onLabelVisibleChange,
}: {
  visibilityOverrides: Record<string, boolean>;
  legendOverrides: Record<string, LegendOverride>;
  onOpacityChange: (layerId: string, opacity: number) => void;
  onLabelVisibleChange: (layerId: string, visible: boolean) => void;
}) {
  const groups = useLayerGroups();
  const metadata = useResourceMetadata();
  const visibleGroups = (groups.data ?? []).filter((group) => group.visible);
  const details = useQueries({
    queries: visibleGroups.map((group) => ({
      queryKey: ['group-layers', group.id],
      queryFn: () => apiGet<LayerGroup>(`${BASE}/${group.id}`),
      staleTime: 60_000,
    })),
  });

  if (groups.isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        Nenhuma legenda disponivel.
      </Text>
    );
  }

  return (
    <Stack gap={8} p={8}>
      {visibleGroups.map((group, index) => {
        const detail = details[index];
        const groupVisible = visibilityOverrides[`group:${group.id}`] ?? true;
        const layers = detail.data ? flattenLayers(detail.data.tree, visibilityOverrides, groupVisible) : [];

        return (
          <Box key={group.id}>
            <Group gap={6} wrap="nowrap" mb={6}>
              <Box c="gray.6" style={{ display: 'flex' }} aria-hidden="true">
                <FolderIcon />
              </Box>
              <Text size="xs" fw={700} style={{ flex: 1 }} lineClamp={1}>
                {group.name}
              </Text>
              <Text size="10px" c="dimmed">
                {layers.length || group.layerCount}
              </Text>
            </Group>

            {detail.isLoading ? (
              <Center py="xs">
                <Loader size="xs" />
              </Center>
            ) : layers.length > 0 && detail.data ? (
              <Stack gap={6}>
                {layers.map(({ layer, visible }) => (
                  <LegendLayerRow
                    key={layer.id}
                    layer={layer}
                    visible={visible}
                    geometryType={metadata.data?.[layer.resourceId]?.geometry_type}
                    override={legendOverrides[layer.id]}
                    onOpacityChange={onOpacityChange}
                    onLabelVisibleChange={onLabelVisibleChange}
                  />
                ))}
              </Stack>
            ) : (
              <Text size="xs" c="dimmed" pl={20} py={2}>
                Sem legendas neste grupo.
              </Text>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
