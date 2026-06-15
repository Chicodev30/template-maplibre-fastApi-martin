import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/http';

export type GeocodingProviderId = 'arcgis-procempa' | 'cdl-rest' | 'nominatim';

export interface GeocodingProvider {
  id: GeocodingProviderId;
  label: string;
}

export const providers: GeocodingProvider[] = [
  { id: 'arcgis-procempa', label: 'ArcGIS Procempa' },
  { id: 'cdl-rest', label: 'CDL REST' },
  { id: 'nominatim', label: 'OpenStreetMap (Nominatim)' },
];

export interface GeocodingResult {
  provider: GeocodingProviderId;
  label: string;
  longitude: number;
  latitude: number;
  score?: number | null;
  bbox?: [number, number, number, number] | null;
}

export type ReverseGeocodingProviderId = 'arcgis-procempa' | 'nominatim';

export interface ReverseGeocodingProvider {
  id: ReverseGeocodingProviderId;
  label: string;
}

export const reverseProviders: ReverseGeocodingProvider[] = [
  { id: 'arcgis-procempa', label: 'ArcGIS' },
  { id: 'nominatim', label: 'Nominatim' },
];

export interface ReverseGeocodingResult {
  provider: ReverseGeocodingProviderId;
  label: string;
  address?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  longitude: number;
  latitude: number;
}

export interface CdlSuggestion {
  label: string;
  value: string;
  codigoLogradouro?: number | null;
}

export function useCdlAddressSuggestions(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['geocoding', 'cdl-suggestions', trimmed],
    enabled: enabled && trimmed.length >= 2,
    staleTime: 30 * 1000,
    queryFn: () => {
      const params = new URLSearchParams({ q: trimmed, limit: '10' });
      return apiGet<CdlSuggestion[]>(`/geocoding/cdl/suggestions?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function searchAddress(provider: GeocodingProviderId, query: string, number?: string) {
  const params = new URLSearchParams({ provider, q: query.trim(), limit: '5' });
  if (number?.trim()) {
    params.set('number', number.trim());
  }
  return apiGet<GeocodingResult[]>(`/geocoding/search?${params.toString()}`);
}

export function reverseGeocode(provider: ReverseGeocodingProviderId, longitude: number, latitude: number) {
  const params = new URLSearchParams({
    provider,
    lon: String(longitude),
    lat: String(latitude),
  });
  return apiGet<ReverseGeocodingResult>(`/geocoding/reverse?${params.toString()}`);
}
