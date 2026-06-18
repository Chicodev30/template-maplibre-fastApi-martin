// Thumbnail ao vivo: mini-mapa OpenLayers com a camada OGC API Features sobre OSM.
// Inicializa apenas quando o card entra na viewport.
import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import OSM from 'ol/source/OSM';
import { Style, Fill, Stroke, Circle as CircleStyle, Text as TextStyle } from 'ol/style';
import { fromLonLat, transformExtent } from 'ol/proj';
import type { FeatureLike } from 'ol/Feature';
import 'ol/ol.css';
import { Box, Center, Loader, Text } from '@mantine/core';
import { env } from '../../app/env';
import { thumbnailUrl } from '../api/resources.api';
import type { LayerStyle } from '../types/style.types';

export type FeatureRef = {
  property: string;
  value: string | number | boolean;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildStyle(layerStyle: LayerStyle | null, selectedFeatures: FeatureRef[], excludedFeatures: FeatureRef[], hideExcluded: boolean) {
  const color = layerStyle?.color ?? '#1971c2';
  const opacity = layerStyle?.opacity ?? 0.35;
  const lineColor = layerStyle ? (layerStyle.outlineColor || layerStyle.color) : '#1971c2';
  const lineWidth = layerStyle?.outlineWidth ?? 1;

  return (feature: FeatureLike): Style => {
    const props = feature.getProperties() as Record<string, unknown>;

    const isExcluded = excludedFeatures.some((e) => String(props[e.property]) === String(e.value));
    const isSelected = selectedFeatures.length > 0 && selectedFeatures.some((e) => String(props[e.property]) === String(e.value));

    if (isExcluded) {
      if (hideExcluded) return new Style();
      return new Style({
        fill: new Fill({ color: 'rgba(224,49,49,0.45)' }),
        stroke: new Stroke({ color: '#c92a2a', width: 3 }),
        image: new CircleStyle({ radius: 6, fill: new Fill({ color: 'rgba(224,49,49,0.45)' }), stroke: new Stroke({ color: '#c92a2a', width: 2 }) }),
      });
    }

    if (isSelected) {
      return new Style({
        fill: new Fill({ color: 'rgba(64,192,87,0.45)' }),
        stroke: new Stroke({ color: '#2f9e44', width: 4 }),
        image: new CircleStyle({ radius: 6, fill: new Fill({ color: 'rgba(64,192,87,0.45)' }), stroke: new Stroke({ color: '#2f9e44', width: 2 }) }),
      });
    }

    const fillColor = hexToRgba(color, opacity);
    const textOpts = layerStyle?.label.enabled && layerStyle.label.field
      ? new TextStyle({
          text: String(props[layerStyle.label.field] ?? ''),
          font: `${layerStyle.label.size}px ${layerStyle.label.fontFamily}`,
          fill: new Fill({ color: layerStyle.label.color }),
          stroke: new Stroke({ color: layerStyle.label.haloColor, width: 1.5 }),
        })
      : undefined;

    return new Style({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: lineColor, width: lineWidth }),
      image: new CircleStyle({ radius: 4, fill: new Fill({ color: fillColor }), stroke: new Stroke({ color: lineColor, width: lineWidth }) }),
      text: textOpts,
    });
  };
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
  onMapReady?: (map: Map) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorLayerRef = useRef<VectorLayer | null>(null);
  const [visible, setVisible] = useState(!lazy);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [staticThumb, setStaticThumb] = useState<string | null | false>(interactive ? false : null);

  // Verifica se há thumbnail estática salva.
  useEffect(() => {
    if (!visible || interactive) return;
    const url = thumbnailUrl(sourceId);
    fetch(url)
      .then(async (r) => {
        const ct = r.headers.get('content-type') ?? '';
        if (r.ok && ct.includes('image/')) setStaticThumb(url);
        else setStaticThumb(false);
      })
      .catch(() => setStaticThumb(false));
  }, [visible, sourceId, interactive]);

  // Detecta entrada na viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!lazy || !el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '100px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy]);

  // Cria o mapa OL quando necessário.
  useEffect(() => {
    if (!visible || staticThumb === null || staticThumb !== false || !containerRef.current || mapRef.current) return;

    setLoading(true);
    setError(false);

    const initialBounds = boundsOverride ?? null;
    const center = initialBounds ? fromLonLat([(initialBounds[0] + initialBounds[2]) / 2, (initialBounds[1] + initialBounds[3]) / 2]) : fromLonLat([-51.2287, -30.0346]);

    const source = new VectorSource({
      format: new GeoJSON({ featureProjection: 'EPSG:3857' }),
      loader: async (_extent, _resolution, projection) => {
        try {
          const bboxParam = initialBounds ? `&bbox=${initialBounds.join(',')}` : '';
          const res = await fetch(`${env.apiBaseUrl}/ogc/collections/${encodeURIComponent(sourceId)}/items?limit=2000${bboxParam}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
          });
          if (!res.ok) throw new Error('fetch error');
          const data = await res.json();
          const format = new GeoJSON({ featureProjection: projection.getCode() });
          const features = format.readFeatures(data);
          source.addFeatures(features);
          setLoading(false);

          if (mapRef.current) {
            const extent = source.getExtent();
            if (extent && isFinite(extent[0])) {
              mapRef.current.getView().fit(extent, { padding: [12, 12, 12, 12], maxZoom: 14, duration: 0 });
            }
            onMapReady?.(mapRef.current);
          }
        } catch {
          setError(true);
          setLoading(false);
        }
      },
    });

    const vectorLayer = new VectorLayer({
      source,
      style: buildStyle(previewStyle, selectedFeatures, excludedFeatures, hideExcluded),
      zIndex: 1,
    });
    vectorLayerRef.current = vectorLayer;

    const map = new Map({
      target: containerRef.current,
      layers: [new TileLayer({ source: new OSM(), zIndex: 0 }), vectorLayer],
      view: new View({ center, zoom: 12, projection: 'EPSG:3857' }),
      controls: [],
      interactions: interactive ? undefined : [],
    });

    if (interactive && onFeatureClick) {
      map.on('click', (e) => {
        map.forEachFeatureAtPixel(e.pixel, (feature) => {
          const props = feature.getProperties() as Record<string, unknown>;
          const pk = typeof props.ogc_fid !== 'undefined' ? { property: 'ogc_fid', value: props.ogc_fid as string | number | boolean }
            : typeof props.id !== 'undefined' ? { property: 'id', value: props.id as string | number | boolean }
            : null;
          if (pk) onFeatureClick(pk);
          return true;
        });
      });
    }

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      vectorLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, staticThumb, sourceId, interactive]);

  // Atualiza estilo ao mudar previewStyle/selectedFeatures/excludedFeatures.
  useEffect(() => {
    vectorLayerRef.current?.setStyle(buildStyle(previewStyle, selectedFeatures, excludedFeatures, hideExcluded));
  }, [previewStyle, selectedFeatures, excludedFeatures, hideExcluded]);

  // Zoom para focusBounds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBounds) return;
    const [minX, minY, maxX, maxY] = focusBounds;
    if ([minX, minY, maxX, maxY].some((v) => !Number.isFinite(v))) return;
    if (minX === maxX && minY === maxY) {
      map.getView().animate({ center: fromLonLat([minX, minY]), zoom: 18, duration: 500 });
    } else {
      const extent = transformExtent([minX, minY, maxX, maxY], 'EPSG:4326', 'EPSG:3857');
      map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 18, duration: 500 });
    }
  }, [focusBounds]);

  return (
    <Box ref={containerRef} pos="relative" h={height} bg="gray.1" style={{ overflow: 'hidden' }}>
      {staticThumb && (
        <img src={staticThumb} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {visible && staticThumb === false && loading && (
        <Center h="100%"><Loader size="sm" /></Center>
      )}
      {staticThumb === false && error && (
        <Center h="100%"><Text size="xs" c="dimmed">sem preview</Text></Center>
      )}
    </Box>
  );
}
