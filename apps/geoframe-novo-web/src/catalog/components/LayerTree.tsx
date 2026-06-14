// Árvore de camadas de um group-layer: renderiza os nós e oferece uma zona
// de drop "raiz" no espaço vazio (mover/adicionar para o fim da raiz).
import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { LayerTreeNode, NODE_MIME, RESOURCE_MIME, type TreeHandlers } from './LayerTreeNode';
import type { TreeNode } from '../types/catalog.types';

export function LayerTree({
  nodes,
  handlers,
  onDropToRoot,
}: {
  nodes: TreeNode[];
  handlers: TreeHandlers;
  onDropToRoot: (payload: { nodeId?: string; resourceId?: string }) => void;
}) {
  const [rootActive, setRootActive] = useState(false);

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        setRootActive(true);
      }}
      onDragLeave={() => setRootActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setRootActive(false);
        const nodeId = e.dataTransfer.getData(NODE_MIME);
        const resourceId = e.dataTransfer.getData(RESOURCE_MIME);
        if (nodeId) onDropToRoot({ nodeId });
        else if (resourceId) onDropToRoot({ resourceId });
      }}
      style={{
        minHeight: 240,
        padding: 6,
        borderRadius: 8,
        outline: rootActive ? '2px dashed var(--mantine-color-blue-4)' : '2px dashed transparent',
        transition: 'outline-color 120ms',
      }}
    >
      {nodes.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Árvore vazia. Adicione recursos pela paleta à esquerda ou crie um grupo interno.
        </Text>
      ) : (
        nodes.map((node) => (
          <LayerTreeNode key={node.id} node={node} depth={0} handlers={handlers} />
        ))
      )}
    </Box>
  );
}
