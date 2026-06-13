// Thumbnail ao vivo: mini-mapa MapLibre com a camada MVT sobre OSM.
// Inicializa apenas quando o card entra na viewport, para nao estourar o
// limite de contextos WebGL do navegador (~16) quando ha muitas tabelas.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Box, Center, Loader, Text } from '@mantine/core';
import { env } from '../../app/env';
import { createOsmStyle } from '../../map/maplibre/createMapStyle';
import { useTileJson } from '../api/resources.api';

export type FeatureRef = {
  property: string;
  value: string | number | boolean;
};

function hiddenFilter() {
  return ['==', ['literal', 1], 0] as unknown as maplibregl.FilterSpecification;
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

export function ResourceThumbnail({
  sourceId,
  height = 150,
  lazy = true,
  interactive = false,
  focusBounds = null,
  selectedFeatures = [],
}: {
  sourceId: string;
  height?: number;
  lazy?: boolean;
  interactive?: boolean;
  focusBounds?: [number, number, number, number] | null;
  selectedFeatures?: FeatureRef[];
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
      bounds: tj.bounds,
      fitBoundsOptions: { padding: 12, maxZoom: 14 },
    });

    map.on('load', () => {
      map.addSource('resource', {
        type: 'vector',
        tiles: [`${env.apiBaseUrl}/tiles/${sourceId}/{z}/{x}/{y}`],
      });
      const common = { source: 'resource', 'source-layer': sourceId } as const;
      // Cobre qualquer geometria: poligono, linha e ponto.
      map.addLayer({
        ...common,
        id: 'resource-fill',
        type: 'fill',
        paint: { 'fill-color': '#1971c2', 'fill-opacity': 0.35 },
      });
      map.addLayer({
        ...common,
        id: 'resource-line',
        type: 'line',
        paint: { 'line-color': '#1971c2', 'line-width': 1 },
      });
      map.addLayer({
        ...common,
        id: 'resource-circle',
        type: 'circle',
        paint: { 'circle-color': '#1971c2', 'circle-radius': 2.5 },
      });
      const emptyFilter = hiddenFilter();
      map.addLayer({
        ...common,
        id: 'resource-selected-fill',
        type: 'fill',
        filter: emptyFilter,
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
        filter: emptyFilter,
        paint: {
          'circle-color': '#40c057',
          'circle-stroke-color': '#2f9e44',
          'circle-stroke-width': 2,
          'circle-radius': 6,
        },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [visible, tj, sourceId, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filter = featureFilter(selectedFeatures);
    for (const layerId of [
      'resource-selected-fill',
      'resource-selected-line',
      'resource-selected-circle',
    ]) {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filter);
      }
    }
  }, [selectedFeatures]);

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
