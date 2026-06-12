// API de resources.
// Tudo passa pela API FastAPI (gateway do Martin); o front nunca fala direto
// com o Martin.
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/http';
import type {
  CatalogResource,
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

// Colunas autoritativas do banco (nome, tipo, nullable) para o drawer.
export function useResourceColumns(tableName: string | null) {
  return useQuery({
    queryKey: ['resources', 'columns', tableName],
    enabled: !!tableName,
    queryFn: () => apiGet<ResourceColumn[]>(`/catalog/resources/${tableName}/columns`),
  });
}
