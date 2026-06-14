// Detalhe/configuracao de um recurso do catalogo.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type maplibregl from 'maplibre-gl';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useUsers } from '../../admin/users/users.api';
import {
  useCatalogResources,
  useResourceAttributes,
  useResourceColumns,
  useResourceConfig,
  useResourceMetadata,
  useSaveResourceConfig,
} from '../../catalog/api/resources.api';
import {
  ResourceThumbnail,
  type FeatureRef,
} from '../../catalog/components/ResourceThumbnail';
import type {
  CatalogResource,
  ExcludedFeature,
  ResourceColumn,
  ResourceConfig,
  ResourceFieldConfig,
  ResourceSecurityRule,
} from '../../catalog/types/resource.types';

type TransferOption = {
  value: string;
  label: string;
  description?: string;
};

type FeatureBounds = [number, number, number, number];
type FilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_null'
  | 'is_not_null';

const ROLE_OPTIONS: TransferOption[] = [
  { value: 'role:gfr-admin', label: 'Administrador', description: 'Papel gfr-admin' },
  { value: 'role:gfr-contribuidor', label: 'Contribuidor', description: 'Papel gfr-contribuidor' },
  { value: 'role:gfr-visualizador', label: 'Visualizador', description: 'Papel gfr-visualizador' },
];

const BASE_FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'contains', label: 'Contem' },
  { value: 'equals', label: 'Igual' },
  { value: 'starts_with', label: 'Comeca com' },
  { value: 'ends_with', label: 'Termina com' },
  { value: 'is_null', label: 'Nulo' },
  { value: 'is_not_null', label: 'Nao nulo' },
];

const COMPARISON_FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual' },
];

function supportsComparison(dataType: string | undefined) {
  if (!dataType) return false;
  const type = dataType.toLowerCase();
  return [
    'smallint',
    'integer',
    'bigint',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'date',
    'timestamp',
    'timestamp without time zone',
    'timestamp with time zone',
  ].includes(type);
}

