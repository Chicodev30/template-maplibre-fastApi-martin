// Sincroniza as camadas ativas com o mapa OpenLayers:
// cria/atualiza/remove VectorLayers usando OGC API Features (GeoJSON) por nó.
import type Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { transformExtent } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import { env } from '../../app/env';
import { getApiAuthHeaders } from '../../app/http';
import type { FilterRule } from '../../catalog/types/style.types';
import type { ExcludedFeature, ResourceOverrides } from '../../catalog/types/resource.types';
import type { ActiveLayer } from './useActiveLayers';

const LAYER_PREFIX = 'gf-layer-';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function matchesFilter(props: Record<string, unknown>, rules: FilterRule[]): boolean {
  for (const rule of rules) {
    const val = props[rule.field];
    const str = val === null || val === undefined ? '' : String(val);
    switch (rule.operator) {
      case 'equals':
        if (str !== rule.value) return false;
        break;
      case 'not_equals':
        if (str === rule.value) return false;
        break;
      case 'contains':
        if (!str.includes(rule.value)) return false;
        break;
      case 'starts_with':
        if (!str.startsWith(rule.value)) return false;
        break;
      case 'gt':
        if (!(Number(val) > Number(rule.value))) return false;
        break;
      case 'gte':
        if (!(Number(val) >= Number(rule.value))) return false;
        break;
      case 'lt':
        if (!(Number(val) < Number(rule.value))) return false;
        break;
      case 'lte':
        if (!(Number(val) <= Number(rule.value))) return false;
        break;
    }
  }
  return true;
}

function isExcluded(props: Record<string, unknown>, excluded: ExcludedFeature[]): boolean {
  return excluded.some((e) => String(props[e.property]) === String(e.value));
}

function buildStyleFn(layer: ActiveLayer, overrides?: ResourceOverrides): (feature: FeatureLike) => Style {
  const excluded = overrides?.[layer.resourceId]?.excludedFeatures ?? [];
  const fillColor = hexToRgba(layer.style.color, layer.style.opacity);
  const lineColor = layer.style.outlineColor || layer.style.color;
  const lineWidth = layer.style.outlineWidth ?? 1;

  const baseStyle = new Style({
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({ color: lineColor, width: lineWidth }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: lineColor, width: lineWidth }),
    }),
  });

  return (feature: FeatureLike) => {
    const props = (feature.getProperties() as Record<string, unknown>) ?? {};
    if (isExcluded(props, excluded)) return new Style();
    if (layer.filterRules.length > 0 && !matchesFilter(props, layer.filterRules)) return new Style();

    if (layer.style.label.enabled && layer.style.label.field) {
      const text = String(props[layer.style.label.field] ?? '');
      return new Style({
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: lineColor, width: lineWidth }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: lineColor, width: lineWidth }),
        }),
        text: new Text({
          text,
          font: `${layer.style.label.size}px ${layer.style.label.fontFamily}`,
          fill: new Fill({ color: layer.style.label.color }),
          stroke: new Stroke({ color: layer.style.label.haloColor, width: 1.5 }),
        }),
      });
    }

    return baseStyle;
  };
}

function buildLoader(resourceId: string) {
  const format = new GeoJSON({ featureProjection: 'EPSG:3857' });
  return function (
    this: VectorSource,
    extent: number[],
    _resolution: number,
    _projection: unknown,
    success: (features: ReturnType<typeof format.readFeatures>) => void,
    failure: () => void,
  ) {
    const wgs84 = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    const [minLon, minLat, maxLon, maxLat] = wgs84;
    const url = `${env.apiBaseUrl}/ogc/collections/${encodeURIComponent(resourceId)}/items?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=2000`;
    fetch(url, { headers: getApiAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        const features = format.readFeatures(data);
        this.addFeatures(features);
        success(features);
      })
      .catch(() => {
        this.removeLoadedExtent(extent);
        failure();
      });
  };
}

export function syncGroupLayers(
  map: Map,
  layers: ActiveLayer[],
  overrides?: ResourceOverrides,
): void {
  const activeIds = new Set(layers.map((l) => l.id));
  const olLayers = map.getLayers();

  // Remove camadas que não estão mais ativas.
  const toRemove: VectorLayer[] = [];
  olLayers.forEach((olLayer) => {
    const layerId = olLayer.get('gfLayerId') as string | undefined;
    if (layerId && !activeIds.has(layerId)) {
      toRemove.push(olLayer as VectorLayer);
    }
  });
  toRemove.forEach((l) => map.removeLayer(l));

  // Adiciona ou atualiza camadas ativas.
  for (const layer of layers) {
    const layerId = layer.id;
    let olLayer = null as VectorLayer | null;
    olLayers.forEach((l) => {
      if (l.get('gfLayerId') === layerId) olLayer = l as VectorLayer;
    });

    if (!olLayer) {
      const source = new VectorSource({
        format: new GeoJSON({ featureProjection: 'EPSG:3857' }),
        loader: buildLoader(layer.resourceId),
        strategy: bboxStrategy,
      });
      olLayer = new VectorLayer({ source, zIndex: 10 });
      olLayer.set('gfLayerId', layerId);
      map.addLayer(olLayer);
    }

    olLayer.setVisible(layer.visible);
    olLayer.setStyle(buildStyleFn(layer, overrides));
    if (layer.minZoom != null) olLayer.setMinZoom(layer.minZoom);
    if (layer.maxZoom != null) olLayer.setMaxZoom(layer.maxZoom);
  }
}
