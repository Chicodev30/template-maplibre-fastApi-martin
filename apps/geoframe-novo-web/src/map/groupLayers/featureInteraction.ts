// Helpers para seleção/popup de features clicadas no mapa.
import maplibregl from 'maplibre-gl';
import type { ResourceFieldConfig, ResourceSecurityRule } from '../../catalog/types/resource.types';
import { fieldLabel, visibleFields } from '../../catalog/utils/fieldVisibility';

// '$id' = feature.id da vector tile (Martin promove colunas inteiras
// id/gid/ogc_fid a feature id do MVT e as remove de "properties").
export interface FeaturePk {
  property: string | '$id';
  value: string | number;
}

// Identifica a feature pelo mesmo padrão usado na tabela de atributos
// (ogc_fid, depois id) — convenção das tabelas importadas via ogr2ogr.
// Quando a coluna de id foi promovida a feature id do MVT (e portanto nao
// aparece em "properties"), usa feature.id como fallback.
export function getFeaturePk(feature: maplibregl.MapGeoJSONFeature): FeaturePk | null {
  const properties = feature.properties ?? {};
  if (typeof properties.ogc_fid === 'string' || typeof properties.ogc_fid === 'number') {
    return { property: 'ogc_fid', value: properties.ogc_fid };
  }
  if (typeof properties.id === 'string' || typeof properties.id === 'number') {
    return { property: 'id', value: properties.id };
  }
  if (typeof feature.id === 'string' || typeof feature.id === 'number') {
    return { property: '$id', value: feature.id };
  }
  return null;
}

export function pkFilter(pk: FeaturePk): maplibregl.FilterSpecification {
  const left = pk.property === '$id' ? ['id'] : ['get', pk.property];
  return ['==', left, pk.value] as unknown as maplibregl.FilterSpecification;
}

export function pointPkFilter(pk: FeaturePk): maplibregl.FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'Point'],
    pkFilter(pk),
  ] as unknown as maplibregl.FilterSpecification;
}

// Monta o HTML do popup com as propriedades da feature, respeitando
// showInPopup/rotulos/restricoes de seguranca da config efetiva da camada.
// Tamanho fixo com rolagem interna e zebra striping para nao crescer
// demais com tabelas de muitos campos.
const POPUP_WIDTH = 280;
const POPUP_MAX_BODY_HEIGHT = 260;

export function buildPopupHtml(
  label: string,
  properties: Record<string, unknown>,
  fieldsConfig?: {
    fields: Record<string, ResourceFieldConfig>;
    securityRules: ResourceSecurityRule[];
    principals: string[];
  },
  pagination?: { index: number; total: number },
): string {
  const allKeys = Object.keys(properties);
  const keys = fieldsConfig
    ? visibleFields(allKeys, fieldsConfig.fields, fieldsConfig.securityRules, fieldsConfig.principals, 'popup')
    : allKeys;

  const rows = keys
    .map((key, i) => {
      const value = properties[key];
      const displayKey = fieldsConfig ? fieldLabel(fieldsConfig.fields, key) : key;
      const display = value === null || value === undefined || value === '' ? '-' : String(value);
      const bg = i % 2 === 0 ? '#ffffff' : '#f2f4f6';
      return `<tr style="background:${bg};">
        <td style="padding:3px 6px;font-size:11px;color:#37474f;font-weight:600;text-align:right;word-break:break-word;overflow-wrap:anywhere;vertical-align:top;width:36%;">${escapeHtml(
          displayKey,
        )}</td>
        <td style="padding:3px 6px;font-size:11px;color:#222;word-break:break-word;overflow-wrap:anywhere;vertical-align:top;">${escapeHtml(
          display,
        )}</td>
      </tr>`;
    })
    .join('');

  const paginationHtml =
    pagination && pagination.total > 1
      ? `<a href="#" class="gf-popup-prev" style="color:#fff;text-decoration:none;padding:0 2px;">&#8249;</a>
         <span style="opacity:0.85;">${pagination.index} de ${pagination.total}</span>
         <a href="#" class="gf-popup-next" style="color:#fff;text-decoration:none;padding:0 2px;">&#8250;</a>`
      : '';

  return `
    <div style="width:${POPUP_WIDTH}px;font-size:11px;font-family:inherit;border-radius:6px;overflow:hidden;">
      <div style="background:#37474f;color:#fff;font-weight:600;font-size:13px;padding:6px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(label)}</span>
        <span style="font-size:11px;font-weight:400;display:flex;align-items:center;gap:4px;white-space:nowrap;">
          ${paginationHtml}
          <a href="#" class="gf-popup-close" style="color:#fff;text-decoration:none;padding:0 0 0 4px;font-size:14px;line-height:1;">&times;</a>
        </span>
      </div>
      <div style="max-height:${POPUP_MAX_BODY_HEIGHT}px;overflow-y:auto;">
        <table style="border-collapse:collapse;width:100%;table-layout:fixed;">${rows}</table>
      </div>
      <div style="padding:6px 10px;border-top:1px solid #e0e0e0;">
        <a href="#" class="gf-popup-zoom" style="font-size:11px;color:#1971c2;text-decoration:none;">Zoom para</a>
      </div>
    </div>
  `;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extendBounds(bounds: maplibregl.LngLatBounds, coords: unknown): void {
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    bounds.extend(coords as [number, number]);
  } else if (Array.isArray(coords)) {
    for (const c of coords) extendBounds(bounds, c);
  }
}

// Calcula o bbox da geometria da feature para o link "Zoom para".
export function getFeatureBounds(
  geometry: maplibregl.MapGeoJSONFeature['geometry'] | undefined,
): maplibregl.LngLatBounds | null {
  if (!geometry || !('coordinates' in geometry)) return null;
  const bounds = new maplibregl.LngLatBounds();
  extendBounds(bounds, geometry.coordinates);
  return bounds.isEmpty() ? null : bounds;
}
