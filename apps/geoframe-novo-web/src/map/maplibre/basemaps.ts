// Mapas base disponiveis no seletor "Mapas base": estilos raster publicos e
// gratuitos da comunidade MapLibre/OSM, sem necessidade de API key.
import type { StyleSpecification } from 'maplibre-gl';

export interface BasemapOption {
  id: string;
  label: string;
}

export const BASEMAPS: BasemapOption[] = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'osm-humanitarian', label: 'OSM Humanitarian' },
  { id: 'carto-positron', label: 'Carto Positron' },
  { id: 'carto-voyager', label: 'Carto Voyager' },
  { id: 'liberty', label: 'Liberty' },
  { id: 'esri-imagery', label: 'Esri World Imagery' },
  { id: 'esri-imagery-labels', label: 'Esri Imagery + Labels' },
];

export const DEFAULT_BASEMAP_ID = 'osm';

const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

function rasterStyle(sources: StyleSpecification['sources'], layers: StyleSpecification['layers']): StyleSpecification {
  return { version: 8, glyphs: GLYPHS, sources, layers };
}

// Algumas expressoes de filtro do estilo Liberty comparam propriedades que
// podem ser null (ex: rank, admin_level) com numeros usando >, <, >= ou <=,
// o que faz o MapLibre logar "Expected value to be of type number, but found
// null instead" durante o parse dos tiles. Envolve essas propriedades em
// to-number com valor padrao 0 para evitar o aviso, sem alterar o resultado
// pratico do filtro (feicoes sem a propriedade ficam fora dessas faixas).
function patchNullableNumberFilters(node: unknown): unknown {
  if (!Array.isArray(node)) return node;
  const [op, ...rest] = node;
  if (op === '>' || op === '<' || op === '>=' || op === '<=') {
    return [
      op,
      ...rest.map((operand) =>
        Array.isArray(operand) && operand[0] === 'get' ? ['to-number', operand, 0] : patchNullableNumberFilters(operand),
      ),
    ];
  }
  return node.map(patchNullableNumberFilters);
}

let libertyStylePromise: Promise<StyleSpecification> | null = null;

export function getPatchedLibertyStyle(): Promise<StyleSpecification> {
  if (!libertyStylePromise) {
    libertyStylePromise = fetch('https://tiles.openfreemap.org/styles/liberty')
      .then((res) => res.json())
      .then((style: StyleSpecification) => {
        for (const layer of style.layers ?? []) {
          if ('filter' in layer && layer.filter) {
            layer.filter = patchNullableNumberFilters(layer.filter) as typeof layer.filter;
          }
        }
        return style;
      });
  }
  return libertyStylePromise;
}

export function getBasemapStyle(id: string): StyleSpecification | string {
  switch (id) {
    case 'liberty':
      return 'https://tiles.openfreemap.org/styles/liberty';

    case 'osm-humanitarian':
      return rasterStyle(
        {
          'osm-humanitarian': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Humanitarian OSM Team',
            maxzoom: 19,
          },
        },
        [{ id: 'osm-humanitarian', type: 'raster', source: 'osm-humanitarian' }],
      );

    case 'carto-positron':
      return rasterStyle(
        {
          'carto-positron': {
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
            maxzoom: 20,
          },
        },
        [{ id: 'carto-positron', type: 'raster', source: 'carto-positron' }],
      );

    case 'carto-voyager':
      return rasterStyle(
        {
          'carto-voyager': {
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
            maxzoom: 20,
          },
        },
        [{ id: 'carto-voyager', type: 'raster', source: 'carto-voyager' }],
      );

    case 'esri-imagery':
      return rasterStyle(
        {
          'esri-imagery': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri',
            maxzoom: 19,
          },
        },
        [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
      );

    case 'esri-imagery-labels':
      return rasterStyle(
        {
          'esri-imagery': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri',
            maxzoom: 19,
          },
          'esri-imagery-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri',
            maxzoom: 19,
          },
        },
        [
          { id: 'esri-imagery', type: 'raster', source: 'esri-imagery' },
          { id: 'esri-imagery-labels', type: 'raster', source: 'esri-imagery-labels' },
        ],
      );

    case 'osm':
    default:
      return rasterStyle(
        {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxzoom: 19,
          },
        },
        [{ id: 'osm', type: 'raster', source: 'osm' }],
      );
  }
}
