// API de resources.
// Tudo passa pela API FastAPI (gateway do Martin); o front nunca fala direto
// com o Martin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../../app/http';
import type {
  CatalogResource,
  ResourceAttributes,
  ResourceConfig,
  ResourceOverrides,
  MartinCatalog,
  ResourceColumn,
  ResourceMetadata,
  TileJson,
} from '../types/resource.types';

// Deriva o item da galeria a partir do source id e da description do Martin.
// id: "schema.table" | description: "schema.table.geom"
function toResource(id: string, description: string): CatalogResource {
  const [schemaName, ...rest] = id.split('.');
  const tableName = rest.join('.') || id;
  const geometryColumn = description.split('.').slice(2).join('.') || 'geom';
  return {
    id,
    schemaName,
    tableName,
    geometryColumn,
    title: `${tableName}.${geometryColumn}`,
  };
}

// Catalogo MVT (via API -> Martin).
export function useCatalogResources() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async (): Promise<CatalogResource[]> => {
      const catalog = await apiGet<MartinCatalog>('/tiles/catalog');
      return Object.entries(catalog.tiles)
        .map(([id, info]) => toResource(id, info.description))
        .sort((a, b) => a.title.localeCompare(b.title));
    },
  });
}

// Metadados do banco (FastAPI), indexados por source id schema.table.
export function useResourceMetadata() {
  return useQuery({
    queryKey: ['resources', 'metadata'],
    queryFn: async (): Promise<Record<string, ResourceMetadata>> => {
      const list = await apiGet<ResourceMetadata[]>('/catalog/resources');
      return Object.fromEntries(list.map((m) => [m.id, m]));
    },
  });
}

// TileJSON (via API): bounds para o thumbnail + fields/tipos da camada.
export function useTileJson(sourceId: string) {
  return useQuery({
    queryKey: ['tilejson', sourceId],
    queryFn: () => apiGet<TileJson>(`/tiles/${sourceId}`),
    staleTime: 5 * 60 * 1000,
    enabled: !!sourceId,
  });
}

// Colunas autoritativas do banco (nome, tipo, nullable) para a configuracao.
export function useResourceColumns(tableName: string | null) {
  return useQuery({
    queryKey: ['resources', 'columns', tableName],
    enabled: !!tableName,
    queryFn: () => apiGet<ResourceColumn[]>(`/catalog/resources/${tableName}/columns`),
  });
}

// Overrides de catalogo (bbox manual + feicoes excluidas) so para os recursos
// que tem algo configurado - usado na galeria e no mapa.
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
        params.set('filter_operator', filterOperator);
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
