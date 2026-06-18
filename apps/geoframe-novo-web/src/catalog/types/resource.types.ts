// Tipos de resource.

// TileJSON de uma fonte via API: GET /api/tiles/{sourceId}
export interface TileJson {
  tilejson: string;
  tiles: string[];
  name: string;
  description?: string;
  bounds?: [number, number, number, number];
  vector_layers?: Array<{
    id: string;
    fields: Record<string, string>;
  }>;
}

// Recurso no catalogo: linha da tabela resource_configs.
// GET /api/catalog/resources
export interface CatalogResource {
  id: string;          // workspace.layer
  layerLabel: string;
  thumbnail?: string | null;
}

export interface ResourceFieldConfig {
  label: string;
  searchable: boolean;
  showInTable: boolean;
  showInPopup: boolean;
}

export interface ResourceSecurityRule {
  id: string;
  type: 'hide_fields';
  fieldNames: string[];
  principals: string[];
}

export interface ExcludedFeature {
  property: string;
  value: string | number;
}

export interface ResourceConfig {
  resourceId: string;
  layerLabel: string;
  fields: Record<string, ResourceFieldConfig>;
  securityRules: ResourceSecurityRule[];
  bboxOverride: [number, number, number, number] | null;
  excludedFeatures: ExcludedFeature[];
}

// Perfil de configuracao nomeado (reutilizavel por group-layers).
export interface ResourceConfigProfileSummary {
  id: number;
  resourceId: string;
  name: string;
  updatedAt: string;
}

export interface ResourceConfigProfileDetail extends ResourceConfigProfileSummary {
  fields: Record<string, ResourceFieldConfig>;
  securityRules: ResourceSecurityRule[];
  minZoom: number | null;
  maxZoom: number | null;
}

export interface ResourceConfigProfileInput {
  resourceId: string;
  name: string;
  fields: Record<string, ResourceFieldConfig>;
  securityRules: ResourceSecurityRule[];
  minZoom: number | null;
  maxZoom: number | null;
}

// GET /catalog/resources/overrides: recursos com override configurado.
export type ResourceOverrides = Record<
  string,
  { bboxOverride: [number, number, number, number] | null; excludedFeatures: ExcludedFeature[] }
>;

// Regra de filtro avancado (painel "Buscar").
export interface SearchFilterRule {
  column: string;
  operator: string;
  value?: string;
  value2?: string;
  values?: string[];
}

// ---------------------------------------------------------------------------
// Stubs mantidos para compatibilidade enquanto paineis do mapa sao refatorados.
// ---------------------------------------------------------------------------

/** @deprecated PostGIS foi removido; colunas vem do WFS DescribeFeatureType. */
export interface ResourceColumn {
  name: string;
  data_type: string;
  nullable: boolean;
}

/** @deprecated Busca por palavra-chave PostGIS foi removida. */
export interface KeywordSearchResult {
  resourceId: string;
  layerLabel: string;
  row: Record<string, unknown>;
  matches: Record<string, unknown>;
  bbox: [number, number, number, number] | null;
}

/** @deprecated */
export interface KeywordSearchResponse {
  q: string;
  limit: number;
  offset: number;
  total: number;
  results: KeywordSearchResult[];
}

export interface ResourceAttributes {
  resourceId: string;
  limit: number;
  offset: number;
  total: number;
  rows: Array<Record<string, unknown> & { __bbox?: [number, number, number, number] | null }>;
  columns: string[];
}
