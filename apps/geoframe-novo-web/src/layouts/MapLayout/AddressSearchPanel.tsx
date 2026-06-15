// Painel "Buscar endereco": consulta geocoders via middleware da API e
// centraliza o mapa no resultado escolhido.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Autocomplete, Button, Group, Loader, Select, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  providers,
  searchAddress,
  useCdlAddressSuggestions,
  type GeocodingProviderId,
  type GeocodingResult,
} from '../../catalog/api/geocoding.api';
import { SearchIcon } from './icons';

function fitResult(map: maplibregl.Map, result: GeocodingResult) {
  if (result.bbox) {
    map.fitBounds(
      [
        [result.bbox[0], result.bbox[1]],
        [result.bbox[2], result.bbox[3]],
      ],
      { padding: 56, maxZoom: 18, duration: 500 },
    );
    return;
  }
  map.flyTo({ center: [result.longitude, result.latitude], zoom: 18, duration: 500 });
}

function ResultRow({
  result,
  onClick,
}: {
  result: GeocodingResult;
  onClick: (result: GeocodingResult) => void;
}) {
  const provider = providers.find((item) => item.id === result.provider);

  return (
    <UnstyledButton
      onClick={() => onClick(result)}
      px="xs"
      py={8}
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6,
        display: 'block',
        width: '100%',
      }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        <SearchIcon />
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" fw={600} lineClamp={2}>
            {result.label}
          </Text>
          <Text size="10px" c="dimmed">
            {provider?.label ?? result.provider} · {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
          </Text>
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

export function AddressSearchPanel({ map }: { map: maplibregl.Map | null }) {
  const [provider, setProvider] = useState<GeocodingProviderId>('arcgis-procempa');
  const [query, setQuery] = useState('');
  const [cdlStreet, setCdlStreet] = useState('');
  const [cdlNumber, setCdlNumber] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [debouncedCdlStreet] = useDebouncedValue(cdlStreet, 250);
  const cdlSuggestions = useCdlAddressSuggestions(debouncedCdlStreet, provider === 'cdl-rest');

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  const isCdl = provider === 'cdl-rest';
  const ready = isCdl ? cdlStreet.trim().length >= 2 && cdlNumber.trim().length > 0 : query.trim().length >= 3;

  async function handleSearch() {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchAddress(provider, isCdl ? cdlStreet : query, isCdl ? cdlNumber : undefined);
      setResults(data);
      if (data.length === 0) {
        setError('Nenhum endereco encontrado.');
      }
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Erro ao buscar endereco.');
    } finally {
      setLoading(false);
    }
  }

  function handleResultClick(result: GeocodingResult) {
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#228be6' })
      .setLngLat([result.longitude, result.latitude])
      .setPopup(new maplibregl.Popup({ offset: 18 }).setText(result.label))
      .addTo(map);
    fitResult(map, result);
  }

  return (
    <Stack gap="sm" p="sm">
      <Select
        label="Fonte de Dados"
        size="xs"
        data={providers.map((item) => ({ value: item.id, label: item.label }))}
        value={provider}
        onChange={(value) => {
          if (!value) return;
          setProvider(value as GeocodingProviderId);
          setResults([]);
          setError(null);
        }}
        allowDeselect={false}
      />

      {isCdl ? (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <Autocomplete
            label="Logradouro"
            size="xs"
            placeholder="Ex.: Rua General João Manoel"
            value={cdlStreet}
            onChange={setCdlStreet}
            data={(cdlSuggestions.data ?? []).map((item) => item.label)}
            error={cdlSuggestions.isError ? 'Nao foi possivel carregar sugestoes do CDL.' : undefined}
            filter={({ options }) => options}
            limit={10}
            comboboxProps={{ withinPortal: true }}
            style={{ flex: 1 }}
          />
          <TextInput
            label="Numero"
            size="xs"
            placeholder="157"
            value={cdlNumber}
            onChange={(event) => setCdlNumber(event.currentTarget.value)}
            w={82}
          />
        </Group>
      ) : (
        <TextInput
          label="Endereco"
          size="xs"
          placeholder="Ex.: Rua General João Manoel 157"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSearch();
          }}
        />
      )}

      <Group justify="space-between" gap="xs">
        <Text size="xs" c="dimmed">
          {isCdl ? 'Selecione o logradouro e informe o numero.' : 'Digite o endereco em uma linha.'}
        </Text>
        <Button size="xs" onClick={handleSearch} disabled={!ready || loading || !map} leftSection={loading ? <Loader size="xs" /> : null}>
          Buscar
        </Button>
      </Group>

      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      <Stack gap="xs">
        {results.map((result, index) => (
          <ResultRow key={`${result.provider}-${result.longitude}-${result.latitude}-${index}`} result={result} onClick={handleResultClick} />
        ))}
      </Stack>
    </Stack>
  );
}
