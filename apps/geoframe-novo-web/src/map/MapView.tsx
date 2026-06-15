// Componente principal MapLibre + deck.gl.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_BASEMAP_ID, getBasemapStyle, getPatchedLibertyStyle } from './maplibre/basemaps';
import type { ActiveLayer } from './groupLayers/useActiveLayers';
import { syncGroupLayers, hiddenFilter, fillFilterFor } from './groupLayers/syncGroupLayers';
import {
  buildPopupHtml,
  getFeatureBounds,
  getFeaturePk,
  pkFilter,
  pointPkFilter,
  type FeaturePk,
} from './groupLayers/featureInteraction';
import {
  buildContextMenuHtml,
  buildExternalMapModalHtml,
  buildExternalMapOptions,
  buildIdentifyPopupHtml,
  buildLocationKml,
  downloadTextFile,
  wireExternalMapModalEvents,
  wireIdentifyPopupEvents,
  type IdentifyState,
} from './groupLayers/identifyLocationPopup';
import { reverseGeocode } from '../catalog/api/geocoding.api';
import type { EffectiveResourceConfig } from '../catalog/api/effectiveConfig';
import type { ResourceOverrides } from '../catalog/types/resource.types';

// Centro de Porto Alegre/RS.
const PORTO_ALEGRE: [number, number] = [-51.2287, -30.0346];

