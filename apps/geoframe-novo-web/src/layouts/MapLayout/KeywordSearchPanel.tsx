// Painel "Palavra-chave": busca um valor exato em todas as colunas de texto
// de todas as tabelas (ou só nas camadas ativas), sem depender de campos
// marcados como "Pesq.".
import { useRef, useState } from 'react';
import type Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Polygon, Point } from 'ol/geom';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { ActionIcon, Group, Loader, Pagination, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useKeywordSearch } from '../../catalog/api/resources.api';
import type { KeywordSearchResult } from '../../catalog/types/resource.types';
import type { ActiveLayer } from '../../map/groupLayers/useActiveLayers';
import { CloseIcon, SearchIcon } from './icons';

const PAGE_SIZE = 25;
const HIGHLIGHT_DURATION_MS = 8000;

function zoomTo(
  map: Map | null,
  bbox: [number, number, number, number] | null,
  highlightLayerRef: React.MutableRefObject<VectorLayer | null>,
  markerRef: React.MutableRefObject<Overlay | null>,
) {
  if (!map || !bbox) return;
  const [minX, minY, maxX, maxY] = bbox;
  if ([minX, minY, maxX, maxY].some((v) => !Number.isFinite(v))) return;

  // Limpa highlight anterior.
  if (highlightLayerRef.current) {
    map.removeLayer(highlightLayerRef.current);
    highlightLayerRef.current = null;
  }
  if (markerRef.current) {
    map.removeOverlay(markerRef.current);
    markerRef.current = null;
  }

  const isPoint = minX === maxX && minY === maxY;
  const centerLon = (minX + maxX) / 2;
  const centerLat = (minY + maxY) / 2;
  const center = fromLonLat([centerLon, centerLat]);

  if (isPoint) {
    const hlLayer = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new Point(center))] }),
      style: new Style({ image: new CircleStyle({ radius: 14, fill: new Fill({ color: 'rgba(64,192,87,0.35)' }), stroke: new Stroke({ color: '#2f9e44', width: 2 }) }) }),
      zIndex: 999,
    });
    map.addLayer(hlLayer);
    highlightLayerRef.current = hlLayer;
  } else {
    const ring = [
      fromLonLat([minX, minY]), fromLonLat([maxX, minY]),
      fromLonLat([maxX, maxY]), fromLonLat([minX, maxY]),
      fromLonLat([minX, minY]),
    ];
    const hlLayer = new VectorLayer({
      source: new VectorSource({ features: [new Feature(new Polygon([ring]))] }),
      style: new Style({ fill: new Fill({ color: 'rgba(64,192,87,0.25)' }), stroke: new Stroke({ color: '#2f9e44', width: 3 }) }),
      zIndex: 999,
    });
    map.addLayer(hlLayer);
    highlightLayerRef.current = hlLayer;
  }

  const markerEl = document.createElement('div');
  markerEl.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#2f9e44;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.5);transform:translate(-50%,-50%);';
  const overlay = new Overlay({ element: markerEl, positioning: 'center-center', stopEvent: false });
  overlay.setPosition(center);
  map.addOverlay(overlay);
  markerRef.current = overlay;

  window.setTimeout(() => {
    if (highlightLayerRef.current) { map.removeLayer(highlightLayerRef.current); highlightLayerRef.current = null; }
    if (markerRef.current) { map.removeOverlay(markerRef.current); markerRef.current = null; }
  }, HIGHLIGHT_DURATION_MS);

  if (isPoint) {
    map.getView().animate({ center, zoom: 18, duration: 500 });
  } else {
    const extent = [...fromLonLat([minX, minY]), ...fromLonLat([maxX, maxY])] as [number, number, number, number];
    map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 18, duration: 500 });
  }
}

