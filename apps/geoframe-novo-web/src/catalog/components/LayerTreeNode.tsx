// Um nó da árvore (folder ou camada) com drag-and-drop HTML5 nativo.
import { useState } from 'react';
import { ActionIcon, Badge, Box, Group, Text } from '@mantine/core';
import type { DropPosition } from '../utils/treeOps';
import type { TreeNode } from '../types/catalog.types';

export const NODE_MIME = 'application/x-node-id';
export const RESOURCE_MIME = 'application/x-resource-id';

export interface TreeHandlers {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRemove: (id: string) => void;
  // dragId vindo da árvore (mover) OU resourceId vindo da paleta (adicionar).
  onDrop: (
    payload: { nodeId?: string; resourceId?: string },
    targetId: string,
    position: DropPosition,
  ) => void;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      {off && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LayerTreeNode({
  node,
  depth,
  handlers,
}: {
  node: TreeNode;
  depth: number;
  handlers: TreeHandlers;
}) {
  const [drop, setDrop] = useState<DropPosition | null>(null);
  const selected = handlers.selectedId === node.id;
  const isFolder = node.kind === 'folder';

  function computePosition(e: React.DragEvent): DropPosition {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (isFolder) {
      const third = rect.height / 3;
      if (y < third) return 'before';
      if (y > 2 * third) return 'after';
      return 'inside';
    }
    return y < rect.height / 2 ? 'before' : 'after';
  }

  return (
    <Box>
      <Group
        gap={4}
        wrap="nowrap"
        px={6}
        py={4}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(NODE_MIME, node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrop(computePosition(e));
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const position = drop ?? computePosition(e);
          setDrop(null);
          const nodeId = e.dataTransfer.getData(NODE_MIME);
          const resourceId = e.dataTransfer.getData(RESOURCE_MIME);
          if (nodeId) handlers.onDrop({ nodeId }, node.id, position);
          else if (resourceId) handlers.onDrop({ resourceId }, node.id, position);
        }}
        onClick={() => handlers.onSelect(node.id)}
        style={{
          marginLeft: depth * 16,
          borderRadius: 6,
          cursor: 'pointer',
          background: selected
            ? 'var(--mantine-color-blue-0)'
            : drop === 'inside'
              ? 'var(--mantine-color-blue-1)'
              : undefined,
          boxShadow: selected ? 'inset 0 0 0 1px var(--mantine-color-blue-4)' : undefined,
          borderTop: drop === 'before' ? '2px solid var(--mantine-color-blue-5)' : '2px solid transparent',
          borderBottom: drop === 'after' ? '2px solid var(--mantine-color-blue-5)' : '2px solid transparent',
        }}
      >
        {isFolder ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={node.expanded ? 'Recolher' : 'Expandir'}
            onClick={(e) => {
              e.stopPropagation();
              handlers.onToggleExpand(node.id);
            }}
          >
            <Chevron open={node.expanded} />
          </ActionIcon>
        ) : (
          <Box w={22} />
        )}

        <Text size="lg" span aria-hidden="true">
          {isFolder ? '📁' : '🗺️'}
        </Text>

        <Text size="sm" fw={isFolder ? 600 : 400} style={{ flex: 1 }} lineClamp={1}>
          {node.label || (isFolder ? 'Grupo' : 'Camada')}
        </Text>

        {node.kind === 'layer' && (
          <Badge size="xs" variant="light" color="gray">
            {node.resourceId.split('.').slice(1).join('.') || node.resourceId}
          </Badge>
        )}

        <ActionIcon
          variant="subtle"
          color={node.visible ? 'blue' : 'gray'}
          size="sm"
          aria-label={node.visible ? 'Ocultar' : 'Mostrar'}
          onClick={(e) => {
            e.stopPropagation();
            handlers.onToggleVisible(node.id);
          }}
        >
          <EyeIcon off={!node.visible} />
        </ActionIcon>

        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          aria-label="Remover"
          onClick={(e) => {
            e.stopPropagation();
            handlers.onRemove(node.id);
          }}
        >
          <TrashIcon />
        </ActionIcon>
      </Group>

      {isFolder && node.expanded && (
        <Box>
          {node.children.length === 0 ? (
            <Text size="xs" c="dimmed" style={{ marginLeft: depth * 16 + 44 }} py={2}>
              Grupo vazio — arraste camadas para cá.
            </Text>
          ) : (
            node.children.map((child) => (
              <LayerTreeNode key={child.id} node={child} depth={depth + 1} handlers={handlers} />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
