// Painel "Buscar": busca simples por feicoes em camadas que tem pelo menos
// um campo marcado como "Pesq." no admin. Monta um conjunto de filtros
// avancados (SearchFilterRule[]) e delega o resultado a tabela de atributos.
import { useEffect, useState } from 'react';
import type Map from 'ol/Map';
import { Autocomplete, Button, Checkbox, Group, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useResourceColumns, useResourceFieldValues } from '../../catalog/api/resources.api';
import type { EffectiveResourceConfig } from '../../catalog/api/effectiveConfig';
import type { ActiveLayer } from '../../map/groupLayers/useActiveLayers';
import type { AttributeTableLayer } from '../../catalog/types/catalog.types';
import type { SearchFilterRule } from '../../catalog/types/resource.types';
import { fieldLabel } from '../../catalog/utils/fieldVisibility';
import {
  operatorNeedsListValue,
  operatorNeedsSecondValue,
  operatorNeedsValue,
  searchOperatorOptions,
} from '../../catalog/utils/searchOperators';

interface FieldState {
  operator: string;
  value: string;
  value2: string;
  values: string;
}

// Input com sugestoes (valores distintos da coluna) para preencher o valor
// de busca de um campo.
function ValueAutocomplete({
  sourceId,
  column,
  value,
  placeholder,
  onChange,
}: {
  sourceId: string;
  column: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [debouncedValue] = useDebouncedValue(value, 250);
  const ready = debouncedValue.trim().length >= 2;
  const suggestions = useResourceFieldValues(sourceId, column, debouncedValue, ready);

  return (
    <Autocomplete
      size="xs"
      style={{ flex: 1 }}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data={ready ? suggestions.data ?? [] : []}
      limit={20}
      comboboxProps={{ withinPortal: true }}
      filter={({ options }) => options}
    />
  );
}

export interface SearchResult {
  layer: AttributeTableLayer;
  filters: SearchFilterRule[];
  bbox: [number, number, number, number] | null;
}

export function SearchPanel({
  activeLayers,
  fieldConfigsByLayerId,
  map,
  onSearch,
}: {
  activeLayers: ActiveLayer[];
  fieldConfigsByLayerId: Record<string, EffectiveResourceConfig>;
  map: Map | null;
  onSearch: (result: SearchResult) => void;
}) {
  const searchableLayers = activeLayers.filter((layer) =>
    Object.values(fieldConfigsByLayerId[layer.id]?.fields ?? {}).some((f) => f.searchable),
  );

  const [layerId, setLayerId] = useState<string | null>(null);
  const [onlyViewport, setOnlyViewport] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldState>>({});

  const selectedLayer = searchableLayers.find((l) => l.id === layerId) ?? null;
  const tableName = selectedLayer
    ? selectedLayer.resourceId.split('.').slice(1).join('.') || selectedLayer.resourceId
    : null;
  const columns = useResourceColumns(tableName);
  const columnTypes = Object.fromEntries((columns.data ?? []).map((c) => [c.name, c.data_type]));

  const fields = selectedLayer ? fieldConfigsByLayerId[selectedLayer.id]?.fields ?? {} : {};
  const searchableFields = Object.entries(fields).filter(([, cfg]) => cfg.searchable);

  useEffect(() => {
    setFieldValues({});
  }, [layerId]);

  function updateField(name: string, patch: Partial<FieldState>) {
    setFieldValues((current) => ({
      ...current,
      [name]: {
        operator: current[name]?.operator ?? 'contains',
        value: current[name]?.value ?? '',
        value2: current[name]?.value2 ?? '',
        values: current[name]?.values ?? '',
        ...patch,
      },
    }));
  }

  function handleClear() {
    setFieldValues({});
    setOnlyViewport(false);
  }

  function handleSearch() {
    if (!selectedLayer) return;

    const filters: SearchFilterRule[] = [];
    for (const [name] of searchableFields) {
      const fv = fieldValues[name];
      if (!fv) continue;
      const { operator } = fv;
      if (!operatorNeedsValue(operator)) {
        filters.push({ column: name, operator });
        continue;
      }
      if (operatorNeedsListValue(operator)) {
        const values = fv.values
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        if (values.length === 0) continue;
        filters.push({ column: name, operator, values });
        continue;
      }
      if (operatorNeedsSecondValue(operator)) {
        if (!fv.value.trim() || !fv.value2.trim()) continue;
        filters.push({ column: name, operator, value: fv.value.trim(), value2: fv.value2.trim() });
        continue;
      }
      if (!fv.value.trim()) continue;
      filters.push({ column: name, operator, value: fv.value.trim() });
    }

    let bbox: [number, number, number, number] | null = null;
    if (onlyViewport && map) {
      const b = map.getBounds();
      bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    }

    onSearch({
      layer: {
        resourceId: selectedLayer.resourceId,
        label: selectedLayer.label,
        configProfileId: selectedLayer.configProfileId,
      },
      filters,
      bbox,
    });
  }

  return (
    <Stack gap="sm" p="sm">
      <Select
        label="Tipo de busca"
        size="xs"
        value="simples"
        data={[{ value: 'simples', label: 'Simples' }]}
        readOnly
      />

      <Select
        label="Camada"
        size="xs"
        placeholder="Selecione uma camada"
        clearable
        searchable
        data={searchableLayers.map((l) => ({ value: l.id, label: l.label }))}
        value={layerId}
        onChange={setLayerId}
      />

      {selectedLayer && (
        <>
          <Checkbox
            size="xs"
            label="Pesquisar somente na visualização atual"
            checked={onlyViewport}
            onChange={(e) => setOnlyViewport(e.currentTarget.checked)}
          />

          <ScrollArea.Autosize mah={320} type="auto" scrollbarSize={8} offsetScrollbars>
            <Stack gap="sm" pr={2}>
              {searchableFields.length === 0 ? (
                <Text size="xs" c="dimmed">
                  Esta camada não tem campos marcados para pesquisa.
                </Text>
              ) : (
                searchableFields.map(([name]) => {
                  const dataType = columnTypes[name];
                  const fv = fieldValues[name];
                  const operator = fv?.operator ?? 'contains';
                  return (
                    <Stack key={name} gap={4}>
                      <Text size="xs" fw={600}>
                        {fieldLabel(fields, name)}
                        {dataType ? ` (${dataType})` : ''}
                      </Text>
                      <Group gap="xs" wrap="nowrap">
                        <Select
                          size="xs"
                          w={108}
                          data={searchOperatorOptions(dataType)}
                          value={operator}
                          onChange={(value) => updateField(name, { operator: value ?? 'contains' })}
                          allowDeselect={false}
                          comboboxProps={{ width: 160, position: 'bottom-start' }}
                        />
                        {operatorNeedsValue(operator) &&
                          (operatorNeedsListValue(operator) ? (
                            <TextInput
                              size="xs"
                              style={{ flex: 1 }}
                              placeholder="valores separados por vírgula"
                              value={fv?.values ?? ''}
                              onChange={(e) => updateField(name, { values: e.currentTarget.value })}
                            />
                          ) : operatorNeedsSecondValue(operator) ? (
                            <Group gap={4} wrap="nowrap" style={{ flex: 1 }}>
                              <ValueAutocomplete
                                sourceId={selectedLayer!.resourceId}
                                column={name}
                                placeholder="de"
                                value={fv?.value ?? ''}
                                onChange={(value) => updateField(name, { value })}
                              />
                              <ValueAutocomplete
                                sourceId={selectedLayer!.resourceId}
                                column={name}
                                placeholder="até"
                                value={fv?.value2 ?? ''}
                                onChange={(value) => updateField(name, { value2: value })}
                              />
                            </Group>
                          ) : (
                            <ValueAutocomplete
                              sourceId={selectedLayer!.resourceId}
                              column={name}
                              placeholder="valor"
                              value={fv?.value ?? ''}
                              onChange={(value) => updateField(name, { value })}
                            />
                          ))}
                      </Group>
                    </Stack>
                  );
                })
              )}
            </Stack>
          </ScrollArea.Autosize>

          <Group gap="xs" justify="flex-end">
            <Button size="xs" variant="default" onClick={handleClear}>
              Limpar
            </Button>
            <Button size="xs" onClick={handleSearch} disabled={searchableFields.length === 0}>
              Pesquisar
            </Button>
          </Group>
        </>
      )}

      {searchableLayers.length === 0 && (
        <Text size="xs" c="dimmed">
          Nenhuma camada ativa tem campos marcados para pesquisa.
        </Text>
      )}
    </Stack>
  );
}
