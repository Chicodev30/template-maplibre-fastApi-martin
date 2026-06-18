// Mapas base para OpenLayers: fontes XYZ/OSM públicas e gratuitas.
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import type { Options as XYZOptions } from 'ol/source/XYZ';

export interface BasemapOption {
  id: string;
  label: string;
}

export const BASEMAPS: BasemapOption[] = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'osm-humanitarian', label: 'OSM Humanitarian' },
  { id: 'carto-positron', label: 'Carto Positron' },
  { id: 'carto-voyager', label: 'Carto Voyager' },
  { id: 'esri-imagery', label: 'Esri World Imagery' },
  { id: 'esri-imagery-labels', label: 'Esri Imagery + Labels' },
];

export const DEFAULT_BASEMAP_ID = 'osm';

function xyz(opts: XYZOptions): XYZ {
  return new XYZ({ crossOrigin: 'anonymous', ...opts });
}

export function getBasemapSource(id: string): OSM | XYZ {
  switch (id) {
    case 'osm-humanitarian':
      return xyz({
        url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        maxZoom: 19,
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Humanitarian OSM Team',
      });

    case 'carto-positron':
      return xyz({
        url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        maxZoom: 20,
        attributions: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
      });

    case 'carto-voyager':
      return xyz({
        url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        maxZoom: 20,
        attributions: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
      });

    case 'esri-imagery':
      return xyz({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        attributions: 'Tiles &copy; Esri',
      });

    case 'esri-imagery-labels':
      // OL não suporta múltiplas fontes em uma única TileLayer nativamente;
      // retornamos o imagery base — o chamador deve adicionar uma segunda camada de labels.
      return xyz({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        attributions: 'Tiles &copy; Esri',
      });

    case 'osm':
    default:
      return new OSM();
  }
}
