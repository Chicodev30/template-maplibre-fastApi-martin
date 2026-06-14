// Operações puras e imutáveis sobre a árvore de um group-layer.
// Centraliza a lógica de adicionar/remover/mover/editar nós para manter os
// componentes finos. Folders podem conter folders e camadas; a mesma camada
// (mesmo resourceId) pode aparecer várias vezes, cada nó com id próprio.
import type { CatalogResource } from '../types/resource.types';
import type { FolderNode, LayerNode, TreeNode } from '../types/catalog.types';
import { defaultLayerStyle } from '../types/style.types';

export type DropPosition = 'before' | 'after' | 'inside';

export function newFolder(label = 'Novo grupo'): FolderNode {
  return { id: crypto.randomUUID(), kind: 'folder', label, visible: true, expanded: true, children: [] };
}

export function newLayer(resource: CatalogResource): LayerNode {
  return {
    id: crypto.randomUUID(),
    kind: 'layer',
    label: resource.title,
    visible: true,
    resourceId: resource.id,
    minZoom: null,
    maxZoom: null,
    filterRules: [],
    sqlFilter: null,
    style: defaultLayerStyle(),
  };
}

export function countLayers(nodes: TreeNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total + (node.kind === 'layer' ? 1 : countLayers(node.children)),
    0,
  );
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === 'folder') {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateNode(
  nodes: TreeNode[],
  id: string,
  patch: Partial<TreeNode>,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, ...patch } as TreeNode;
    if (node.kind === 'folder') {
      return { ...node, children: updateNode(node.children, id, patch) };
    }
    return node;
  });
}

// Remove o nó com `id`, retornando a nova árvore e o nó removido (ou null).
export function removeNode(
  nodes: TreeNode[],
  id: string,
): { tree: TreeNode[]; removed: TreeNode | null } {
  let removed: TreeNode | null = null;
  const tree: TreeNode[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
      continue;
    }
    if (node.kind === 'folder') {
      const result = removeNode(node.children, id);
      if (result.removed) removed = result.removed;
      tree.push({ ...node, children: result.tree });
    } else {
      tree.push(node);
    }
  }
  return { tree, removed };
}

function isOrContains(node: TreeNode, id: string): boolean {
  if (node.id === id) return true;
  if (node.kind === 'folder') return node.children.some((child) => isOrContains(child, id));
  return false;
}

// Insere `node` na raiz (índice no fim por padrão).
export function appendToRoot(nodes: TreeNode[], node: TreeNode): TreeNode[] {
  return [...nodes, node];
}

// Insere `node` como último filho da folder alvo.
function insertInside(nodes: TreeNode[], folderId: string, node: TreeNode): TreeNode[] {
  return nodes.map((current) => {
    if (current.id === folderId && current.kind === 'folder') {
      return { ...current, children: [...current.children, node], expanded: true };
    }
    if (current.kind === 'folder') {
      return { ...current, children: insertInside(current.children, folderId, node) };
    }
    return current;
  });
}

// Insere `node` antes/depois do alvo, no mesmo nível do alvo.
function insertBeside(
  nodes: TreeNode[],
  targetId: string,
  node: TreeNode,
  position: 'before' | 'after',
): TreeNode[] {
  const index = nodes.findIndex((current) => current.id === targetId);
  if (index >= 0) {
    const at = position === 'before' ? index : index + 1;
    return [...nodes.slice(0, at), node, ...nodes.slice(at)];
  }
  return nodes.map((current) =>
    current.kind === 'folder'
      ? { ...current, children: insertBeside(current.children, targetId, node, position) }
      : current,
  );
}

// Move `dragId` relativamente a `targetId`. Ignora movimentos inválidos
// (dentro de si mesmo / em descendente). targetId === null => raiz (fim).
export function moveNode(
  nodes: TreeNode[],
  dragId: string,
  targetId: string | null,
  position: DropPosition,
): TreeNode[] {
  if (dragId === targetId) return nodes;
  const dragged = findNode(nodes, dragId);
  if (!dragged) return nodes;
  // Não pode soltar um nó dentro da própria subárvore.
  if (targetId && isOrContains(dragged, targetId)) return nodes;

  const { tree, removed } = removeNode(nodes, dragId);
  if (!removed) return nodes;

  if (targetId === null) return appendToRoot(tree, removed);
  if (position === 'inside') return insertInside(tree, targetId, removed);
  return insertBeside(tree, targetId, removed, position);
}