function filterOperatorOptions(dataType: string | undefined) {
  return supportsComparison(dataType)
    ? [...BASE_FILTER_OPERATORS, ...COMPARISON_FILTER_OPERATORS]
    : BASE_FILTER_OPERATORS;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 5v14M8 5 5 8M8 5l3 3"
        stroke={direction === 'asc' ? 'currentColor' : '#adb5bd'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 19V5m0 14 3-3m-3 3-3-3"
        stroke={direction === 'desc' ? 'currentColor' : '#adb5bd'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function defaultFieldConfig(col: ResourceColumn): ResourceFieldConfig {
  return {
    label: col.name,
    searchable: false,
    showInTable: col.name !== 'geom',
    showInPopup: col.name !== 'geom',
  };
}

function buildConfig(
  resource: CatalogResource,
  columns: ResourceColumn[] | undefined,
  previous: ResourceConfig | null,
): ResourceConfig {
  const fields = Object.fromEntries(
    (columns ?? []).map((col) => [
      col.name,
      { ...defaultFieldConfig(col), ...(previous?.fields[col.name] ?? {}) },
    ]),
  );
  return {
    resourceId: resource.id,
    layerLabel: previous?.layerLabel ?? resource.title,
    fields,
    securityRules: previous?.securityRules ?? [],
    bboxOverride: previous?.bboxOverride ?? null,
    excludedFeatures: previous?.excludedFeatures ?? [],
  };
}

function formatNumber(value: number | null | undefined) {
  return value != null ? value.toLocaleString('pt-BR') : 'n/d';
}

function updateSet(values: string[], value: string, checked: boolean) {
  return checked
    ? Array.from(new Set([...values, value]))
    : values.filter((item) => item !== value);
}

function getRowFeature(row: Record<string, unknown>): FeatureRef | null {
  if (typeof row.ogc_fid === 'string' || typeof row.ogc_fid === 'number') {
    return { property: 'ogc_fid', value: row.ogc_fid };
  }
  if (typeof row.id === 'string' || typeof row.id === 'number') {
    return { property: 'id', value: row.id };
  }
  return null;
}

function getFeatureKey(feature: FeatureRef | null) {
  return feature ? `${feature.property}:${String(feature.value)}` : null;
}

function MiniTransferList({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: TransferOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((option) => !selected.includes(option.value));
  const chosen = options.filter((option) => selected.includes(option.value));

  function renderOption(option: TransferOption, checked: boolean) {
    return (
      <Checkbox
        key={option.value}
        checked={checked}
        label={
          <div>
            <Text size="sm">{option.label}</Text>
            {option.description && (
              <Text size="xs" c="dimmed">
                {option.description}
              </Text>
            )}
          </div>
        }
        onChange={(event) => onChange(updateSet(selected, option.value, event.currentTarget.checked))}
      />
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          {selected.length}/{options.length}
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Card withBorder radius="sm" padding="sm">
          <Text size="xs" c="dimmed" mb="xs">
            Disponiveis
          </Text>
          <ScrollArea h={180}>
            <Stack gap="xs">
              {available.length ? (
                available.map((option) => renderOption(option, false))
              ) : (
                <Text size="sm" c="dimmed">
                  Nada disponivel.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Card>
        <Card withBorder radius="sm" padding="sm">
          <Text size="xs" c="dimmed" mb="xs">
            Selecionados
          </Text>
          <ScrollArea h={180}>
            <Stack gap="xs">
              {chosen.length ? (
                chosen.map((option) => renderOption(option, true))
              ) : (
                <Text size="sm" c="dimmed">
                  Nenhum selecionado.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export function ResourceDetailPage() {
  const { id } = useParams();
  const resourceId = id ? decodeURIComponent(id) : '';
  const catalog = useCatalogResources();
  const metadata = useResourceMetadata();
  const users = useUsers();

  const resource = useMemo(
    () => catalog.data?.find((r) => r.id === resourceId) ?? null,
    [catalog.data, resourceId],
  );
  const meta = resource ? metadata.data?.[resource.id] : undefined;
  const columns = useResourceColumns(resource?.tableName ?? null);
  const savedConfig = useResourceConfig(resource?.id ?? null);
  const saveConfig = useSaveResourceConfig(resource?.id ?? '');
  const [config, setConfig] = useState<ResourceConfig | null>(null);
  const [attributesOpened, setAttributesOpened] = useState(false);
  const [attributeLimit, setAttributeLimit] = useState(50);
  const [attributeOffset, setAttributeOffset] = useState(0);
  const [attributeFilterColumn, setAttributeFilterColumn] = useState<string | null>(null);
  const [attributeFilterOperator, setAttributeFilterOperator] =
    useState<FilterOperator>('contains');
  const [attributeFilterValue, setAttributeFilterValue] = useState('');
  const [debouncedAttributeFilter] = useDebouncedValue(attributeFilterValue, 350);
  const [attributeSortColumn, setAttributeSortColumn] = useState<string | null>(null);
  const [attributeSortDirection, setAttributeSortDirection] = useState<'asc' | 'desc'>('asc');
  const [featureFocusBounds, setFeatureFocusBounds] = useState<FeatureBounds | null>(null);
  const [selectedFeaturesByKey, setSelectedFeaturesByKey] = useState<Record<string, FeatureRef>>(
    {},
  );
  const [previewMap, setPreviewMap] = useState<maplibregl.Map | null>(null);
  const attributes = useResourceAttributes(
    resource?.id ?? null,
    attributesOpened,
    attributeLimit,
    attributeOffset,
    attributeFilterColumn,
    attributeFilterOperator,
    debouncedAttributeFilter,
    attributeSortColumn,
    attributeSortDirection,
  );

  const fieldOptions = useMemo<TransferOption[]>(
    () =>
      (columns.data ?? []).map((col) => ({
        value: col.name,
        label: col.name,
        description: col.data_type,
      })),
    [columns.data],
  );

  const principalOptions = useMemo<TransferOption[]>(() => {
    const userOptions =
      users.data?.map((u) => ({
        value: `user:${u.username}`,
        label: u.full_name ?? u.username,
        description: u.email ? `Usuario - ${u.email}` : 'Usuario',
      })) ?? [];
    const groupOptions: TransferOption[] = [];
    return [...userOptions, ...groupOptions, ...ROLE_OPTIONS];
  }, [users.data]);

  const selectedFilterColumn = useMemo(
    () => columns.data?.find((col) => col.name === attributeFilterColumn),
    [attributeFilterColumn, columns.data],
  );
  const operatorOptions = useMemo(
    () => filterOperatorOptions(selectedFilterColumn?.data_type),
    [selectedFilterColumn?.data_type],
  );
  const filterNeedsValue =
    attributeFilterOperator !== 'is_null' && attributeFilterOperator !== 'is_not_null';
  const selectedFeatures = useMemo(
    () => Object.values(selectedFeaturesByKey),
    [selectedFeaturesByKey],
  );
  const currentPageFeatureKeys = useMemo(
    () =>
      (attributes.data?.rows ?? [])
        .map((row) => getFeatureKey(getRowFeature(row)))
        .filter((key): key is string => !!key),
    [attributes.data?.rows],
  );
  const currentPageSelectedCount = currentPageFeatureKeys.filter(
    (key) => selectedFeaturesByKey[key],
  ).length;

  useEffect(() => {
    if (!resource || !columns.data) return;
    setConfig(buildConfig(resource, columns.data, savedConfig.data ?? null));
  }, [resource, columns.data, savedConfig.data]);

  useEffect(() => {
    setAttributeOffset(0);
  }, [
    resource?.id,
    attributeLimit,
    attributeFilterColumn,
    attributeFilterOperator,
    debouncedAttributeFilter,
    attributeSortColumn,
    attributeSortDirection,
  ]);

  useEffect(() => {
    if (!attributeFilterColumn && columns.data?.length) {
      setAttributeFilterColumn(columns.data[0].name);
    }
  }, [attributeFilterColumn, columns.data]);

  useEffect(() => {
    if (!operatorOptions.some((option) => option.value === attributeFilterOperator)) {
      setAttributeFilterOperator('contains');
    }
  }, [attributeFilterOperator, operatorOptions]);

  useEffect(() => {
    setSelectedFeaturesByKey({});
  }, [resource?.id]);

  function updateField(fieldName: string, patch: Partial<ResourceFieldConfig>) {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: {
          ...current.fields,
          [fieldName]: { ...current.fields[fieldName], ...patch },
        },
      };
    });
  }

  function updateRule(ruleId: string, patch: Partial<ResourceSecurityRule>) {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        securityRules: current.securityRules.map((rule) =>
          rule.id === ruleId ? { ...rule, ...patch } : rule,
        ),
      };
    });
  }

  function addRestriction() {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        securityRules: [
          ...current.securityRules,
          {
            id: crypto.randomUUID(),
            type: 'hide_fields',
            fieldNames: [],
            principals: [],
          },
        ],
      };
    });
  }

  function removeRestriction(ruleId: string) {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        securityRules: current.securityRules.filter((rule) => rule.id !== ruleId),
      };
    });
  }

  function toggleAttributeSort(column: string) {
    if (attributeSortColumn !== column) {
      setAttributeSortColumn(column);
      setAttributeSortDirection('asc');
      return;
    }
    if (attributeSortDirection === 'asc') {
      setAttributeSortDirection('desc');
      return;
    }
    setAttributeSortColumn(null);
    setAttributeSortDirection('asc');
  }

  function toggleFeatureSelection(feature: FeatureRef | null, checked: boolean) {
    const key = getFeatureKey(feature);
    if (!key || !feature) return;
    setSelectedFeaturesByKey((current) => {
      if (checked) return { ...current, [key]: feature };
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleCurrentPageSelection(checked: boolean) {
    setSelectedFeaturesByKey((current) => {
      if (!attributes.data) return current;
      if (checked) {
        const next = { ...current };
        for (const row of attributes.data.rows) {
          const feature = getRowFeature(row);
          const key = getFeatureKey(feature);
          if (feature && key) next[key] = feature;
        }
        return next;
      }
      const next = { ...current };
      for (const key of currentPageFeatureKeys) {
        delete next[key];
      }
      return next;
    });
  }

  function handlePreviewFeatureClick(feature: FeatureRef) {
    const key = getFeatureKey(feature);
    if (!key) return;
    toggleFeatureSelection(feature, !selectedFeaturesByKey[key]);
  }

  function captureViewportBbox() {
    if (!previewMap) return;
    const bounds = previewMap.getBounds();
    setConfig((current) =>
      current
        ? {
            ...current,
            bboxOverride: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          }
        : current,
    );
  }

  function clearBboxOverride() {
    setConfig((current) => (current ? { ...current, bboxOverride: null } : current));
  }

  function excludeSelectedFeatures() {
    setConfig((current) => {
      if (!current) return current;
      const existing = new Set(
        current.excludedFeatures.map((f) => `${f.property}:${String(f.value)}`),
      );
      const additions = selectedFeatures
        .filter((f) => !existing.has(`${f.property}:${String(f.value)}`))
        .map((f) => ({ property: f.property, value: f.value as string | number }));
      if (additions.length === 0) return current;
      return { ...current, excludedFeatures: [...current.excludedFeatures, ...additions] };
    });
    setSelectedFeaturesByKey({});
  }

  function restoreExcludedFeature(feature: ExcludedFeature) {
    setConfig((current) =>
      current
        ? {
            ...current,
            excludedFeatures: current.excludedFeatures.filter(
              (f) => !(f.property === feature.property && f.value === feature.value),
            ),
          }
        : current,
    );
  }

  if (
    catalog.isLoading ||
    metadata.isLoading ||
    columns.isLoading ||
    savedConfig.isLoading ||
    users.isLoading
  ) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }

  if (!resource) {
    return <Text c="red">Recurso nao encontrado no catalogo.</Text>;
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/catalog/resources" size="sm">
        Voltar para recursos
      </Anchor>

      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>{config?.layerLabel || resource.title}</Title>
          <Text c="dimmed" size="sm">
            {resource.id}
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light">{meta?.geometry_type ?? 'geometria'}</Badge>
          {meta?.srid != null && <Badge variant="light">SRID {meta.srid}</Badge>}
          <Badge variant="light" color="gray">
            ~{formatNumber(meta?.feature_count)} feicoes
          </Badge>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            Preview da camada
          </Title>
          <ResourceThumbnail
            sourceId={resource.id}
            height={360}
            lazy={false}
            interactive
            focusBounds={featureFocusBounds}
            selectedFeatures={selectedFeatures}
            boundsOverride={config?.bboxOverride ?? null}
            excludedFeatures={config?.excludedFeatures ?? []}
            hideExcluded={false}
            onFeatureClick={handlePreviewFeatureClick}
            onMapReady={setPreviewMap}
          />
          <Text size="xs" c="dimmed" mt="xs">
            Clique numa feicao no preview para selecioná-la (mesma selecao da
            tabela de atributos, em verde). Feicoes excluidas do catalogo
            aparecem em vermelho.
          </Text>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            Metadados e apresentacao
          </Title>
          <Stack gap="sm">
            <TextInput
              label="Label da camada"
              value={config?.layerLabel ?? ''}
              onChange={(e) =>
                setConfig((current) =>
                  current ? { ...current, layerLabel: e.currentTarget.value } : current,
                )
              }
            />
            <SimpleGrid cols={2} spacing="sm">
              <Text size="sm">
                <Text span fw={600}>Schema:</Text> {resource.schemaName}
              </Text>
              <Text size="sm">
                <Text span fw={600}>Tabela:</Text> {resource.tableName}
              </Text>
              <Text size="sm">
                <Text span fw={600}>Geometria:</Text> {resource.geometryColumn}
              </Text>
              <Text size="sm">
                <Text span fw={600}>Feicoes:</Text> {formatNumber(meta?.feature_count)}
              </Text>
            </SimpleGrid>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Esta configuracao define como o app vai consumir a camada no mapa,
                tabela, pesquisa, popup e seguranca.
              </Text>
              <Button
                loading={saveConfig.isPending}
                onClick={() => {
                  if (!config) return;
                  saveConfig.mutate(config);
                }}
              >
                Salvar configuracao
              </Button>
            </Group>
            {saveConfig.isSuccess && (
              <Text size="sm" c="green">
                Configuracao salva na API para este recurso.
              </Text>
            )}
            {saveConfig.isError && (
              <Text size="sm" c="red">
                Falha ao salvar configuracao.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="xs">
          Área de exibição e feições excluídas do catálogo
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          Util quando alguma feicao da tabela tem geometria mal georreferenciada
          e distorce o enquadramento (bbox) da camada. Nada e alterado na tabela
          de origem - essas escolhas valem so para este catalogo (mapa, miniaturas
          e tabela de atributos do app).
        </Text>
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Área de exibição (bbox)
            </Text>
            <Text size="sm" c="dimmed">
              {config?.bboxOverride
                ? `Override ativo: [${config.bboxOverride.map((v) => v.toFixed(4)).join(', ')}]`
                : 'Sem override - usa o bbox calculado pelo Martin (extent de toda a tabela).'}
            </Text>
            <Group gap="sm">
              <Button size="xs" variant="default" disabled={!previewMap} onClick={captureViewportBbox}>
                Usar área visível do preview
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                disabled={!config?.bboxOverride}
                onClick={clearBboxOverride}
              >
                Remover override
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Navegue/zoom no preview acima até o enquadramento desejado (ex.:
              Porto Alegre) e clique em "Usar área visível".
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Feições excluídas do catálogo
            </Text>
            <Group gap="sm">
              <Button
                size="xs"
                variant="default"
                disabled={selectedFeatures.length === 0}
                onClick={excludeSelectedFeatures}
              >
                Excluir selecionadas ({selectedFeatures.length})
              </Button>
              <Text size="xs" c="dimmed">
                Selecione na tabela de atributos ou clique na feicao no preview.
              </Text>
            </Group>
            {config?.excludedFeatures.length ? (
              <Group gap="xs">
                {config.excludedFeatures.map((feature) => (
                  <Badge
                    key={`${feature.property}:${feature.value}`}
                    variant="light"
                    color="red"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        color="red"
                        aria-label="Restaurar feicao"
                        onClick={() => restoreExcludedFeature(feature)}
                      >
                        ×
                      </ActionIcon>
                    }
                  >
                    {feature.property}: {String(feature.value)}
                  </Badge>
                ))}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Nenhuma feicao excluida.
              </Text>
            )}
          </Stack>
        </SimpleGrid>
      </Card>

      <Card withBorder radius="md" padding={0}>
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ cursor: 'pointer' }}
          onClick={() => setAttributesOpened((opened) => !opened)}
        >
          <Group gap="sm">
            <Text fw={600}>Tabela de atributos</Text>
            <Text size="sm" c="dimmed">
              dados consultados diretamente do PostgreSQL via API
            </Text>
          </Group>
          <Button size="xs" variant="subtle">
            {attributesOpened ? 'Fechar' : 'Abrir'}
          </Button>
        </Group>

        <Collapse expanded={attributesOpened}>
          <Divider />
          <Stack gap="sm" p="md">
            {attributes.isLoading && (
              <Center h={160}>
                <Loader />
              </Center>
            )}
            {attributes.isError && (
              <Text c="red" size="sm">
                Falha ao carregar a tabela de atributos.
              </Text>
            )}
            {attributes.data && (
              <>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                  <Select
                    label="Filtrar campo"
                    data={attributes.data.columns.map((column) => ({
                      value: column,
                      label: config?.fields[column]?.label ?? column,
                    }))}
                    value={attributeFilterColumn}
                    onChange={setAttributeFilterColumn}
                    searchable
                  />
                  <Select
                    label="Operador"
                    data={operatorOptions}
                    value={attributeFilterOperator}
                    onChange={(value) =>
                      setAttributeFilterOperator((value as FilterOperator | null) ?? 'contains')
                    }
                  />
                  <TextInput
                    label="Buscar valor"
                    placeholder={filterNeedsValue ? 'Digite para filtrar...' : 'Nao precisa valor'}
                    value={attributeFilterValue}
                    disabled={!filterNeedsValue}
                    onChange={(event) => setAttributeFilterValue(event.currentTarget.value)}
                  />
                </SimpleGrid>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {attributes.data.rows.length
                      ? `Exibindo ${attributes.data.offset + 1}-${
                          attributes.data.offset + attributes.data.rows.length
                        }${
                          meta?.feature_count
                            ? ` de aproximadamente ${formatNumber(meta.feature_count)}`
                            : ''
                        }.`
                      : 'Nenhum registro encontrado para o filtro atual.'}
                  </Text>
                  <Group gap="sm">
                    <Select
                      size="xs"
                      w={140}
                      label="Registros"
                      value={String(attributeLimit)}
                      data={[
                        { value: '50', label: '50 por pagina' },
                        { value: '100', label: '100 por pagina' },
                        { value: '200', label: '200 por pagina' },
                      ]}
                      onChange={(value) => setAttributeLimit(Number(value ?? 50))}
                    />
                    <Button
                      size="xs"
                      variant="default"
                      disabled={attributeOffset === 0 || attributes.isFetching}
                      onClick={() =>
                        setAttributeOffset((current) => Math.max(0, current - attributeLimit))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      disabled={
                        attributes.data.rows.length < attributeLimit || attributes.isFetching
                      }
                      onClick={() => setAttributeOffset((current) => current + attributeLimit)}
                    >
                      Proxima
                    </Button>
                  </Group>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    A tabela usa paginacao para evitar carregar camadas grandes de uma vez.
                  </Text>
                  <Text size="xs" c="dimmed">
                    Geometria omitida nesta visualizacao.
                  </Text>
                </Group>
                <ScrollArea h={320}>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        background: 'white',
                        boxShadow: '0 1px 0 var(--mantine-color-gray-3)',
                      }}
                    >
                      <Table.Tr>
                        <Table.Th w={48}>
                          <Checkbox
                            aria-label="Selecionar feicoes da pagina atual"
                            checked={
                              currentPageFeatureKeys.length > 0 &&
                              currentPageSelectedCount === currentPageFeatureKeys.length
                            }
                            indeterminate={
                              currentPageSelectedCount > 0 &&
                              currentPageSelectedCount < currentPageFeatureKeys.length
                            }
                            onChange={(event) =>
                              toggleCurrentPageSelection(event.currentTarget.checked)
                            }
                          />
                        </Table.Th>
                        {attributes.data.columns.map((column) => (
                          <Table.Th key={column}>
                            <Group gap={6} wrap="nowrap">
                              <Text span fw={600} size="sm">
                                {config?.fields[column]?.label ?? column}
                              </Text>
                              <Tooltip
                                label={
                                  attributeSortColumn === column &&
                                  attributeSortDirection === 'asc'
                                    ? 'Ordenar decrescente'
                                    : attributeSortColumn === column
                                      ? 'Remover ordenacao'
                                      : 'Ordenar crescente'
                                }
                              >
                                <ActionIcon
                                  size="xs"
                                  variant={attributeSortColumn === column ? 'light' : 'subtle'}
                                  aria-label={`Ordenar por ${config?.fields[column]?.label ?? column}`}
                                  onClick={() => toggleAttributeSort(column)}
                                >
                                  <SortIcon
                                    direction={
                                      attributeSortColumn === column
                                        ? attributeSortDirection
                                        : null
                                    }
                                  />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Th>
                        ))}
                        <Table.Th ta="right">Zoom</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {attributes.data.rows.map((row, rowIndex) => (
                        (() => {
                          const feature = getRowFeature(row);
                          const featureKey = getFeatureKey(feature);
                          const selected = !!featureKey && !!selectedFeaturesByKey[featureKey];
                          return (
                            <Table.Tr
                              key={rowIndex}
                              style={{
                                backgroundColor: selected
                                  ? 'rgba(64, 192, 87, 0.18)'
                                  : undefined,
                              }}
                            >
                              <Table.Td>
                                <Checkbox
                                  aria-label="Selecionar feicao"
                                  checked={selected}
                                  disabled={!feature}
                                  onChange={(event) =>
                                    toggleFeatureSelection(feature, event.currentTarget.checked)
                                  }
                                />
                              </Table.Td>
                              {attributes.data.columns.map((column) => (
                                <Table.Td key={column}>
                                  <Text size="sm" lineClamp={2}>
                                    {row[column] == null ? '-' : String(row[column])}
                                  </Text>
                                </Table.Td>
                              ))}
                              <Table.Td ta="right">
                                <Tooltip label="Zoom na feicao no preview">
                                  <ActionIcon
                                    variant="subtle"
                                    aria-label="Zoom na feicao no preview"
                                    disabled={!row.__bbox}
                                    onClick={() => {
                                      if (!row.__bbox) return;
                                      setFeatureFocusBounds([...row.__bbox] as FeatureBounds);
                                    }}
                                  >
                                    <SearchIcon />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })()
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </Stack>
        </Collapse>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={5}>Campos</Title>
            <Text size="sm" c="dimmed">
              Escolha rotulos, campos pesquisaveis e campos exibidos em tabela/popup.
            </Text>
          </div>
          <Text size="sm" c="dimmed">
            Campos: {columns.data?.length ?? 0}
          </Text>
        </Group>

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Campo</Table.Th>
              <Table.Th>Rotulo</Table.Th>
              <Table.Th>Pesq.</Table.Th>
              <Table.Th>Tabela</Table.Th>
              <Table.Th>Popup</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {columns.data?.map((col) => {
              const field = config?.fields[col.name] ?? defaultFieldConfig(col);
              return (
                <Table.Tr key={col.name}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {col.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {col.data_type}
                      {col.nullable ? '' : ' / obrigatorio'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={field.label}
                      onChange={(e) => updateField(col.name, { label: e.currentTarget.value })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={field.searchable}
                      onChange={(e) =>
                        updateField(col.name, { searchable: e.currentTarget.checked })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={field.showInTable}
                      onChange={(e) =>
                        updateField(col.name, { showInTable: e.currentTarget.checked })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={field.showInPopup}
                      onChange={(e) =>
                        updateField(col.name, { showInPopup: e.currentTarget.checked })
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={5}>Seguranca</Title>
            <Text size="sm" c="dimmed">
              Configure restricoes de ocultacao de campos por usuarios, grupos ou papeis.
            </Text>
          </div>
          <Button onClick={addRestriction}>Adicionar restricao</Button>
        </Group>

        <Stack gap="md">
          {config?.securityRules.length === 0 && (
            <Text size="sm" c="dimmed">
              Nenhuma restricao configurada.
            </Text>
          )}
          {config?.securityRules.map((rule, index) => (
            <Card key={rule.id} withBorder radius="sm" padding="md">
              <Group justify="space-between" mb="sm">
                <div>
                  <Title order={6}>Restricao {index + 1}: ocultar campos</Title>
                  <Text size="xs" c="dimmed">
                    Selecione campos e quem tera esses campos ocultados.
                  </Text>
                </div>
                <Button color="red" variant="subtle" onClick={() => removeRestriction(rule.id)}>
                  Remover
                </Button>
              </Group>
              <Divider mb="md" />
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                <MiniTransferList
                  title="Campos"
                  options={fieldOptions}
                  selected={rule.fieldNames}
                  onChange={(fieldNames) => updateRule(rule.id, { fieldNames })}
                />
                <MiniTransferList
                  title="Usuarios / grupos / papeis"
                  options={principalOptions}
                  selected={rule.principals}
                  onChange={(principals) => updateRule(rule.id, { principals })}
                />
              </SimpleGrid>
            </Card>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
