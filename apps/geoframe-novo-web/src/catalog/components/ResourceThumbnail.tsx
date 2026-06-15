// Thumbnail ao vivo: mini-mapa MapLibre com a camada MVT sobre OSM.
// Inicializa apenas quando o card entra na viewport, para nao estourar o
// limite de contextos WebGL do navegador (~16) quando ha muitas tabelas.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Box, Center, Loader, Text } from '@mantine/core';
import { env } from '../../app/env';
import { createOsmStyle } from '../../map/maplibre/createMapStyle';
import { getFeaturePk } from '../../map/groupLayers/featureInteraction';
import { labelPlacement } from '../../map/groupLayers/labelPlacement';
import { useTileJson } from '../api/resources.api';
import type { LayerStyle } from '../types/style.types';

export type FeatureRef = {
  property: string;
  value: string | number | boolean;
};

function hiddenFilter() {
  return ['==', ['literal', 1], 0] as unknown as maplibregl.FilterSpecification;
}

// O bucket de 'circle' do MapLibre desenha um círculo em CADA vértice da geometria,
// não só em features de ponto — sem este filtro, polígonos/linhas ficam cobertos de pontos.
const pointTypeFilter = ['==', ['geometry-type'], 'Point'] as unknown as maplibregl.FilterSpecification;

function circleFilterFor(base?: maplibregl.FilterSpecification | null): maplibregl.FilterSpecification {
  return base ? (['all', pointTypeFilter, base] as unknown as maplibregl.FilterSpecification) : pointTypeFilter;
}

// O bucket de 'fill' do MapLibre triangula QUALQUER anel de vértices, mesmo de uma
// LineString (inclusive fechada) — sem este filtro, camadas de linha aparecem com
// preenchimento indevido (ex.: divisas/limites desenhados como polígonos).
const polygonTypeFilter = ['==', ['geometry-type'], 'Polygon'] as unknown as maplibregl.FilterSpecification;

function fillFilterFor(base?: maplibregl.FilterSpecification | null): maplibregl.FilterSpecification {
  return base ? (['all', polygonTypeFilter, base] as unknown as maplibregl.FilterSpecification) : polygonTypeFilter;
}

function featureFilter(features: FeatureRef[]) {
  if (!features.length) return hiddenFilter();
  if (features.length === 1) {
    return [
      '==',
      ['get', features[0].property],
      features[0].value,
    ] as unknown as maplibregl.FilterSpecification;
  }
  return [
    'any',
    ...features.map((feature) => ['==', ['get', feature.property], feature.value]),
  ] as unknown as maplibregl.FilterSpecification;
}

// Filtro "negativo": exclui as feicoes informadas das camadas base.
function exclusionFilter(features: FeatureRef[]): maplibregl.FilterSpecification | undefined {
  if (!features.length) return undefined;
  const conditions = features.map(
    (feature) => ['!=', ['get', feature.property], feature.value] as unknown,
  );
  if (conditions.length === 1) return conditions[0] as maplibregl.FilterSpecification;
  return ['all', ...conditions] as unknown as maplibregl.FilterSpecification;
}

