// Painel "Palavra-chave": busca um valor exato em todas as colunas de texto
// de todas as tabelas (ou só nas camadas ativas), sem depender de campos
// marcados como "Pesq.". Resultados em cards com zoom e coordenadas (4326).
import { useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { Geometry } from 'geojson';
import { ActionIcon, Group, Loader, Pagination, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useKeywordSearch } from '../../catalog/api/resources.api';
import type { KeywordSearchResult } from '../../catalog/types/resource.types';
import type { ActiveLayer } from '../../map/groupLayers/useActiveLayers';
import { CloseIcon, SearchIcon } from './icons';

const PAGE_SIZE = 25;

const HIGHLIGHT_SOURCE_ID = 'kw-highlight-source';
const HIGHLIGHT_FILL_ID = 'kw-highlight-fill';
const HIGHLIGHT_LINE_ID = 'kw-highlight-line';
const HIGHLIGHT_CIRCLE_ID = 'kw-highlight-circle';
const HIGHLIGHT_DURATION_MS = 8000;

type MapWithHighlight = maplibregl.Map & { __kwHighlightCleanup?: () => void };

// Remove o destaque (poligono/circulo verde + pin) deixado por uma busca anterior.
function clearHighlight(map: MapWithHighlight) {
  map.__kwHighlightCleanup?.();
  map.__kwHighlightCleanup = undefined;
}

// Destaque temporario em verde + pin saltando sobre o resultado, removido
// apos alguns segundos ou ao iniciar um novo destaque.
function showHighlight(map: MapWithHighlight, bbox: [number, number, number, number]) {
  clearHighlight(map);

  const [minX, minY, maxX, maxY] = bbox;
  const isPoint = minX === maxX && minY === maxY;
  const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];

  const geometry: Geometry = isPoint
    ? { type: 'Point', coordinates: center }
    : {
        type: 'Polygon',
        coordinates: [
          [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY],
          ],
        ],
      };

  map.addSource(HIGHLIGHT_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry },
  });

  if (isPoint) {
    map.addLayer({
      id: HIGHLIGHT_CIRCLE_ID,
      type: 'circle',
      source: HIGHLIGHT_SOURCE_ID,
      paint: {
        'circle-radius': 14,
        'circle-color': '#40c057',
        'circle-opacity': 0.35,
        'circle-stroke-color': '#2f9e44',
        'circle-stroke-width': 2,
      },
    });
  } else {
    map.addLayer({
      id: HIGHLIGHT_FILL_ID,
      type: 'fill',
      source: HIGHLIGHT_SOURCE_ID,
      paint: { 'fill-color': '#40c057', 'fill-opacity': 0.25 },
    });
    map.addLayer({
      id: HIGHLIGHT_LINE_ID,
      type: 'line',
      source: HIGHLIGHT_SOURCE_ID,
      paint: { 'line-color': '#2f9e44', 'line-width': 3 },
    });
  }

  // O elemento raiz do Marker recebe o transform de posicionamento do
  // MapLibre; a animacao de "salto" precisa ficar num filho, senao o
  // @keyframes sobrescreve esse transform e o pin fica fora de posicao.
  const markerEl = document.createElement('div');
  const bounceEl = document.createElement('div');
  bounceEl.className = 'gf-bounce-marker';
  bounceEl.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2C7.8 2 4.5 5.3 4.5 9.4 4.5 14.6 12 22 12 22s7.5-7.4 7.5-12.6C19.5 5.3 16.2 2 12 2Z" fill="#2f9e44"/>' +
    '<circle cx="12" cy="9.5" r="3" fill="#fff"/>' +
    '</svg>';
  markerEl.appendChild(bounceEl);
  const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' }).setLngLat(center).addTo(map);

  const timeoutId = window.setTimeout(() => clearHighlight(map), HIGHLIGHT_DURATION_MS);

  map.__kwHighlightCleanup = () => {
    window.clearTimeout(timeoutId);
    marker.remove();
    for (const layerId of [HIGHLIGHT_FILL_ID, HIGHLIGHT_LINE_ID, HIGHLIGHT_CIRCLE_ID]) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID);
  };
}

function zoomTo(map: maplibregl.Map | null, bbox: [number, number, number, number] | null) {
  if (!map || !bbox) return;
  const [minX, minY, maxX, maxY] = bbox;
  if ([minX, minY, maxX, maxY].some((v) => !Number.isFinite(v))) return;

  showHighlight(map as MapWithHighlight, bbox);

  if (minX === maxX && minY === maxY) {
    map.flyTo({ center: [minX, minY], zoom: 18, duration: 500 });
    return;
  }
  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 48, maxZoom: 18, duration: 500 },
  );
}

