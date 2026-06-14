// Tipos de catálogo: a árvore de um group-layer (publicação).
import type { FilterRule, LayerStyle } from './style.types';

export type NodeKind = 'folder' | 'layer';

interface BaseNode {
  id: string;
  kind: NodeKind;
  label: string;
  visible: boolean;
}

export interface FolderNode extends BaseNode {
  kind: 'folder';
  expanded: boolean;
  children: TreeNode[];
}

export interface LayerNode extends BaseNode {
  kind: 'layer';
  resourceId: string;
  minZoom?: number | null;
  maxZoom?: number | null;
  filterRules: FilterRule[];
  sqlFilter?: string | null;
  style: LayerStyle;
}

export type TreeNode = FolderNode | LayerNode;

export interface LayerGroupSummary {
  id: number;
  name: string;
  description?: string | null;
  visible: boolean;
  layerCount: number;
  updatedAt: string;
}

export interface LayerGroup extends LayerGroupSummary {
  tree: TreeNode[];
}

// Payload de criação/atualização (a API ignora id/layerCount/updatedAt).
export interface LayerGroupInput {
  name: string;
  description?: string | null;
  visible: boolean;
  tree: TreeNode[];
}