export function ResourceThumbnail({
  sourceId,
  height = 150,
  lazy = true,
  interactive = false,
  focusBounds = null,
  selectedFeatures = [],
  boundsOverride = null,
  excludedFeatures = [],
  hideExcluded = true,
  previewStyle = null,
  onFeatureClick,
  onMapReady,
}: {
  sourceId: string;
  height?: number;
  lazy?: boolean;
  interactive?: boolean;
  focusBounds?: [number, number, number, number] | null;
  selectedFeatures?: FeatureRef[];
  boundsOverride?: [number, number, number, number] | null;
  excludedFeatures?: FeatureRef[];
  hideExcluded?: boolean;
  previewStyle?: LayerStyle | null;
  onFeatureClick?: (feature: FeatureRef) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [visible, setVisible] = useState(!lazy);
  const { data: tj, isLoading, isError } = useTileJson(visible ? sourceId : '');

  // Detecta entrada na viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!lazy || !el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  // Cria o mapa e adiciona a camada vetorial quando o TileJSON chega.
  useEffect(() => {
    if (!visible || !tj || !containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createOsmStyle(),
      interactive,
      attributionControl: false,
      bounds: boundsOverride ?? tj.bounds,
      fitBoundsOptions: { padding: 12, maxZoom: 14 },
    });

    map.on('load', () => {
      map.addSource('resource', {
        type: 'vector',
        tiles: [`${env.apiBaseUrl}/tiles/${sourceId}/{z}/{x}/{y}`],
      });
      const common = { source: 'resource', 'source-layer': sourceId } as const;
      const exclusion = hideExcluded ? exclusionFilter(excludedFeatures) : undefined;
      const fillColor = previewStyle?.color ?? '#1971c2';
      const fillOpacity = previewStyle?.opacity ?? 0.35;
      const lineColor = previewStyle ? previewStyle.outlineColor || previewStyle.color : '#1971c2';
      const lineWidth = previewStyle?.outlineWidth ?? 1;
      // Preenchimento so se aplica a geometrias de poligono (ver fillFilterFor).
      map.addLayer({
        ...common,
        id: 'resource-fill',
        type: 'fill',
        filter: fillFilterFor(exclusion),
        paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
      });
      map.addLayer({
        ...common,
        id: 'resource-line',
        type: 'line',
        ...(exclusion ? { filter: exclusion } : {}),
        paint: { 'line-color': lineColor, 'line-width': lineWidth },
      });
      map.addLayer({
        ...common,
        id: 'resource-circle',
        type: 'circle',
        filter: circleFilterFor(exclusion),
        paint: {
          'circle-color': fillColor,
          'circle-opacity': fillOpacity,
          'circle-radius': 2.5,
          'circle-stroke-color': lineColor,
          'circle-stroke-width': previewStyle ? lineWidth : 0,
        },
      });
      const emptyFilter = hiddenFilter();
      map.addLayer({
        ...common,
        id: 'resource-selected-fill',
        type: 'fill',
        filter: fillFilterFor(emptyFilter),
        paint: { 'fill-color': '#40c057', 'fill-opacity': 0.45 },
      });
      map.addLayer({
        ...common,
        id: 'resource-selected-line',
        type: 'line',
        filter: emptyFilter,
        paint: { 'line-color': '#2f9e44', 'line-width': 4 },
      });
      map.addLayer({
        ...common,
        id: 'resource-selected-circle',
        type: 'circle',
        filter: circleFilterFor(emptyFilter),
        paint: {
          'circle-color': '#40c057',
          'circle-stroke-color': '#2f9e44',
          'circle-stroke-width': 2,
          'circle-radius': 6,
        },
      });
      // Destaque vermelho das feicoes marcadas como excluidas do catalogo
      // (visivel quando hideExcluded=false, para revisao no admin).
      const excludedFilter = hideExcluded ? emptyFilter : featureFilter(excludedFeatures);
      map.addLayer({
        ...common,
        id: 'resource-excluded-fill',
        type: 'fill',
        filter: fillFilterFor(excludedFilter),
        paint: { 'fill-color': '#e03131', 'fill-opacity': 0.45 },
      });
      map.addLayer({
        ...common,
        id: 'resource-excluded-line',
        type: 'line',
        filter: excludedFilter,
        paint: { 'line-color': '#c92a2a', 'line-width': 4 },
      });
      map.addLayer({
        ...common,
        id: 'resource-excluded-circle',
        type: 'circle',
        filter: circleFilterFor(excludedFilter),
        paint: {
          'circle-color': '#e03131',
          'circle-stroke-color': '#c92a2a',
          'circle-stroke-width': 2,
          'circle-radius': 6,
        },
      });

      const showLabel = !!previewStyle?.label.enabled && !!previewStyle?.label.field;
      const { anchor, offset } = labelPlacement(previewStyle?.label.position ?? 'top');
      const labelTextField = previewStyle?.label.field ? ['get', previewStyle.label.field] : '';
      map.addLayer({
        ...common,
        id: 'resource-label',
        type: 'symbol',
        ...(exclusion ? { filter: exclusion } : {}),
        layout: {
          visibility: showLabel ? 'visible' : 'none',
          'text-field': labelTextField as unknown as string,
          'text-font': [previewStyle?.label.fontFamily ?? 'Noto Sans Regular'],
          'text-size': previewStyle?.label.size ?? 12,
          'text-anchor': anchor,
          'text-offset': offset,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': previewStyle?.label.color ?? '#222222',
          'text-halo-color': previewStyle?.label.haloColor ?? '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      onMapReady?.(map);
    });

    if (interactive && onFeatureClick) {
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['resource-fill', 'resource-line', 'resource-circle'],
        });
        if (features.length === 0) return;
        const pk = getFeaturePk(features[0]);
        if (pk) onFeatureClick(pk);
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // boundsOverride/excludedFeatures/hideExcluded/previewStyle sao usados apenas
    // na criacao inicial do mapa; atualizacoes posteriores sao tratadas pelos
    // effects abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tj, sourceId, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filter = featureFilter(selectedFeatures);
    if (map.getLayer('resource-selected-fill')) {
      map.setFilter('resource-selected-fill', fillFilterFor(filter));
    }
    if (map.getLayer('resource-selected-line')) {
      map.setFilter('resource-selected-line', filter);
    }
    if (map.getLayer('resource-selected-circle')) {
      map.setFilter('resource-selected-circle', circleFilterFor(filter));
    }
  }, [selectedFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const exclusion = hideExcluded ? exclusionFilter(excludedFeatures) : undefined;
    if (map.getLayer('resource-fill')) {
      map.setFilter('resource-fill', fillFilterFor(exclusion));
    }
    if (map.getLayer('resource-line')) {
      map.setFilter('resource-line', exclusion ?? null);
    }
    if (map.getLayer('resource-circle')) {
      map.setFilter('resource-circle', circleFilterFor(exclusion));
    }
    const highlight = hideExcluded ? hiddenFilter() : featureFilter(excludedFeatures);
    if (map.getLayer('resource-excluded-fill')) {
      map.setFilter('resource-excluded-fill', fillFilterFor(highlight));
    }
    if (map.getLayer('resource-excluded-line')) {
      map.setFilter('resource-excluded-line', highlight);
    }
    if (map.getLayer('resource-excluded-circle')) {
      map.setFilter('resource-excluded-circle', circleFilterFor(highlight));
    }
  }, [excludedFeatures, hideExcluded]);

  // Reflete o estilo em edicao em tempo real, sem recriar o mapa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !previewStyle) return;

    const fillColor = previewStyle.color;
    const fillOpacity = previewStyle.opacity;
    const lineColor = previewStyle.outlineColor || previewStyle.color;
    const lineWidth = previewStyle.outlineWidth;

    if (map.getLayer('resource-fill')) {
      map.setPaintProperty('resource-fill', 'fill-color', fillColor);
      map.setPaintProperty('resource-fill', 'fill-opacity', fillOpacity);
    }
    if (map.getLayer('resource-line')) {
      map.setPaintProperty('resource-line', 'line-color', lineColor);
      map.setPaintProperty('resource-line', 'line-width', lineWidth);
    }
    if (map.getLayer('resource-circle')) {
      map.setPaintProperty('resource-circle', 'circle-color', fillColor);
      map.setPaintProperty('resource-circle', 'circle-opacity', fillOpacity);
      map.setPaintProperty('resource-circle', 'circle-stroke-color', lineColor);
      map.setPaintProperty('resource-circle', 'circle-stroke-width', lineWidth);
    }

    if (map.getLayer('resource-label')) {
      const showLabel = previewStyle.label.enabled && !!previewStyle.label.field;
      const { anchor, offset } = labelPlacement(previewStyle.label.position);
      const textField = previewStyle.label.field ? ['get', previewStyle.label.field] : '';
      map.setLayoutProperty('resource-label', 'visibility', showLabel ? 'visible' : 'none');
      map.setLayoutProperty('resource-label', 'text-field', textField);
      map.setLayoutProperty('resource-label', 'text-font', [previewStyle.label.fontFamily]);
      map.setLayoutProperty('resource-label', 'text-size', previewStyle.label.size);
      map.setLayoutProperty('resource-label', 'text-anchor', anchor);
      map.setLayoutProperty('resource-label', 'text-offset', offset);
      map.setPaintProperty('resource-label', 'text-color', previewStyle.label.color);
      map.setPaintProperty('resource-label', 'text-halo-color', previewStyle.label.haloColor);
    }
  }, [previewStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBounds) return;
    const [minX, minY, maxX, maxY] = focusBounds;
    if ([minX, minY, maxX, maxY].some((value) => !Number.isFinite(value))) return;
    if (minX === maxX && minY === maxY) {
      map.flyTo({ center: [minX, minY], zoom: 18, duration: 500 });
      return;
    }
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 48, maxZoom: 18, duration: 500 },
    );
  }, [focusBounds]);

  return (
    <Box ref={containerRef} pos="relative" h={height} bg="gray.1" style={{ overflow: 'hidden' }}>
      {visible && isLoading && (
        <Center h="100%">
          <Loader size="sm" />
        </Center>
      )}
      {isError && (
        <Center h="100%">
          <Text size="xs" c="dimmed">
            sem preview
          </Text>
        </Center>
      )}
    </Box>
  );
}
