// Popup "Identificação de Local": geocodificação reversa (ArcGIS/Nominatim)
// e coordenadas do ponto clicado em TM-POA (10665), SIRGAS Geográficas (4674)
// e WGS84 (4326).
import { reverseProviders, type ReverseGeocodingProviderId, type ReverseGeocodingResult } from '../../catalog/api/geocoding.api';
import { fromWgs84 } from '../utils/coordinateSystems';
import { escapeHtml } from './featureInteraction';

const POPUP_WIDTH = 300;

const COPY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.6"/>' +
  '<path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" stroke="currentColor" stroke-width="1.6"/>' +
  '</svg>';

const EXTERNAL_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M15 3h6v6M21 3 11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

// Ícones lineares minimalistas (sem cor) para o modal "Mapas externos".
const ICON_SEARCH =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

const ICON_PIN =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.8"/>' +
  '</svg>';

const ICON_MAP =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.8"/>' +
  '</svg>';

const ICON_GLOBE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" stroke-width="1.8"/>' +
  '</svg>';

const ICON_ROUTE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.8"/>' +
  '<circle cx="18" cy="6" r="2.5" stroke="currentColor" stroke-width="1.8"/>' +
  '<circle cx="12" cy="19" r="2.5" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M7.8 8 11 16.5M16.2 8 13 16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

const ICON_STREETVIEW =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="12" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

const ICON_EARTH =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M4 9h16M4 15h16" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" stroke="currentColor" stroke-width="1.8"/>' +
  '</svg>';

const ICON_FILE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M14 3v4h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

const ICON_LAYERS =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M3 12l9 5 9-5M3 16l9 5 9-5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
  '</svg>';

const ICON_CAR =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M4 16v-3.5L6 8h12l2 4.5V16" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<path d="M3 16h18v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<circle cx="7.5" cy="13.5" r="1" stroke="currentColor" stroke-width="1.4"/>' +
  '<circle cx="16.5" cy="13.5" r="1" stroke="currentColor" stroke-width="1.4"/>' +
  '</svg>';

export interface IdentifyState {
  provider: ReverseGeocodingProviderId;
  loading: boolean;
  error: string | null;
  result: ReverseGeocodingResult | null;
  lon: number;
  lat: number;
}

function formatCoord(value: number, digits: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function infoRow(label: string, value: string): string {
  return `<tr style="background:#ffffff;">
    <td style="padding:3px 6px;font-size:11px;color:#37474f;font-weight:600;text-align:right;vertical-align:top;width:38%;">${escapeHtml(label)}</td>
    <td style="padding:3px 6px;font-size:11px;color:#222;word-break:break-word;overflow-wrap:anywhere;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function coordRow(label: string, value: string): string {
  return `<tr style="background:#f2f4f6;">
    <td style="padding:3px 6px;font-size:11px;color:#37474f;font-weight:600;text-align:right;vertical-align:top;width:38%;">${escapeHtml(label)}</td>
    <td style="padding:3px 6px;font-size:11px;color:#c92a2a;vertical-align:top;">
      <span>${escapeHtml(value)}</span>
      <a href="#" class="gf-copy" data-copy="${escapeHtml(value)}" title="Copiar coordenadas" style="color:#868e96;text-decoration:none;margin-left:4px;vertical-align:middle;">${COPY_ICON}</a>
    </td>
  </tr>`;
}

export function buildIdentifyPopupHtml(state: IdentifyState): string {
  const { provider, loading, error, result, lon, lat } = state;

  const [tmpoaE, tmpoaN] = fromWgs84('EPSG:10665', lon, lat);
  const [sirgasGeoLon, sirgasGeoLat] = fromWgs84('EPSG:4674', lon, lat);

  const providerOptions = reverseProviders
    .map((item) => `<option value="${item.id}" ${item.id === provider ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');

  const statusLabel = loading ? 'Buscando...' : error ? 'Erro' : result ? 'OK' : '-';

  const rows = [
    infoRow('Status', statusLabel),
    infoRow('Endereço', result?.address ?? '-'),
    infoRow('Bairro', result?.neighborhood ?? '-'),
    infoRow('CEP', result?.postal_code ?? '-'),
    coordRow('TM-POA (EPSG:10665)', `${formatCoord(tmpoaE, 2)}, ${formatCoord(tmpoaN, 2)}`),
    coordRow('SIRGAS Geográficas (EPSG:4674)', `${formatCoord(sirgasGeoLon, 6)}, ${formatCoord(sirgasGeoLat, 6)}`),
    coordRow('WGS84 (EPSG:4326)', `${formatCoord(lon, 6)}, ${formatCoord(lat, 6)}`),
  ].join('');

  return `
    <div style="width:${POPUP_WIDTH}px;font-size:11px;font-family:inherit;border-radius:6px;overflow:hidden;">
      <div style="background:#37474f;color:#fff;font-weight:600;font-size:13px;padding:6px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>Identificação de Local</span>
        <a href="#" class="gf-popup-close" style="color:#fff;text-decoration:none;font-size:14px;line-height:1;">&times;</a>
      </div>
      <div style="padding:6px 10px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:8px;">
        <label style="font-size:11px;font-weight:600;color:#37474f;">Geocodificador</label>
        <select class="gf-geocoder-select" style="flex:1;font-size:11px;padding:2px 4px;border:1px solid #ced4da;border-radius:4px;">
          ${providerOptions}
        </select>
      </div>
      <div style="max-height:280px;overflow-y:auto;">
        <table style="border-collapse:collapse;width:100%;table-layout:fixed;">${rows}</table>
        ${error ? `<div style="padding:6px 10px;color:#c92a2a;font-size:11px;">${escapeHtml(error)}</div>` : ''}
      </div>
      <div style="padding:6px 10px;border-top:1px solid #e0e0e0;">
        <a href="#" class="gf-open-external" style="font-size:11px;color:#1971c2;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          ${EXTERNAL_ICON} Abrir mapas externos
        </a>
      </div>
    </div>
  `;
}

export function wireIdentifyPopupEvents(
  el: HTMLElement,
  handlers: {
    onClose: () => void;
    onProviderChange: (provider: ReverseGeocodingProviderId) => void;
    onOpenExternal: () => void;
  },
): void {
  el.querySelector('.gf-popup-close')?.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onClose();
  });

  el.querySelector('.gf-geocoder-select')?.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value as ReverseGeocodingProviderId;
    handlers.onProviderChange(value);
  });

  el.querySelectorAll<HTMLAnchorElement>('.gf-copy').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const value = link.dataset.copy ?? '';
      void navigator.clipboard?.writeText(value);
    });
  });

  el.querySelector('.gf-open-external')?.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onOpenExternal();
  });
}