function ResultCard({ result, map }: { result: KeywordSearchResult; map: maplibregl.Map | null }) {
  const bbox = result.bbox;
  const lat = bbox ? (bbox[1] + bbox[3]) / 2 : null;
  const lng = bbox ? (bbox[0] + bbox[2]) / 2 : null;
  const entries = Object.entries(
    Object.keys(result.matches).length > 0 ? result.matches : result.row,
  );

  return (
    <Stack
      gap={4}
      p="xs"
      style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 6 }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={600} lineClamp={1}>
          {result.layerLabel}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Zoom"
          disabled={!bbox || !map}
          onClick={() => zoomTo(map, bbox)}
        >
          <SearchIcon />
        </ActionIcon>
      </Group>

      {lat !== null && lng !== null && (
        <Text size="xs" c="dimmed">
          lat: {lat.toFixed(6)} | long: {lng.toFixed(6)}
        </Text>
      )}

      <Stack gap={2}>
        {entries.map(([key, value]) => (
          <Group key={key} gap={6} wrap="nowrap" align="flex-start">
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {key}:
            </Text>
            <Text size="xs" fw={500} style={{ wordBreak: 'break-word' }}>
              {value === null || value === undefined ? '-' : String(value)}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

export function KeywordSearchPanel({
  activeLayers,
  map,
}: {
  activeLayers: ActiveLayer[];
  map: maplibregl.Map | null;
}) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [onlyActiveLayers, setOnlyActiveLayers] = useState(false);
  const [simplified, setSimplified] = useState(true);
  const [page, setPage] = useState(1);

  const ready = submittedQuery.length >= 3;
  const resourceIds = onlyActiveLayers
    ? Array.from(new Set(activeLayers.filter((l) => l.visible).map((l) => l.resourceId)))
    : null;

  const search = useKeywordSearch(submittedQuery, resourceIds, PAGE_SIZE, (page - 1) * PAGE_SIZE, ready);

  const total = search.data?.total ?? 0;
  const results = ready ? search.data?.results ?? [] : [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  function handleSearch() {
    setSubmittedQuery(query.trim());
    setPage(1);
  }

  function handleClear() {
    setQuery('');
    setSubmittedQuery('');
    setPage(1);
  }

  return (
    <Stack gap="sm" p="sm">
      <TextInput
        label="Pesquisa palavra-chave"
        placeholder="Informe um valor exato"
        size="xs"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSearch();
        }}
        rightSectionPointerEvents="all"
        rightSection={
          query ? (
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Limpar" onClick={handleClear}>
              <CloseIcon />
            </ActionIcon>
          ) : null
        }
        rightSectionWidth={query ? undefined : 0}
      />

      <Group justify="space-between" align="flex-end" gap="sm">
        <Text size="xs" c="dimmed">
          Digite pelo menos 3 caracteres e clique na lupa
        </Text>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Pesquisar"
          disabled={query.trim().length < 3}
          onClick={handleSearch}
        >
          {search.isFetching ? <Loader size="xs" /> : <SearchIcon />}
        </ActionIcon>
      </Group>

      {search.isFetching && (
        <Text size="xs" c="dimmed">
          Buscando...
        </Text>
      )}

      <Group justify="space-between" wrap="wrap" gap="sm">
        <Switch
          size="sm"
          label="Somente camadas ativas"
          checked={onlyActiveLayers}
          onChange={(e) => {
            setOnlyActiveLayers(e.currentTarget.checked);
            setPage(1);
          }}
        />
        <Switch
          size="sm"
          label="Resultados simplificados"
          checked={simplified}
          onChange={(e) => setSimplified(e.currentTarget.checked)}
        />
      </Group>

      {ready && (
        <Text size="xs" c="dimmed">
          {total === 0 ? '0 resultado(s)' : `${rangeStart}-${rangeEnd} de ${total} resultado(s)`}
        </Text>
      )}

      <Stack gap="xs">
        {ready &&
          results.map((result, index) => (
            <ResultCard
              key={`${result.resourceId}-${index}`}
              result={simplified ? result : { ...result, matches: {} }}
              map={map}
            />
          ))}
      </Stack>

      {ready && totalPages > 1 && (
        <Group justify="center">
          <Pagination size="xs" total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