function ResultCard({
  result,
  map,
  highlightLayerRef,
  markerRef,
}: {
  result: KeywordSearchResult;
  map: Map | null;
  highlightLayerRef: React.MutableRefObject<VectorLayer | null>;
  markerRef: React.MutableRefObject<Overlay | null>;
}) {
  const bbox = result.bbox;
  const lat = bbox ? (bbox[1] + bbox[3]) / 2 : null;
  const lng = bbox ? (bbox[0] + bbox[2]) / 2 : null;
  const entries = Object.entries(Object.keys(result.matches).length > 0 ? result.matches : result.row);

  return (
    <Stack gap={4} p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 6 }}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={600} lineClamp={1}>{result.layerLabel}</Text>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Zoom" disabled={!bbox || !map} onClick={() => zoomTo(map, bbox, highlightLayerRef, markerRef)}>
          <SearchIcon />
        </ActionIcon>
      </Group>
      {lat !== null && lng !== null && <Text size="xs" c="dimmed">lat: {lat.toFixed(6)} | long: {lng.toFixed(6)}</Text>}
      <Stack gap={2}>
        {entries.map(([key, value]) => (
          <Group key={key} gap={6} wrap="nowrap" align="flex-start">
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{key}:</Text>
            <Text size="xs" fw={500} style={{ wordBreak: 'break-word' }}>{value === null || value === undefined ? '-' : String(value)}</Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

export function KeywordSearchPanel({ activeLayers, map }: { activeLayers: ActiveLayer[]; map: Map | null }) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [onlyActiveLayers, setOnlyActiveLayers] = useState(false);
  const [simplified, setSimplified] = useState(true);
  const [page, setPage] = useState(1);
  const highlightLayerRef = useRef<VectorLayer | null>(null);
  const markerRef = useRef<Overlay | null>(null);

  const ready = submittedQuery.length >= 3;
  const resourceIds = onlyActiveLayers ? Array.from(new Set(activeLayers.filter((l) => l.visible).map((l) => l.resourceId))) : null;
  const search = useKeywordSearch(submittedQuery, resourceIds, PAGE_SIZE, (page - 1) * PAGE_SIZE, ready);

  const total = search.data?.total ?? 0;
  const results = ready ? search.data?.results ?? [] : [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <Stack gap="sm" p="sm">
      <TextInput
        label="Pesquisa palavra-chave" placeholder="Informe um valor exato" size="xs"
        value={query} onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { setSubmittedQuery(query.trim()); setPage(1); } }}
        rightSectionPointerEvents="all"
        rightSection={query ? <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Limpar" onClick={() => { setQuery(''); setSubmittedQuery(''); setPage(1); }}><CloseIcon /></ActionIcon> : null}
        rightSectionWidth={query ? undefined : 0}
      />

      <Group justify="space-between" align="flex-end" gap="sm">
        <Text size="xs" c="dimmed">Digite pelo menos 3 caracteres e clique na lupa</Text>
        <ActionIcon variant="default" size="lg" aria-label="Pesquisar" disabled={query.trim().length < 3} onClick={() => { setSubmittedQuery(query.trim()); setPage(1); }}>
          {search.isFetching ? <Loader size="xs" /> : <SearchIcon />}
        </ActionIcon>
      </Group>

      {search.isFetching && <Text size="xs" c="dimmed">Buscando...</Text>}

      <Group justify="space-between" wrap="wrap" gap="sm">
        <Switch size="sm" label="Somente camadas ativas" checked={onlyActiveLayers} onChange={(e) => { setOnlyActiveLayers(e.currentTarget.checked); setPage(1); }} />
        <Switch size="sm" label="Resultados simplificados" checked={simplified} onChange={(e) => setSimplified(e.currentTarget.checked)} />
      </Group>

      {ready && <Text size="xs" c="dimmed">{total === 0 ? '0 resultado(s)' : `${rangeStart}-${rangeEnd} de ${total} resultado(s)`}</Text>}

      <Stack gap="xs">
        {ready && results.map((result, index) => (
          <ResultCard
            key={`${result.resourceId}-${index}`}
            result={simplified ? result : { ...result, matches: {} }}
            map={map}
            highlightLayerRef={highlightLayerRef}
            markerRef={markerRef}
          />
        ))}
      </Stack>

      {ready && totalPages > 1 && <Group justify="center"><Pagination size="xs" total={totalPages} value={page} onChange={setPage} /></Group>}
    </Stack>
  );
}