export interface ExternalMapOption {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  url?: string;
  download?: boolean;
}

function formatExternalCoordinate(value: number, maximumFractionDigits = 6): string {
  return value.toFixed(maximumFractionDigits);
}

function buildGeoHackHemisphere(value: number, positiveHemisphere: string, negativeHemisphere: string): string {
  return value >= 0 ? positiveHemisphere : negativeHemisphere;
}

// Opções do modal "Mapas externos", todas a partir das coordenadas WGS84 (4326).
export function buildExternalMapOptions(lon: number, lat: number, locationLabel: string): ExternalMapOption[] {
  const lat6 = formatExternalCoordinate(lat, 6);
  const lon6 = formatExternalCoordinate(lon, 6);
  const lat8 = formatExternalCoordinate(lat, 8);
  const lon8 = formatExternalCoordinate(lon, 8);
  const lat14 = formatExternalCoordinate(lat, 14);
  const lon14 = formatExternalCoordinate(lon, 14);

  const geohackPageName = encodeURIComponent(locationLabel);
  const geohackLat = formatExternalCoordinate(Math.abs(lat), 6);
  const geohackLon = formatExternalCoordinate(Math.abs(lon), 6);
  const geohackParams = `${geohackLat}_${buildGeoHackHemisphere(lat, 'N', 'S')}_${geohackLon}_${buildGeoHackHemisphere(lon, 'E', 'W')}_scale:8000`;

  return [
    {
      id: 'bing-maps',
      label: 'Bing Maps',
      icon: ICON_SEARCH,
      url: `https://www.bing.com/maps?cp=${lat6}~${lon6}&lvl=19&style=r`,
    },
    {
      id: 'google-maps',
      label: 'Google Maps',
      icon: ICON_PIN,
      url: `https://www.google.com/maps?q=${lat14},${lon14}`,
    },
    {
      id: 'openstreetmap',
      label: 'OpenStreetMap',
      icon: ICON_MAP,
      url: `https://www.openstreetmap.org/?mlat=${lat6}&mlon=${lon6}#map=19/${lat6}/${lon6}`,
    },
    {
      id: 'geohack',
      label: 'GeoHack',
      icon: ICON_GLOBE,
      url: `https://geohack.toolforge.org/geohack.php?language=pt&pagename=${geohackPageName}&params=${encodeURIComponent(geohackParams)}`,
    },
    {
      id: 'here-wego',
      label: 'Here WeGo',
      icon: ICON_ROUTE,
      url: `https://wego.here.com/location/?map=${lat6},${lon6},17.92`,
    },
    {
      id: 'mapillary',
      label: 'Mapillary',
      icon: ICON_STREETVIEW,
      url: `https://www.mapillary.com/app/?lat=${lat14}&lng=${lon14}&z=18.059885316477082`,
    },
    {
      id: 'google-earth',
      label: 'Google Earth',
      subtitle: 'Visualizar',
      icon: ICON_EARTH,
      url: `https://earth.google.com/web/@${lat8},${lon8},55.39458556a,244.14142828d,35y,0h,0t,0r/data=CgRCAggBOgMKATBCAggASg0I____________ARAA`,
    },
    {
      id: 'google-earth-kml',
      label: 'Google Earth',
      subtitle: 'KML',
      icon: ICON_FILE,
      download: true,
    },
    {
      id: 'arcgis-online',
      label: 'ArcGIS Online',
      icon: ICON_LAYERS,
      url: `https://www.arcgis.com/apps/mapviewer/index.html?center=${lon6},${lat6}&level=20`,
    },
    {
      id: 'waze',
      label: 'Waze',
      icon: ICON_CAR,
      url: `https://www.waze.com/pt-BR/live-map/directions?to=ll.${lat6},${lon6}`,
    },
  ];
}

