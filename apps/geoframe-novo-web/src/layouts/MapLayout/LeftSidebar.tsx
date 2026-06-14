// Painel "Camadas": lista os grupos de camadas publicados no admin como
// pastas (com grupos internos e camadas dentro), em modo leitura.
import { useState } from 'react';
import { ActionIcon, Badge, Box, Center, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core';
import { useLayerGroup, useLayerGroups } from '../../catalog/api/groupLayers.api';
import type { LayerNode, TreeNode } from '../../catalog/types/catalog.types';
import { ChevronIcon, CollapseIcon, EyeIcon, FolderIcon, LayerIcon, TableIcon } from './icons';

// Nó da árvore de um grupo (folder interno ou camada), só leitura.
function TreeRow({
  node,
  depth,
  visibilityOverrides,
  onToggleVisible,
  onOpenTable,
}: {
  node: TreeNode;
  depth: number;
  visibilityOverrides: Record<string, boolean>;
  onToggleVisible: (id: string, visible: boolean) => void;
  onOpenTable: (node: LayerNode) => void;
}) {
  const [expanded, setExpanded] = useState(node.kind === 'folder' ? node.expanded : false);
  const visible = visibilityOverrides[node.id] ?? node.visible;
  const isFolder = node.kind === 'folder';

  return (
    <Box>
      <Group gap={2} wrap="nowrap" px={4} py={3} style={{ marginLeft: depth * 14, borderRadius: 4 }}>
        {isFolder ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
            onClick={() => setExpanded((e) => !e)}
          >
            <ChevronIcon open={expanded} />
          </ActionIcon>
        ) : (
          <Box w={18} />
        )}

        <Box c="gray.6" style={{ display: 'flex' }} aria-hidden="true">
          {isFolder ? <FolderIcon /> : <LayerIcon />}
        </Box>

        <Text size="xs" fw={isFolder ? 600 : 400} style={{ flex: 1 }} lineClamp={1}>
          {node.label}
        </Text>

        {!isFolder && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label="Abrir tabela de atributos"
            onClick={() => onOpenTable(node)}
          >
            <TableIcon />
          </ActionIcon>
        )}

        <ActionIcon
          variant="subtle"
          color={visible ? 'blue' : 'gray'}
          size="xs"
          aria-label={visible ? 'Ocultar' : 'Mostrar'}
          onClick={() => onToggleVisible(node.id, !visible)}
        >
          <EyeIcon off={!visible} />
        </ActionIcon>
      </Group>

      {isFolder && expanded && (
        <Box>
          {node.children.length === 0 ? (
            <Text size="xs" c="dimmed" style={{ marginLeft: depth * 14 + 36 }} py={2}>
              Vazio
            </Text>
          ) : (
            node.children.map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                visibilityOverrides={visibilityOverrides}
                onToggleVisible={onToggleVisible}
                onOpenTable={onOpenTable}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

// Um grupo de camadas publicado (raiz da árvore), representado como pasta.
function LayerGroupFolder({
  id,
  name,
  layerCount,
  visibilityOverrides,
  onToggleVisible,
  onOpenTable,
}: {
  id: number;
  name: string;
  layerCount: number;
  visibilityOverrides: Record<string, boolean>;
  onToggleVisible: (id: string, visible: boolean) => void;
  onOpenTable: (node: LayerNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detail = useLayerGroup(expanded ? id : null);

  return (
    <Box>
      <Group
        gap={2}
        wrap="nowrap"
        px={4}
        py={3}
        style={{ cursor: 'pointer', borderRadius: 4 }}
        onClick={() => setExpanded((e) => !e)}
      >
        <ActionIcon variant="subtle" color="gray" size="xs" aria-label={expanded ? 'Recolher' : 'Expandir'}>
          <ChevronIcon open={expanded} />
        </ActionIcon>
        <Box c="gray.6" style={{ display: 'flex' }} aria-hidden="true">
          <FolderIcon />
        </Box>
        <Text size="xs" fw={600} style={{ flex: 1 }} lineClamp={1}>
          {name}
        </Text>
        <Badge size="xs" variant="light" color="gray">
          {layerCount}
        </Badge>
      </Group>

      {expanded && (
        <Box>
          {detail.isLoading ? (
            <Center py="xs">
              <Loader size="xs" />
            </Center>
          ) : detail.data && detail.data.tree.length > 0 ? (
            detail.data.tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={1}
                visibilityOverrides={visibilityOverrides}
                onToggleVisible={onToggleVisible}
                onOpenTable={onOpenTable}
              />
            ))
          ) : (
            <Text size="xs" c="dimmed" style={{ marginLeft: 36 }} py={2}>
              Vazio
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export function LeftSidebar({
  onClose,
  visibilityOverrides,
  onToggleVisible,
  onOpenTable,
}: {
  onClose: () => void;
  visibilityOverrides: Record<string, boolean>;
  onToggleVisible: (id: string, visible: boolean) => void;
  onOpenTable: (node: LayerNode) => void;
}) {
  const groups = useLayerGroups();

  return (
    <Stack gap={0} h="100%">
      <Group
        justify="space-between"
        px="sm"
        py={6}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Text fw={600} size="sm">
          Camadas
        </Text>
        <ActionIcon variant="subtle" color="gray" size="xs" aria-label="Esconder painel" onClick={onClose}>
          <CollapseIcon />
        </ActionIcon>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap={0} p={4}>
          {groups.isLoading ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : groups.data && groups.data.length > 0 ? (
            groups.data.map((g) => (
              <LayerGroupFolder
                key={g.id}
                id={g.id}
                name={g.name}
                layerCount={g.layerCount}
                visibilityOverrides={visibilityOverrides}
                onToggleVisible={onToggleVisible}
                onOpenTable={onOpenTable}
              />
            ))
          ) : (
            <Text size="xs" c="dimmed" ta="center" py="md">
              Nenhum grupo de camadas publicado.
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
