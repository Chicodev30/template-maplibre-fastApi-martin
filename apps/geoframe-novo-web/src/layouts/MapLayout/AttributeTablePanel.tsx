// Painel inferior: tabela de atributos de uma camada ativa (mesma fonte de
// dados da "Tabela de atributos" do admin/catalog/resources), com ação de
// zoom por feição.
import { useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  ActionIcon,
  Button,
  Center,
  Collapse,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useResourceAttributes, useResourceColumns } from '../../catalog/api/resources.api';
import type { LayerNode } from '../../catalog/types/catalog.types';
import { ChevronIcon, CloseIcon, SearchIcon, SortIcon } from './icons';

type FeatureBounds = [number, number, number, number];

export function AttributeTablePanel({
  layer,
  map,
  collapsed,
  onToggleCollapse,
  onClose,
}: {
  layer: LayerNode;
  map: maplibregl.Map | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}) {
  const tableName = layer.resourceId.split('.').slice(1).join('.') || layer.resourceId;
  const columns = useResourceColumns(tableName);

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [debouncedFilterValue] = useDebouncedValue(filterValue, 350);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const attributes = useResourceAttributes(
    layer.resourceId,
    true,
    limit,
    offset,
    filterColumn,
    'contains',
    debouncedFilterValue,
    sortColumn,
    sortDirection,
  );

  useEffect(() => {
    setOffset(0);
  }, [layer.resourceId, limit, filterColumn, debouncedFilterValue, sortColumn, sortDirection]);

  useEffect(() => {
    setFilterColumn(null);
    setSortColumn(null);
    setSortDirection('asc');
    setFilterValue('');
    setOffset(0);
  }, [layer.resourceId]);

  function toggleSort(column: string) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }
    setSortColumn(null);
    setSortDirection('asc');
  }

  function zoomTo(bbox: FeatureBounds | undefined | null) {
    if (!map || !bbox) return;
    const [minX, minY, maxX, maxY] = bbox;
    if ([minX, minY, maxX, maxY].some((v) => !Number.isFinite(v))) return;
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

  return (
    <Stack gap={0} h="100%">
      <Group justify="space-between" px="sm" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group gap="sm">
          <Text fw={600} size="sm">
            {layer.label}
          </Text>
          <Text size="xs" c="dimmed">
            {layer.resourceId}
          </Text>
        </Group>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={collapsed ? 'Expandir tabela' : 'Recolher tabela'}
            onClick={onToggleCollapse}
          >
            <ChevronIcon open={!collapsed} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Fechar tabela" onClick={onClose}>
            <CloseIcon />
          </ActionIcon>
        </Group>
      </Group>

      <Collapse expanded={!collapsed} style={{ flex: 1, minHeight: 0 }}>
      <Stack gap="xs" p="sm" h="100%" style={{ overflow: 'hidden' }}>
        <Group gap="sm" align="flex-end">
          <Select
            label="Filtrar campo"
            size="xs"
            w={180}
            clearable
            data={(attributes.data?.columns ?? columns.data?.map((c) => c.name) ?? []).map((name) => ({
              value: name,
              label: name,
            }))}
            value={filterColumn}
            onChange={setFilterColumn}
            searchable
          />
          <TextInput
            label="Buscar (contém)"
            size="xs"
            w={220}
            placeholder="Digite para filtrar..."
            value={filterValue}
            disabled={!filterColumn}
            onChange={(e) => setFilterValue(e.currentTarget.value)}
          />
          <Select
            label="Registros"
            size="xs"
            w={130}
            value={String(limit)}
            data={[
              { value: '50', label: '50 por página' },
              { value: '100', label: '100 por página' },
              { value: '200', label: '200 por página' },
            ]}
            onChange={(value) => setLimit(Number(value ?? 50))}
          />
          <Text size="xs" c="dimmed" style={{ flex: 1 }} ta="right">
            {attributes.data?.rows.length
              ? `Exibindo ${offset + 1}-${offset + attributes.data.rows.length}`
              : attributes.isLoading
                ? 'Carregando...'
                : 'Nenhum registro encontrado.'}
          </Text>
          <Button
            size="xs"
            variant="default"
            disabled={offset === 0 || attributes.isFetching}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            Anterior
          </Button>
          <Button
            size="xs"
            variant="default"
            disabled={(attributes.data?.rows.length ?? 0) < limit || attributes.isFetching}
            onClick={() => setOffset((o) => o + limit)}
          >
            Próxima
          </Button>
        </Group>

        {attributes.isLoading ? (
          <Center h={160}>
            <Loader size="sm" />
          </Center>
        ) : attributes.isError ? (
          <Text c="red" size="sm">
            Falha ao carregar a tabela de atributos.
          </Text>
        ) : (
          <ScrollArea style={{ flex: 1 }}>
            <Table striped highlightOnHover withTableBorder stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {(attributes.data?.columns ?? []).map((column) => (
                    <Table.Th key={column}>
                      <Group gap={6} wrap="nowrap">
                        <Text span fw={600} size="sm">
                          {column}
                        </Text>
                        <Tooltip
                          label={
                            sortColumn === column && sortDirection === 'asc'
                              ? 'Ordenar decrescente'
                              : sortColumn === column
                                ? 'Remover ordenação'
                                : 'Ordenar crescente'
                          }
                        >
                          <ActionIcon
                            size="xs"
                            variant={sortColumn === column ? 'light' : 'subtle'}
                            aria-label={`Ordenar por ${column}`}
                            onClick={() => toggleSort(column)}
                          >
                            <SortIcon direction={sortColumn === column ? sortDirection : null} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Th>
                  ))}
                  <Table.Th ta="right">Zoom</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(attributes.data?.rows ?? []).map((row, rowIndex) => (
                  <Table.Tr key={rowIndex}>
                    {(attributes.data?.columns ?? []).map((column) => (
                      <Table.Td key={column}>
                        <Text size="sm" lineClamp={2}>
                          {row[column] == null ? '-' : String(row[column])}
                        </Text>
                      </Table.Td>
                    ))}
                    <Table.Td ta="right">
                      <Tooltip label="Zoom na feição no mapa">
                        <ActionIcon
                          variant="subtle"
                          aria-label="Zoom na feição no mapa"
                          disabled={!row.__bbox || !map}
                          onClick={() => zoomTo(row.__bbox as FeatureBounds | undefined)}
                        >
                          <SearchIcon />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Stack>
      </Collapse>
    </Stack>
  );
}
