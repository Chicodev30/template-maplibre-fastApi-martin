// Achata os grupos de camadas publicados (visiveis) numa lista de camadas
// a renderizar no mapa, aplicando overrides de visibilidade do painel.
import { useQueries } from '@tanstack/react-query';
import { apiGet } from '../../app/http';
import { BASE } from '../../catalog/api/groupLayers.api';
import { useLayerGroups } from '../../catalog/api/groupLayers.api';
import type { LayerGroup, TreeNode } from '../../catalog/types/catalog.types';
import type { FilterRule, LayerStyle } from '../../catalog/types/style.types';

export interface ActiveLayer {
  id: string;
  resourceId: string;
  label: string;
  style: LayerStyle;
  minZoom?: number | null;
  maxZoom?: number | null;
  configProfileId?: number | null;
  filterRules: FilterRule[];
  visible: boolean;
}

function flatten(
  nodes: TreeNode[],
  parentVisible: boolean,
  overrides: Record<string, boolean>,
  out: ActiveLayer[],
) {
  for (const node of nodes) {
    const visible = (overrides[node.id] ?? node.visible) && parentVisible;
    if (node.kind === 'folder') {
      flatten(node.children, visible, overrides, out);
    } else {
      out.push({
        id: node.id,
        resourceId: node.resourceId,
        label: node.label,
        style: node.style,
        minZoom: node.minZoom,
        maxZoom: node.maxZoom,
        configProfileId: node.configProfileId,
        filterRules: node.filterRules,
        visible,
      });
    }
  }
}

export function useActiveLayers(visibilityOverrides: Record<string, boolean>): ActiveLayer[] {
  const groups = useLayerGroups();
  const visibleGroups = (groups.data ?? []).filter((g) => g.visible);

  const details = useQueries({
    queries: visibleGroups.map((g) => ({
      queryKey: ['group-layers', g.id],
      queryFn: () => apiGet<LayerGroup>(`${BASE}/${g.id}`),
      staleTime: 60_000,
    })),
  });

  const layers: ActiveLayer[] = [];
  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    const group = visibleGroups[i];
    const groupVisible = visibilityOverrides[`group:${group.id}`] ?? true;
    if (detail.data) {
      flatten(detail.data.tree, groupVisible, visibilityOverrides, layers);
    }
  }
  return layers;
}
