// Sincroniza as camadas ativas dos grupos de camadas com o mapa MapLibre:
// cria/atualiza/remove sources e layers (fill/line/circle/label) por nó.
import type maplibregl from 'maplibre-gl';
import { env } from '../../app/env';
import type { FilterRule } from '../../catalog/types/style.types';
import type { ExcludedFeature, ResourceOverrides } from '../../catalog/types/resource.types';
import { labelPlacement } from './labelPlacement';
import type { ActiveLayer } from './useActiveLayers';

const SOURCE_PREFIX = 'gl-src-';
const LAYER_ID_RE = /^gl-(fill|line|circle|label|select-fill|select-line|select-circle)-(.+)$/;

// Filtro que não casa com nenhuma feature — usado para "esconder" as camadas
// de seleção até o usuário clicar numa geometria.
export function hiddenFilter(): maplibregl.FilterSpecification {
  return ['==', ['literal', 1], 0] as unknown as maplibregl.FilterSpecification;
}

// O bucket de 'fill' do MapLibre triangula QUALQUER anel de vértices, mesmo de uma
// LineString (inclusive fechada) — sem este filtro, camadas de linha aparecem com
// preenchimento indevido (ex.: divisas/limites desenhados como polígonos).
export const polygonTypeFilter = ['==', ['geometry-type'], 'Polygon'] as unknown as maplibregl.FilterSpecification;

export function fillFilterFor(
  base: maplibregl.FilterSpecification,
): maplibregl.FilterSpecification {
  return ['all', polygonTypeFilter, base] as unknown as maplibregl.FilterSpecification;
}

function buildFilter(rules: FilterRule[]): maplibregl.FilterSpecification | null {
  const exprs: unknown[] = [];
  for (const rule of rules) {
    const field = ['get', rule.field];
    switch (rule.operator) {
      case 'equals':
        exprs.push(['==', field, rule.value]);
        break;
      case 'not_equals':
        exprs.push(['!=', field, rule.value]);
        break;
      case 'contains':
        exprs.push(['in', rule.value, field]);
        break;
      case 'starts_with':
        exprs.push(['==', ['slice', field, 0, rule.value.length], rule.value]);
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const num = Number(rule.value);
        if (!Number.isFinite(num)) break;
        const op = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[rule.operator];
        exprs.push([op, field, num]);
        break;
      }
    }
  }
  if (exprs.length === 0) return null;
  if (exprs.length === 1) return exprs[0] as maplibregl.FilterSpecification;
  return ['all', ...exprs] as unknown as maplibregl.FilterSpecification;
}

// Filtro negativo para feicoes desconsideradas do catalogo (override por recurso) -
// nao altera os tiles do Martin, so esconde no mapa.
function buildExclusionFilter(features: ExcludedFeature[]): maplibregl.FilterSpecification | null {
  if (!features.length) return null;
  const conditions = features.map(
    (feature) => ['!=', ['get', feature.property], feature.value] as unknown,
  );
  if (conditions.length === 1) return conditions[0] as maplibregl.FilterSpecification;
  return ['all', ...conditions] as unknown as maplibregl.FilterSpecification;
}

function mergeFilters(
  a: maplibregl.FilterSpecification | null,
  b: maplibregl.FilterSpecification | null,
): maplibregl.FilterSpecification | null {
  if (!a) return b;
  if (!b) return a;
  return ['all', a, b] as unknown as maplibregl.FilterSpecification;
}

