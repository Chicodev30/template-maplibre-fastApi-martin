// API de resources.
// Recursos sao camadas GeoServer adicionadas manualmente pelo admin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../app/http';
import type {
  CatalogResource,
  ResourceAttributes,
  ResourceConfig,
  ResourceOverrides,
} from '../types/resource.types';

// Lista de recursos cadastrados (DB).
export function useCatalogResources() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogResource[]>('/catalog/resources'),
  });
}


// Overrides de catalogo (bbox manual + feicoes excluidas).
export function useResourceOverrides() {
  return useQuery({
    queryKey: ['resources', 'overrides'],
    queryFn: () => apiGet<ResourceOverrides>('/catalog/resources/overrides'),
    staleTime: 60 * 1000,
  });
}

export function useResourceConfig(sourceId: string | null) {
  return useQuery({
    queryKey: ['resources', 'config', sourceId],
    enabled: !!sourceId,
    retry: false,
    queryFn: () =>
      apiGet<ResourceConfig>(`/catalog/resources/${encodeURIComponent(sourceId ?? '')}/config`),
  });
}

export function useSaveResourceConfig(sourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: ResourceConfig) =>
      apiPut<ResourceConfig>(
        `/catalog/resources/${encodeURIComponent(sourceId)}/config`,
        config,
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(['resources', 'config', sourceId], saved);
    },
  });
}

export function useResourceAttributes(
  sourceId: string | null,
  opened: boolean,
  limit: number,
  offset: number,
  filterColumn: string | null,
  filterOperator: string,
  filterValue: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc',
  // extraFilters e bbox eram PostGIS; ignorados agora (WFS usa CQL simples)
  _extraFilters?: unknown,
  _bbox?: unknown,
) {
  return useQuery({
    queryKey: [
      'resources',
      'attributes',
      sourceId,
      limit,
      offset,
      filterColumn,
      filterOperator,
      filterValue,
      sortColumn,
      sortDirection,
    ],
    enabled: !!sourceId && opened,
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        sort_direction: sortDirection,
      });
      if (filterColumn) {
        params.set('filter_column', filterColumn);
        if (filterValue.trim()) {
          params.set('filter_value', filterValue.trim());
        }
      }
      if (sortColumn) {
        params.set('sort_column', sortColumn);
      }
      return apiGet<ResourceAttributes>(
        `/catalog/resources/${encodeURIComponent(sourceId ?? '')}/attributes?${params.toString()}`,
      );
    },
    placeholderData: (previous) => previous,
  });
}

export function useSaveThumbnail(sourceId: string) {
  return useMutation({
    mutationFn: (thumbnail: string) =>
      apiPost<void>(`/catalog/resources/${encodeURIComponent(sourceId)}/thumbnail`, { thumbnail }),
  });
}

export function thumbnailUrl(sourceId: string): string {
  return `/api/catalog/resources/${encodeURIComponent(sourceId)}/thumbnail`;
}

// Campos da camada via WFS DescribeFeatureType.
export function useResourceFields(sourceId: string | null) {
  return useQuery({
    queryKey: ['resources', 'fields', sourceId],
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      apiGet<import('../types/resource.types').ResourceColumn[]>(
        `/catalog/resources/${encodeURIComponent(sourceId ?? '')}/fields`,
      ),
  });
}

// GeoServer discovery: workspaces e layers disponíveis.
export function useGeoServerWorkspaces() {
  return useQuery({
    queryKey: ['geoserver', 'workspaces'],
    queryFn: () => apiGet<string[]>('/catalog/geoserver/workspaces'),
    staleTime: 60 * 1000,
  });
}

export function useGeoServerLayers(workspace: string | null) {
  return useQuery({
    queryKey: ['geoserver', 'layers', workspace],
    enabled: !!workspace,
    queryFn: () => apiGet<string[]>(`/catalog/geoserver/workspaces/${workspace}/layers`),
    staleTime: 60 * 1000,
  });
}

// Adicionar recurso manualmente.
export function useAddResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { source_id: string; layer_label: string }) =>
      apiPost<CatalogResource>('/catalog/resources', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Stubs mantidos para compatibilidade de paineis do mapa ainda nao refatorados.
// ---------------------------------------------------------------------------

/** @deprecated PostGIS removido — retorna vazio. */
export function useResourceColumns(_tableName: string | null) {
  return useQuery({
    queryKey: ['resources', 'columns', _tableName],
    enabled: false,
    queryFn: async () => [] as import('../types/resource.types').ResourceColumn[],
  });
}

/** @deprecated PostGIS removido — retorna objeto vazio. */
export function useResourceMetadata() {
  return useQuery({
    queryKey: ['resources', 'metadata'],
    enabled: false,
    queryFn: async () => ({} as Record<string, never>),
  });
}

/** @deprecated Busca PostGIS removida — retorna vazio. */
export function useKeywordSearch(
  _q: string,
  _resourceIds: string[] | null,
  _limit: number,
  _offset: number,
  _enabled: boolean,
) {
  return useQuery({
    queryKey: ['resources', 'keyword-search', _q],
    enabled: false,
    queryFn: async () =>
      ({
        q: _q,
        limit: _limit,
        offset: _offset,
        total: 0,
        results: [],
      } as import('../types/resource.types').KeywordSearchResponse),
  });
}

/** @deprecated PostGIS removido — retorna vazio. */
export function useResourceFieldValues(
  _sourceId: string | null,
  _column: string | null,
  _query: string,
  _enabled = true,
) {
  return useQuery({
    queryKey: ['resources', 'values', _sourceId, _column, _query],
    enabled: false,
    queryFn: async () => [] as string[],
  });
}

// Remover recurso.
export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) =>
      apiDelete(`/catalog/resources/${encodeURIComponent(sourceId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
