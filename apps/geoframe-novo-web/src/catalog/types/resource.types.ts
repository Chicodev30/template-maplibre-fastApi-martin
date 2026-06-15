// Tipos de resource.

// Catalogo do Martin via API: GET /api/tiles/catalog
export interface MartinCatalog {
  tiles: Record<string, { content_type: string; description: string }>;
}

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

// Metadados vindos do FastAPI: GET /api/catalog/resources
export interface ResourceMetadata {
  id: string; // schema.table
  schema_name: string;
  table_name: string;
  geometry_column: string | null;
  geometry_type: string | null;
  srid: number | null;
  feature_count: number | null;
}

export interface ResourceColumn {
  name: string;
  data_type: string;
  nullable: boolean;
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

// Perfil de configuracao nomeado (catalogo "Configuracoes"): subconjunto
// alternativo de campos/seguranca/zoom de um recurso, reutilizavel por
// qualquer no de camada de um group-layer. Sem perfil = default (todos os
// campos visiveis em tabela/popup, sem restricao, sem limite de zoom).
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

// GET /catalog/resources/overrides: so os recursos com override configurado.
export type ResourceOverrides = Record<
  string,
  { bboxOverride: [number, number, number, number] | null; excludedFeatures: ExcludedFeature[] }
>;

// Regra de filtro avancado (painel "Buscar"), enviada ao backend como JSON
// no parametro `filters` de /attributes.
export interface SearchFilterRule {
  column: string;
  operator: string;
  value?: string;
  value2?: string;
  values?: string[];
}

export interface ResourceAttributes {
  resourceId: string;
  limit: number;
  offset: number;
  total: number;
  rows: Array<Record<string, unknown> & { __bbox?: [number, number, number, number] | null }>;
  columns: string[];
}

// GET /catalog/resources/keyword-search: busca por palavra-chave em todas as
// colunas de texto de cada tabela (painel "Palavra-chave" do menu principal).
export interface KeywordSearchResult {
  resourceId: string;
  layerLabel: string;
  row: Record<string, unknown>;
  matches: Record<string, unknown>;
  bbox: [number, number, number, number] | null;
}

export interface KeywordSearchResponse {
  q: string;
  limit: number;
  offset: number;
  total: number;
  results: KeywordSearchResult[];
}

// Item da galeria: casamento do catalogo Martin com os metadados do banco.
export interface CatalogResource {
  id: string; // schema.table (source id do Martin)
  schemaName: string;
  tableName: string;
  geometryColumn: string; // derivado da description "schema.table.geom"
  title: string; // table.geom
}
