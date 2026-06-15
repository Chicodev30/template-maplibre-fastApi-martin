// API de resources.
// Tudo passa pela API FastAPI (gateway do Martin); o front nunca fala direto
// com o Martin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPostForm, apiPut } from '../../app/http';
import type {
  CatalogResource,
  KeywordSearchResponse,
  ResourceAttributes,
  ResourceConfig,
  ResourceOverrides,
  MartinCatalog,
  ResourceColumn,
  ResourceMetadata,
  SearchFilterRule,
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

// Valores distintos de um campo (autocomplete do painel "Buscar").
export function useResourceFieldValues(
  sourceId: string | null,
  column: string | null,
  query: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['resources', 'values', sourceId, column, query],
    enabled: !!sourceId && !!column && enabled,
    staleTime: 30 * 1000,
    queryFn: () => {
      const params = new URLSearchParams({ column: column ?? '', limit: '20' });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      return apiGet<string[]>(
        `/catalog/resources/${encodeURIComponent(sourceId ?? '')}/values?${params.toString()}`,
      );
    },
    placeholderData: (previous) => previous,
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
  extraFilters?: SearchFilterRule[] | null,
  bbox?: [number, number, number, number] | null,
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
      extraFilters ?? null,
      bbox ?? null,
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
      if (extraFilters && extraFilters.length > 0) {
        params.set('filters', JSON.stringify(extraFilters));
      }
      if (bbox) {
        params.set('bbox', bbox.join(','));
      }
      return apiGet<ResourceAttributes>(
        `/catalog/resources/${encodeURIComponent(sourceId ?? '')}/attributes?${params.toString()}`,
      );
    },
    placeholderData: (previous) => previous,
  });
}

// Busca por palavra-chave (painel "Palavra-chave" do menu principal): procura
// o termo em todas as colunas de texto de cada tabela.
export function useKeywordSearch(
  q: string,
  resourceIds: string[] | null,
  limit: number,
  offset: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['resources', 'keyword-search', q, resourceIds, limit, offset],
    enabled: enabled && q.trim().length >= 3,
    queryFn: () => {
      const params = new URLSearchParams({ q: q.trim(), limit: String(limit), offset: String(offset) });
      if (resourceIds && resourceIds.length > 0) {
        params.set('resource_ids', resourceIds.join(','));
      }
      return apiGet<KeywordSearchResponse>(`/catalog/resources/keyword-search?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
}

// Upload de arquivo vetorial -> nova tabela no schema de recursos (Martin
// auto-publica a camada nova em seguida).
export function useUploadResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiPostForm<ResourceMetadata>('/catalog/resources/upload', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'metadata'] });
    },
  });
}
