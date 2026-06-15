// Definições de sistemas de coordenadas usados no painel "Localizar Coordenada"
// e conversão para WGS84 (lon/lat) usada pelo MapLibre.
import proj4 from 'proj4';

proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs(
  'EPSG:10665',
  '+proj=tmerc +lat_0=0 +lon_0=-51 +k=0.999995 +x_0=300000 +y_0=5000000 +ellps=GRS80 +units=m +no_defs +type=crs',
);
proj4.defs('EPSG:31982', '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

export type CoordinateSystemId = 'EPSG:4326' | 'EPSG:10665' | 'EPSG:4674' | 'EPSG:31982';

export interface CoordinateSystemDef {
  id: CoordinateSystemId;
  label: string;
  xLabel: string;
  yLabel: string;
  xPlaceholder: string;
  yPlaceholder: string;
  hint: string;
}

export const COORDINATE_SYSTEMS: CoordinateSystemDef[] = [
  {
    id: 'EPSG:4326',
    label: 'WGS84',
    xLabel: 'Longitude (X)',
    yLabel: 'Latitude (Y)',
    xPlaceholder: 'Ex: -51.2177',
    yPlaceholder: 'Ex: -30.0746',
    hint: 'Porto Alegre: longitude -52 a -50, latitude -31 a -29.5',
  },
  {
    id: 'EPSG:10665',
    label: 'TM-POA',
    xLabel: 'Coordenada E (X)',
    yLabel: 'Coordenada N (Y)',
    xPlaceholder: 'Ex: 279020',
    yPlaceholder: 'Ex: 1659300',
    hint: 'SIRGAS 2000 / Porto Alegre TM, coordenadas planas em metros',
  },
  {
    id: 'EPSG:4674',
    label: 'SIRGAS Geo',
    xLabel: 'Longitude (X)',
    yLabel: 'Latitude (Y)',
    xPlaceholder: 'Ex: -51.2177',
    yPlaceholder: 'Ex: -30.0746',
    hint: 'SIRGAS 2000 geográfico, graus decimais',
  },
];

/** Converte coordenadas do sistema informado para WGS84 (lon, lat). */
export function toWgs84(system: CoordinateSystemId, x: number, y: number): [number, number] {
  if (system === 'EPSG:4326') return [x, y];
  return proj4(system, 'EPSG:4326', [x, y]) as [number, number];
}

/** Converte coordenadas WGS84 (lon, lat) para o sistema informado. */
export function fromWgs84(system: CoordinateSystemId, lon: number, lat: number): [number, number] {
  if (system === 'EPSG:4326') return [lon, lat];
  return proj4('EPSG:4326', system, [lon, lat]) as [number, number];
}
