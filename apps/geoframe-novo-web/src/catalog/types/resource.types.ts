// Tipos de resource.

// Catalogo do Martin: GET {tileBaseUrl}/catalog
export interface MartinCatalog {
  tiles: Record<string, { content_type: string; description: string }>;
}

// TileJSON de uma fonte: GET {tileBaseUrl}/{sourceId}
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

// Item da galeria: casamento do catalogo Martin com os metadados do banco.
export interface CatalogResource {
  id: string; // schema.table (source id do Martin)
  schemaName: string;
  tableName: string;
  geometryColumn: string; // derivado da description "schema.table.geom"
  title: string; // table.geom
}
