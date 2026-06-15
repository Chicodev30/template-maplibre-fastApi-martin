// Painel "Localizar Coordenada": converte coordenadas em WGS84, TM-POA (SIRGAS
// 2000 / Porto Alegre TM) ou SIRGAS 2000 geográfico para WGS84 e centraliza o
// mapa no ponto informado.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ActionIcon, Button, Group, SegmentedControl, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { COORDINATE_SYSTEMS, toWgs84, type CoordinateSystemId } from '../../map/utils/coordinateSystems';
import { SwapIcon } from './icons';

export function LocateCoordinatePanel({ map }: { map: maplibregl.Map | null }) {
  const [system, setSystem] = useState<CoordinateSystemId>('EPSG:4326');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [combined, setCombined] = useState('');
  const [swapped, setSwapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  const def = COORDINATE_SYSTEMS.find((item) => item.id === system) ?? COORDINATE_SYSTEMS[0];

  function handleCombinedChange(value: string) {
    setCombined(value);
    const parts = value.split(',').map((part) => part.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      if (swapped) {
        setY(parts[0]);
        setX(parts[1]);
      } else {
        setX(parts[0]);
        setY(parts[1]);
      }
    }
  }

  function handleLocate() {
    const xValue = Number(x.replace(',', '.'));
    const yValue = Number(y.replace(',', '.'));
    if (!map || !Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      setError('Informe coordenadas válidas.');
      return;
    }
    setError(null);
    const [lon, lat] = toWgs84(system, xValue, yValue);
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#228be6' }).setLngLat([lon, lat]).addTo(map);
    map.flyTo({ center: [lon, lat], zoom: 18, duration: 500 });
  }

  function handleClear() {
    setX('');
    setY('');
    setCombined('');
    setError(null);
    markerRef.current?.remove();
    markerRef.current = null;
  }

  return (
    <Stack gap="sm" p="sm">
      <SegmentedControl
        fullWidth
        size="xs"
        value={system}
        onChange={(value) => setSystem(value as CoordinateSystemId)}
        data={COORDINATE_SYSTEMS.map((item) => ({ value: item.id, label: item.label }))}
      />

      <TextInput
        label={def.xLabel}
        size="xs"
        placeholder={def.xPlaceholder}
        description={def.hint}
        value={x}
        onChange={(event) => setX(event.currentTarget.value)}
      />

      <TextInput
        label={def.yLabel}
        size="xs"
        placeholder={def.yPlaceholder}
        value={y}
        onChange={(event) => setY(event.currentTarget.value)}
      />

      <TextInput
        label={`Coordenadas (${swapped ? 'Y,X' : 'X,Y'})`}
        size="xs"
        placeholder={
          swapped
            ? `${def.yPlaceholder.replace('Ex: ', '')},${def.xPlaceholder.replace('Ex: ', '')}`
            : `${def.xPlaceholder.replace('Ex: ', '')},${def.yPlaceholder.replace('Ex: ', '')}`
        }
        description="Separe os valores por vírgula"
        value={combined}
        onChange={(event) => handleCombinedChange(event.currentTarget.value)}
        rightSection={
          <Tooltip label="Trocar ordem">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setSwapped((prev) => !prev)} aria-label="Trocar ordem">
              <SwapIcon />
            </ActionIcon>
          </Tooltip>
        }
      />

      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      <Group justify="flex-end" gap="xs">
        <Button variant="default" size="xs" onClick={handleClear}>
          Limpar
        </Button>
        <Button size="xs" onClick={handleLocate} disabled={!map}>
          Localizar
        </Button>
      </Group>
    </Stack>
  );
}