export function MapView({
  activeLayers = [],
  resourceOverrides,
  fieldConfigsByLayerId,
  userPrincipals = [],
  basemapId = DEFAULT_BASEMAP_ID,
  onMapReady,
}: {
  activeLayers?: ActiveLayer[];
  resourceOverrides?: ResourceOverrides;
  fieldConfigsByLayerId?: Record<string, EffectiveResourceConfig>;
  userPrincipals?: string[];
  basemapId?: string;
  onMapReady?: (map: maplibregl.Map) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const contextMenuPopupRef = useRef<maplibregl.Popup | null>(null);
  const identifyPopupRef = useRef<maplibregl.Popup | null>(null);
  const identifyMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const moveHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBasemapStyle(basemapId),
      center: PORTO_ALEGRE,
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl());

    // Alguns estilos (ex: Liberty) referenciam icones de sprite que nao
    // sao usados nessa aplicacao; registra uma imagem vazia para evitar
    // o aviso "Image ... could not be loaded" no console.
    map.on('styleimagemissing', (e) => {
      if (map.hasImage(e.id)) return;
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on('load', () => {
      setReady(true);
      onMapReady?.(map);
    });

    const showExternalMapModal = (state: IdentifyState) => {
      const locationLabel = state.result?.address || state.result?.label || 'Local';
      const options = buildExternalMapOptions(state.lon, state.lat, locationLabel);

      const overlay = document.createElement('div');
      overlay.innerHTML = buildExternalMapModalHtml(options);
      const el = overlay.firstElementChild as HTMLElement;
      document.body.appendChild(el);

      const close = () => {
        el.remove();
      };

      wireExternalMapModalEvents(el, options, {
        onClose: close,
        onOpen: (url) => {
          window.open(url, '_blank', 'noopener,noreferrer');
          close();
        },
        onDownloadKml: () => {
          const kml = buildLocationKml(state.lon, state.lat, locationLabel);
          downloadTextFile('local.kml', kml, 'application/vnd.google-earth.kml+xml');
          close();
        },
      });
    };

    const showIdentifyPopup = (lngLat: maplibregl.LngLat) => {
      identifyMarkerRef.current?.remove();
      identifyMarkerRef.current = new maplibregl.Marker({ color: '#e03131' }).setLngLat(lngLat).addTo(map);

      identifyPopupRef.current?.remove();
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: 'none' })
        .setLngLat(lngLat)
        .addTo(map);
      identifyPopupRef.current = popup;

      const state: IdentifyState = {
        provider: 'arcgis-procempa',
        loading: true,
        error: null,
        result: null,
        lon: lngLat.lng,
        lat: lngLat.lat,
      };

      const closeIdentify = () => {
        popup.remove();
        identifyMarkerRef.current?.remove();
        identifyMarkerRef.current = null;
        if (identifyPopupRef.current === popup) identifyPopupRef.current = null;
      };

      const render = () => {
        popup.setHTML(buildIdentifyPopupHtml(state));
        const el = popup.getElement();
        if (!el) return;
        wireIdentifyPopupEvents(el, {
          onClose: closeIdentify,
          onProviderChange: (provider) => {
            state.provider = provider;
            void load();
          },
          onOpenExternal: () => {
            showExternalMapModal(state);
          },
        });
      };

      const load = async () => {
        state.loading = true;
        state.error = null;
        render();
        try {
          state.result = await reverseGeocode(state.provider, state.lon, state.lat);
        } catch (err) {
          state.result = null;
          state.error = err instanceof Error ? err.message : 'Erro ao identificar local.';
        } finally {
          state.loading = false;
          render();
        }
      };

      render();
      void load();
    };

    const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      contextMenuPopupRef.current?.remove();

      const lngLat = e.lngLat;
      const popup = new maplibregl.Popup({ closeButton: false, maxWidth: 'none' })
        .setLngLat(lngLat)
        .setHTML(buildContextMenuHtml())
        .addTo(map);
      contextMenuPopupRef.current = popup;

      const el = popup.getElement();
      el?.querySelector('.gf-ctx-identify')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        popup.remove();
        showIdentifyPopup(lngLat);
      });
      el?.querySelector('.gf-ctx-close')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        popup.remove();
      });
    };

    map.on('contextmenu', handleContextMenu);

    mapRef.current = map;

    return () => {
      map.off('contextmenu', handleContextMenu);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const basemapIdRef = useRef(basemapId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (basemapIdRef.current === basemapId) return;
    basemapIdRef.current = basemapId;

    let cancelled = false;
    let handleStyleLoad: (() => void) | null = null;

    void (async () => {
      const style = basemapId === 'liberty' ? await getPatchedLibertyStyle() : getBasemapStyle(basemapId);
      if (cancelled) return;

      map.setStyle(style, { diff: false });
      handleStyleLoad = () => {
        syncGroupLayers(map, activeLayers, resourceOverrides);
      };
      map.once('style.load', handleStyleLoad);
    })();

    return () => {
      cancelled = true;
      if (handleStyleLoad) map.off('style.load', handleStyleLoad);
    };
  }, [basemapId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncGroupLayers(map, activeLayers, resourceOverrides);

    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current);
    }
    if (moveHandlerRef.current) {
      map.off('mousemove', moveHandlerRef.current);
    }

    const queryableIds = () =>
      activeLayers
        .flatMap((layer) => [`gl-fill-${layer.id}`, `gl-line-${layer.id}`, `gl-circle-${layer.id}`])
        .filter((id) => map.getLayer(id));

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
      const ids = queryableIds();
      if (ids.length === 0) return;

      const features = map.queryRenderedFeatures(e.point, { layers: ids });
      clearSelection();
      if (features.length === 0) return;

      // Agrupa features distintas (uma mesma geometria pode aparecer em
      // varias sub-layers gl-fill/gl-line/gl-circle da mesma camada).
      const entries: { layer: ActiveLayer; feature: maplibregl.MapGeoJSONFeature; pk: FeaturePk }[] = [];
      const seen = new Set<string>();
      for (const feature of features) {
        const match = /^gl-(fill|line|circle)-(.+)$/.exec(feature.layer.id);
        const layer = activeLayers.find((l) => l.id === match?.[2]);
        const pk = getFeaturePk(feature);
        if (!match || !layer || !pk) continue;
        const key = `${layer.id}:${pk.property}:${pk.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ layer, feature, pk });
      }
      if (entries.length === 0) return;

      let index = 0;

      const showEntry = () => {
        const { layer, feature, pk } = entries[index];

        const fillFilter = pkFilter(pk);
        map.setFilter(`gl-select-fill-${layer.id}`, fillFilterFor(fillFilter));
        map.setFilter(`gl-select-line-${layer.id}`, fillFilter);
        map.setFilter(`gl-select-circle-${layer.id}`, pointPkFilter(pk));

        const effectiveConfig = fieldConfigsByLayerId?.[layer.id];
        const fieldsConfig = effectiveConfig
          ? { fields: effectiveConfig.fields, securityRules: effectiveConfig.securityRules, principals: userPrincipals }
          : undefined;

        const html = buildPopupHtml(layer.label, feature.properties ?? {}, fieldsConfig, {
          index: index + 1,
          total: entries.length,
        });

        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({ maxWidth: 'none', closeButton: false })
            .setLngLat(e.lngLat)
            .addTo(map);
        }
        popupRef.current.setHTML(html);

        const el = popupRef.current.getElement();
        if (!el) return;
        el.querySelector('.gf-popup-zoom')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          const bounds = getFeatureBounds(feature.geometry);
          if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 18 });
        });
        el.querySelector('.gf-popup-prev')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          index = (index - 1 + entries.length) % entries.length;
          showEntry();
        });
        el.querySelector('.gf-popup-next')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          index = (index + 1) % entries.length;
          showEntry();
        });
        el.querySelector('.gf-popup-close')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          clearSelection();
        });
      };

      showEntry();
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const ids = queryableIds();
      if (ids.length === 0) {
        map.getCanvas().style.cursor = '';
        return;
      }
      const features = map.queryRenderedFeatures(e.point, { layers: ids });
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    };

    clickHandlerRef.current = handleClick;
    moveHandlerRef.current = handleMouseMove;
    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
    };
  }, [ready, activeLayers, resourceOverrides, fieldConfigsByLayerId, userPrincipals]);

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