export function buildExternalMapModalHtml(options: ExternalMapOption[]): string {
  const items = options
    .map(
      (opt) => `
    <a href="#" class="gf-ext-option" data-id="${escapeHtml(opt.id)}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 8px;border:1px solid #e9ecef;border-radius:8px;text-decoration:none;color:#495057;min-height:80px;">
      <span style="color:#495057;display:flex;">${opt.icon}</span>
      <span style="font-size:12px;font-weight:600;color:#37474f;text-align:center;line-height:1.2;">${escapeHtml(opt.label)}</span>
      ${opt.subtitle ? `<span style="font-size:10px;color:#868e96;">${escapeHtml(opt.subtitle)}</span>` : ''}
    </a>`,
    )
    .join('');

  return `
    <div class="gf-ext-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:1000;">
      <div class="gf-ext-modal" style="background:#fff;border-radius:8px;width:380px;max-width:90vw;max-height:85vh;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:inherit;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e9ecef;">
          <span style="font-size:14px;font-weight:600;color:#37474f;">Mapas externos</span>
          <a href="#" class="gf-ext-close" style="color:#868e96;text-decoration:none;font-size:18px;line-height:1;">&times;</a>
        </div>
        <div style="padding:16px;display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;max-height:70vh;overflow-y:auto;">
          ${items}
        </div>
      </div>
    </div>
  `;
}

export function wireExternalMapModalEvents(
  el: HTMLElement,
  options: ExternalMapOption[],
  handlers: {
    onClose: () => void;
    onOpen: (url: string) => void;
    onDownloadKml: () => void;
  },
): void {
  el.querySelector('.gf-ext-close')?.addEventListener('click', (event) => {
    event.preventDefault();
    handlers.onClose();
  });

  el.querySelector('.gf-ext-overlay')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      handlers.onClose();
    }
  });

  el.querySelectorAll<HTMLAnchorElement>('.gf-ext-option').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const option = options.find((item) => item.id === link.dataset.id);
      if (!option) return;
      if (option.download) {
        handlers.onDownloadKml();
        return;
      }
      if (option.url) {
        handlers.onOpen(option.url);
      }
    });
  });
}

// Gera um KML simples com um Placemark no ponto identificado.
export function buildLocationKml(lon: number, lat: number, label: string): string {
  const name = escapeHtml(label || 'Local');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${name}</name>
    <Point>
      <coordinates>${lon},${lat},0</coordinates>
    </Point>
  </Placemark>
</kml>`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildContextMenuHtml(): string {
  return `
    <div style="min-width:180px;font-size:12px;font-family:inherit;border-radius:6px;overflow:hidden;">
      <a href="#" class="gf-ctx-identify" style="display:block;padding:8px 12px;color:#222;text-decoration:none;">Identificar localização</a>
      <a href="#" class="gf-ctx-close" style="display:block;padding:8px 12px;color:#222;text-decoration:none;border-top:1px solid #eee;">Fechar</a>
    </div>
  `;
}
