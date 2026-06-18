// Componente principal do mapa — OpenLayers + OGC API Features.
import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import { fromLonLat, toLonLat } from 'ol/proj';
import { ScaleLine, defaults as defaultControls } from 'ol/control';
import { click } from 'ol/events/condition';
import Select from 'ol/interaction/Select';
import type { SelectEvent } from 'ol/interaction/Select';
import type { Coordinate } from 'ol/coordinate';
import 'ol/ol.css';

import { DEFAULT_BASEMAP_ID, getBasemapSource } from './basemaps';
import type { ActiveLayer } from './groupLayers/useActiveLayers';
import { syncGroupLayers } from './groupLayers/syncGroupLayers';
import { buildPopupHtml, escapeHtml } from './groupLayers/featureInteraction';
import {
  buildContextMenuHtml,
  buildIdentifyPopupHtml,
  buildExternalMapModalHtml,
  buildExternalMapOptions,
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
const PORTO_ALEGRE = fromLonLat([-51.2287, -30.0346]);

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
  onMapReady?: (map: Map) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const mapRef = useRef<Map | null>(null);
  const basemapLayerRef = useRef<TileLayer | null>(null);
  const [ready, setReady] = useState(false);

  // Inicializa o mapa.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const basemapLayer = new TileLayer({ source: getBasemapSource(basemapId), zIndex: 0 });
    basemapLayerRef.current = basemapLayer;

    const popupEl = document.createElement('div');
    popupEl.style.cssText = 'position:absolute;background:white;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:auto;';
    popupRef.current = popupEl;

    const overlay = new Overlay({ element: popupEl, positioning: 'bottom-center', offset: [0, -4] });
    overlayRef.current = overlay;

    const map = new Map({
      target: containerRef.current,
      layers: [basemapLayer],
      overlays: [overlay],
      view: new View({ center: PORTO_ALEGRE, zoom: 11, projection: 'EPSG:3857' }),
      controls: defaultControls({ attribution: false }).extend([new ScaleLine()]),
    });

    // Seleção de feature por clique.
    const select = new Select({ condition: click });
    select.on('select', (e: SelectEvent) => {
      const features = e.selected;
      if (features.length === 0) {
        overlay.setPosition(undefined);
        return;
      }

      const coord = map.getEventCoordinate((e.mapBrowserEvent as { originalEvent: MouseEvent }).originalEvent);
      const entries = features.map((f, idx) => {
        const layerId = f.get('gfLayerId') as string | undefined;
        const layer = activeLayers.find((l) => l.id === layerId);
        const props = f.getProperties() as Record<string, unknown>;
        delete props.geometry;
        return { label: layer?.label ?? 'Feature', props, idx };
      });

      let index = 0;
      const show = () => {
        const { label, props } = entries[index];
        const layerId = features[index].get('gfLayerId') as string | undefined;
        const effectiveConfig = layerId ? fieldConfigsByLayerId?.[layerId] : undefined;
        const fieldsConfig = effectiveConfig
          ? { fields: effectiveConfig.fields, securityRules: effectiveConfig.securityRules, principals: userPrincipals }
          : undefined;
        const html = buildPopupHtml(label, props, fieldsConfig, { index: index + 1, total: entries.length });
        popupEl.innerHTML = html;
        overlay.setPosition(coord);
        wirePopupEvents();
      };

      const wirePopupEvents = () => {
        popupEl.querySelector('.gf-popup-close')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          overlay.setPosition(undefined);
          select.getFeatures().clear();
        });
        popupEl.querySelector('.gf-popup-prev')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          index = (index - 1 + entries.length) % entries.length;
          show();
        });
        popupEl.querySelector('.gf-popup-next')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          index = (index + 1) % entries.length;
          show();
        });
        popupEl.querySelector('.gf-popup-zoom')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          const geom = features[index].getGeometry();
          if (geom) {
            const extent = geom.getExtent();
            map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 18, duration: 400 });
          }
        });
      };

      show();
    });
    map.addInteraction(select);

    // Menu de contexto (botão direito) com opção de identificar localização.
    const contextEl = document.createElement('div');
    contextEl.style.cssText = 'position:absolute;pointer-events:auto;';
    const contextOverlay = new Overlay({ element: contextEl, positioning: 'top-left' });
    map.addOverlay(contextOverlay);

    const showIdentifyPopup = (coord: Coordinate) => {
      const [lon, lat] = toLonLat(coord);
      const state: IdentifyState = { provider: 'arcgis-procempa', loading: true, error: null, result: null, lon, lat };

      const identEl = document.createElement('div');
      identEl.style.cssText = 'position:absolute;pointer-events:auto;';
      const identOverlay = new Overlay({ element: identEl, positioning: 'bottom-left', offset: [0, -4] });
      map.addOverlay(identOverlay);
      identOverlay.setPosition(coord);

      const closeIdent = () => {
        map.removeOverlay(identOverlay);
      };

      const render = () => {
        identEl.innerHTML = buildIdentifyPopupHtml(state);
        wireIdentifyPopupEvents(identEl, {
          onClose: closeIdent,
          onProviderChange: (provider) => { state.provider = provider; void load(); },
          onOpenExternal: () => { showExternalMapModal(state); },
        });
      };

      const load = async () => {
        state.loading = true;
        state.error = null;
        render();
        try {
          state.result = await reverseGeocode(state.provider, lon, lat);
        } catch (err) {
          state.error = err instanceof Error ? err.message : 'Erro ao identificar local.';
          state.result = null;
        } finally {
          state.loading = false;
          render();
        }
      };

      render();
      void load();
    };

    const showExternalMapModal = (state: IdentifyState) => {
      const locationLabel = state.result?.address || state.result?.label || 'Local';
      const options = buildExternalMapOptions(state.lon, state.lat, locationLabel);
      const overlay = document.createElement('div');
      overlay.innerHTML = buildExternalMapModalHtml(options);
      const el = overlay.firstElementChild as HTMLElement;
      document.body.appendChild(el);
      wireExternalMapModalEvents(el, options, {
        onClose: () => el.remove(),
        onOpen: (url) => { window.open(url, '_blank', 'noopener,noreferrer'); el.remove(); },
        onDownloadKml: () => {
          const kml = buildLocationKml(state.lon, state.lat, locationLabel);
          downloadTextFile('local.kml', kml, 'application/vnd.google-earth.kml+xml');
          el.remove();
        },
      });
    };

    map.getViewport().addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const coord = map.getEventCoordinate(e as MouseEvent);
      contextEl.innerHTML = buildContextMenuHtml();
      contextOverlay.setPosition(coord);
      contextEl.querySelector('.gf-ctx-identify')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        contextOverlay.setPosition(undefined);
        showIdentifyPopup(coord);
      });
      contextEl.querySelector('.gf-ctx-close')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        contextOverlay.setPosition(undefined);
      });
    });

    map.once('postrender', () => {
      setReady(true);
      onMapReady?.(map);
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Troca basemap.
  const basemapIdRef = useRef(basemapId);
  useEffect(() => {
    if (!ready || basemapIdRef.current === basemapId) return;
    basemapIdRef.current = basemapId;
    basemapLayerRef.current?.setSource(getBasemapSource(basemapId));
  }, [basemapId, ready]);

  // Sincroniza camadas ativas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncGroupLayers(map, activeLayers, resourceOverrides);
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