export function syncGroupLayers(
  map: maplibregl.Map,
  layers: ActiveLayer[],
  overrides?: ResourceOverrides,
) {
  const style = map.getStyle();
  const activeIds = new Set(layers.map((l) => l.id));

  for (const layerDef of style.layers ?? []) {
    const match = LAYER_ID_RE.exec(layerDef.id);
    if (match && !activeIds.has(match[2])) {
      map.removeLayer(layerDef.id);
    }
  }
  for (const sourceId of Object.keys(style.sources ?? {})) {
    if (sourceId.startsWith(SOURCE_PREFIX) && !activeIds.has(sourceId.slice(SOURCE_PREFIX.length))) {
      map.removeSource(sourceId);
    }
  }

  for (const layer of layers) {
    const sourceId = `${SOURCE_PREFIX}${layer.id}`;
    const visibility = layer.visible ? 'visible' : 'none';
    const minzoom = layer.minZoom ?? 0;
    const maxzoom = layer.maxZoom ?? 24;
    const exclusion = buildExclusionFilter(overrides?.[layer.resourceId]?.excludedFeatures ?? []);
    const filter = mergeFilters(buildFilter(layer.filterRules), exclusion);
    const lineColor = layer.style.outlineColor || layer.style.color;
    const lineWidth = layer.style.outlineWidth ?? 1;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'vector',
        tiles: [`${env.apiBaseUrl}/tiles/${layer.resourceId}/{z}/{x}/{y}`],
      });
    }

    // GeoServer GWC embeds layer name without workspace prefix inside PBF tiles.
    const sourceLayer = layer.resourceId.includes('.')
      ? layer.resourceId.split('.').slice(1).join('.')
      : layer.resourceId;
    const common = { source: sourceId, 'source-layer': sourceLayer, minzoom, maxzoom } as const;
    const filterProp = filter ? { filter } : {};

    // O bucket de 'circle' do MapLibre desenha um círculo em CADA vértice da geometria,
    // não só em features de ponto — sem este filtro, polígonos/linhas ficam cobertos de pontos.
    const pointTypeFilter = ['==', ['geometry-type'], 'Point'] as unknown as maplibregl.FilterSpecification;
    const circleFilter = filter
      ? (['all', pointTypeFilter, filter] as unknown as maplibregl.FilterSpecification)
      : pointTypeFilter;

    const fillFilter = filter ? fillFilterFor(filter) : polygonTypeFilter;

    const fillId = `gl-fill-${layer.id}`;
    if (!map.getLayer(fillId)) {
      map.addLayer({
        ...common,
        id: fillId,
        type: 'fill',
        filter: fillFilter,
        paint: { 'fill-color': layer.style.color, 'fill-opacity': layer.style.opacity },
        layout: { visibility },
      });
    } else {
      map.setPaintProperty(fillId, 'fill-color', layer.style.color);
      map.setPaintProperty(fillId, 'fill-opacity', layer.style.opacity);
      map.setLayoutProperty(fillId, 'visibility', visibility);
      map.setFilter(fillId, fillFilter);
      map.setLayerZoomRange(fillId, minzoom, maxzoom);
    }

    const lineId = `gl-line-${layer.id}`;
    if (!map.getLayer(lineId)) {
      map.addLayer({
        ...common,
        id: lineId,
        type: 'line',
        ...filterProp,
        paint: { 'line-color': lineColor, 'line-width': lineWidth },
        layout: { visibility },
      });
    } else {
      map.setPaintProperty(lineId, 'line-color', lineColor);
      map.setPaintProperty(lineId, 'line-width', lineWidth);
      map.setLayoutProperty(lineId, 'visibility', visibility);
      map.setFilter(lineId, filter);
      map.setLayerZoomRange(lineId, minzoom, maxzoom);
    }

    const circleId = `gl-circle-${layer.id}`;
    if (!map.getLayer(circleId)) {
      map.addLayer({
        ...common,
        id: circleId,
        type: 'circle',
        filter: circleFilter,
        paint: {
          'circle-color': layer.style.color,
          'circle-opacity': layer.style.opacity,
          'circle-radius': 4,
          'circle-stroke-color': lineColor,
          'circle-stroke-width': lineWidth,
        },
        layout: { visibility },
      });
    } else {
      map.setPaintProperty(circleId, 'circle-color', layer.style.color);
      map.setPaintProperty(circleId, 'circle-opacity', layer.style.opacity);
      map.setPaintProperty(circleId, 'circle-stroke-color', lineColor);
      map.setPaintProperty(circleId, 'circle-stroke-width', lineWidth);
      map.setLayoutProperty(circleId, 'visibility', visibility);
      map.setFilter(circleId, circleFilter);
      map.setLayerZoomRange(circleId, minzoom, maxzoom);
    }

    const labelId = `gl-label-${layer.id}`;
    const showLabel = layer.style.label.enabled && !!layer.style.label.field;
    const labelVisibility = showLabel ? visibility : 'none';
    const textField = layer.style.label.field ? ['get', layer.style.label.field] : '';
    const { anchor, offset } = labelPlacement(layer.style.label.position);
    const textFont = [layer.style.label.fontFamily];
    if (!map.getLayer(labelId)) {
      map.addLayer({
        ...common,
        id: labelId,
        type: 'symbol',
        ...filterProp,
        layout: {
          visibility: labelVisibility,
          'text-field': textField as unknown as string,
          'text-font': textFont,
          'text-size': layer.style.label.size,
          'text-anchor': anchor,
          'text-offset': offset,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': layer.style.label.color,
          'text-halo-color': layer.style.label.haloColor,
          'text-halo-width': 1.5,
        },
      });
    } else {
      map.setLayoutProperty(labelId, 'visibility', labelVisibility);
      map.setLayoutProperty(labelId, 'text-field', textField);
      map.setLayoutProperty(labelId, 'text-font', textFont);
      map.setLayoutProperty(labelId, 'text-size', layer.style.label.size);
      map.setLayoutProperty(labelId, 'text-anchor', anchor);
      map.setLayoutProperty(labelId, 'text-offset', offset);
      map.setPaintProperty(labelId, 'text-color', layer.style.label.color);
      map.setPaintProperty(labelId, 'text-halo-color', layer.style.label.haloColor);
      map.setFilter(labelId, filter);
      map.setLayerZoomRange(labelId, minzoom, maxzoom);
    }

    // Camadas de destaque (amarelo) da feature selecionada via clique no mapa.
    // Filtro começa "escondido" e é atualizado pelo handler de clique do MapView.
    const selectFillId = `gl-select-fill-${layer.id}`;
    if (!map.getLayer(selectFillId)) {
      map.addLayer({
        ...common,
        id: selectFillId,
        type: 'fill',
        filter: hiddenFilter(),
        paint: { 'fill-color': '#ffd43b', 'fill-opacity': 0.45 },
        layout: { visibility },
      });
    } else {
      map.setLayoutProperty(selectFillId, 'visibility', visibility);
      map.setLayerZoomRange(selectFillId, minzoom, maxzoom);
    }

    const selectLineId = `gl-select-line-${layer.id}`;
    if (!map.getLayer(selectLineId)) {
      map.addLayer({
        ...common,
        id: selectLineId,
        type: 'line',
        filter: hiddenFilter(),
        paint: { 'line-color': '#fab005', 'line-width': 4 },
        layout: { visibility },
      });
    } else {
      map.setLayoutProperty(selectLineId, 'visibility', visibility);
      map.setLayerZoomRange(selectLineId, minzoom, maxzoom);
    }

    const selectCircleId = `gl-select-circle-${layer.id}`;
    if (!map.getLayer(selectCircleId)) {
      map.addLayer({
        ...common,
        id: selectCircleId,
        type: 'circle',
        filter: hiddenFilter(),
        paint: {
          'circle-color': '#ffd43b',
          'circle-radius': 6,
          'circle-stroke-color': '#fab005',
          'circle-stroke-width': 2,
        },
        layout: { visibility },
      });
    } else {
      map.setLayoutProperty(selectCircleId, 'visibility', visibility);
      map.setLayerZoomRange(selectCircleId, minzoom, maxzoom);
    }
  }
}
