// Componente principal MapLibre + deck.gl.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createOsmStyle } from './maplibre/createMapStyle';
import type { ActiveLayer } from './groupLayers/useActiveLayers';
import { syncGroupLayers, hiddenFilter, fillFilterFor } from './groupLayers/syncGroupLayers';
import { buildPopupHtml, getFeaturePk, pkFilter, pointPkFilter } from './groupLayers/featureInteraction';
import type { ResourceOverrides } from '../catalog/types/resource.types';

// Centro de Porto Alegre/RS.
const PORTO_ALEGRE: [number, number] = [-51.2287, -30.0346];

export function MapView({
  activeLayers = [],
  resourceOverrides,
  onMapReady,
}: {
  activeLayers?: ActiveLayer[];
  resourceOverrides?: ResourceOverrides;
  onMapReady?: (map: maplibregl.Map) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const clickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createOsmStyle(),
      center: PORTO_ALEGRE,
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl());

    map.on('load', () => {
      setReady(true);
      onMapReady?.(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncGroupLayers(map, activeLayers, resourceOverrides);

    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current);
    }

    const clearSelection = () => {
      for (const layer of activeLayers) {
        for (const type of ['fill', 'line', 'circle']) {
          const id = `gl-select-${type}-${layer.id}`;
          if (map.getLayer(id)) map.setFilter(id, hiddenFilter());
        }
      }
      popupRef.current?.remove();
      popupRef.current = null;
    };

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const queryableIds = activeLayers
        .flatMap((layer) => [`gl-fill-${layer.id}`, `gl-line-${layer.id}`, `gl-circle-${layer.id}`])
        .filter((id) => map.getLayer(id));
      if (queryableIds.length === 0) return;

      const features = map.queryRenderedFeatures(e.point, { layers: queryableIds });
      clearSelection();
      if (features.length === 0) return;

      const feature = features[0];
      const match = /^gl-(fill|line|circle)-(.+)$/.exec(feature.layer.id);
      const layer = activeLayers.find((l) => l.id === match?.[2]);
      const pk = getFeaturePk(feature.properties ?? {});
      if (!match || !layer || !pk) return;

      const fillFilter = pkFilter(pk);
      map.setFilter(`gl-select-fill-${layer.id}`, fillFilterFor(fillFilter));
      map.setFilter(`gl-select-line-${layer.id}`, fillFilter);
      map.setFilter(`gl-select-circle-${layer.id}`, pointPkFilter(pk));

      popupRef.current = new maplibregl.Popup({ maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(layer.label, feature.properties ?? {}))
        .addTo(map);
    };

    clickHandlerRef.current = handleClick;
    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [ready, activeLayers, resourceOverrides]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 'var(--app-shell-header-offset, 0px)',
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
}
