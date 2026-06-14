// Helpers para seleção/popup de features clicadas no mapa.
import type maplibregl from 'maplibre-gl';

export interface FeaturePk {
  property: string;
  value: string | number;
}

// Identifica a feature pelo mesmo padrão usado na tabela de atributos
// (ogc_fid, depois id) — convenção das tabelas importadas via ogr2ogr.
export function getFeaturePk(properties: Record<string, unknown>): FeaturePk | null {
  if (typeof properties.ogc_fid === 'string' || typeof properties.ogc_fid === 'number') {
    return { property: 'ogc_fid', value: properties.ogc_fid };
  }
  if (typeof properties.id === 'string' || typeof properties.id === 'number') {
    return { property: 'id', value: properties.id };
  }
  return null;
}

export function pkFilter(pk: FeaturePk): maplibregl.FilterSpecification {
  return ['==', ['get', pk.property], pk.value] as unknown as maplibregl.FilterSpecification;
}

export function pointPkFilter(pk: FeaturePk): maplibregl.FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'Point'],
    pkFilter(pk),
  ] as unknown as maplibregl.FilterSpecification;
}

// Monta o HTML do popup com as propriedades da feature.
export function buildPopupHtml(label: string, properties: Record<string, unknown>): string {
  const rows = Object.entries(properties)
    .map(([key, value]) => {
      const display = value === null || value === undefined || value === '' ? '-' : String(value);
      return `<tr><td style="padding:2px 8px 2px 0;color:#666;white-space:nowrap;vertical-align:top;">${escapeHtml(
        key,
      )}</td><td style="padding:2px 0;font-weight:500;">${escapeHtml(display)}</td></tr>`;
    })
    .join('');

  return `
    <div style="font-size:12px;max-width:260px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(label)}</div>
      <table style="border-collapse:collapse;width:100%;">${rows}</table>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
