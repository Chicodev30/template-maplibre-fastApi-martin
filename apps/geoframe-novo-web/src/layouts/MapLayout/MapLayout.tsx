// Layout principal do app de mapa: header (hamburger, logo, titulo e brasao),
// menu principal (drawer/flutuante) e painel "Camadas" que abre por cima do mapa.
import { useMemo, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { AppShell, Burger, Group, Image, Paper, Stack, Text } from '@mantine/core';
import { APP_TITLE, APP_SUBTITLE } from '../../app/constants';
import { useAuth } from '../../auth/useAuth';
import { MapView } from '../../map/MapView';
import { useActiveLayers } from '../../map/groupLayers/useActiveLayers';
import { useEffectiveResourceConfigs } from '../../catalog/api/effectiveConfig';
import { useResourceOverrides } from '../../catalog/api/resources.api';
import { getUserPrincipals } from '../../catalog/utils/fieldVisibility';
import type { AttributeTableLayer, LayerNode } from '../../catalog/types/catalog.types';
import type { SearchFilterRule } from '../../catalog/types/resource.types';
import { LeftSidebar } from './LeftSidebar';
import { LegendsPanel, type LegendOverride } from './LegendsPanel';
import { AttributeTablePanel } from './AttributeTablePanel';
import { MainMenu } from './MainMenu';
import { SearchPanel } from './SearchPanel';
import { AddressSearchPanel } from './AddressSearchPanel';
import { KeywordSearchPanel } from './KeywordSearchPanel';
import { LocateCoordinatePanel } from './LocateCoordinatePanel';
import { FileExplorerModal } from './FileExplorerModal';
import { FloatingPanel } from './FloatingPanel';
import { PrintPanel } from './PrintPanel';
import { BasemapPanel } from './BasemapPanel';
import { AddressIcon, BasemapIcon, KeywordIcon, LayerIcon, LegendIcon, LocateIcon, PrintIcon, SearchIcon } from './icons';
import { DEFAULT_BASEMAP_ID } from '../../map/maplibre/basemaps';

type View =
  | 'menu'
  | 'camadas'
  | 'legendas'
  | 'search'
  | 'buscarEndereco'
  | 'palavraChave'
  | 'localizarCoordenada'
  | 'imprimir'
  | 'mapaBase'
  | null;

export function MapLayout() {
  const [view, setView] = useState<View>(null);
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [legendOverrides, setLegendOverrides] = useState<Record<string, LegendOverride>>({});
  const [tableLayer, setTableLayer] = useState<LayerNode | AttributeTableLayer | null>(null);
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilterRule[] | null>(null);
  const [searchBbox, setSearchBbox] = useState<[number, number, number, number] | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const catalogActiveLayers = useActiveLayers(visibilityOverrides);
  const activeLayers = useMemo(
    () =>
      catalogActiveLayers.map((layer) => {
        const override = legendOverrides[layer.id];
        if (!override) return layer;
        return {
          ...layer,
          style: {
            ...layer.style,
            opacity: override.opacity ?? layer.style.opacity,
            label: {
              ...layer.style.label,
              enabled: override.labelVisible ?? layer.style.label.enabled,
            },
          },
        };
      }),
    [catalogActiveLayers, legendOverrides],
  );
  const resourceOverrides = useResourceOverrides();
  const fieldConfigsByLayerId = useEffectiveResourceConfigs(activeLayers);
  const { user } = useAuth();
  const userPrincipals = getUserPrincipals(user);

  function toggleVisible(id: string, visible: boolean) {
    setVisibilityOverrides((current) => ({ ...current, [id]: visible }));
  }

  function setLegendOpacity(layerId: string, opacity: number) {
    setLegendOverrides((current) => ({ ...current, [layerId]: { ...current[layerId], opacity } }));
  }

  function setLegendLabelVisible(layerId: string, labelVisible: boolean) {
    setLegendOverrides((current) => ({ ...current, [layerId]: { ...current[layerId], labelVisible } }));
  }

  return (
    <AppShell header={{ height: 56 }}>
      <AppShell.Header withBorder>
        <Group h="100%" px="sm" gap="sm" wrap="nowrap" justify="space-between">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger
              opened={view !== null}
              onClick={() => setView((v) => (v === null ? 'menu' : null))}
              size="sm"
              aria-label="Abrir menu"
            />
            <Image src="/logos/logo_app.png" alt="" h={32} w="auto" fit="contain" />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text fw={700} size="sm" c="blue.7" lineClamp={1}>
                {APP_TITLE}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1} visibleFrom="sm">
                {APP_SUBTITLE}
              </Text>
            </Stack>
          </Group>

          <Image src="/logos/brasao_prefeitura.png" alt="" h={36} w="auto" fit="contain" />
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <MapView
          activeLayers={activeLayers}
          resourceOverrides={resourceOverrides.data}
          fieldConfigsByLayerId={fieldConfigsByLayerId}
          userPrincipals={userPrincipals}
          basemapId={basemapId}
          onMapReady={setMap}
        />

        <MainMenu
          opened={view === 'menu'}
          onClose={() => setView(null)}
          onOpenCamadas={() => setView('camadas')}
          onOpenLegendas={() => setView('legendas')}
          onOpenBuscar={() => setView('search')}
          onOpenBuscarEndereco={() => setView('buscarEndereco')}
          onOpenPalavraChave={() => setView('palavraChave')}
          onOpenLocalizarCoordenada={() => setView('localizarCoordenada')}
          onOpenExploradorArquivos={() => {
            setView(null);
            setFileExplorerOpen(true);
          }}
          onOpenImprimir={() => setView('imprimir')}
          onOpenMapaBase={() => setView('mapaBase')}
        />

        <FileExplorerModal opened={fileExplorerOpen} onClose={() => setFileExplorerOpen(false)} />

        {view === 'camadas' && (
          <FloatingPanel
            title="Camadas"
            icon={<LayerIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
          >
            <LeftSidebar
              visibilityOverrides={visibilityOverrides}
              onToggleVisible={toggleVisible}
              onOpenTable={(node) => {
                setTableLayer(node);
                setTableCollapsed(false);
                setSearchFilters(null);
                setSearchBbox(null);
              }}
            />
          </FloatingPanel>
        )}

        {view === 'legendas' && (
          <FloatingPanel
            title="Legendas"
            icon={<LegendIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={320}
          >
            <LegendsPanel
              visibilityOverrides={visibilityOverrides}
              legendOverrides={legendOverrides}
              onOpacityChange={setLegendOpacity}
              onLabelVisibleChange={setLegendLabelVisible}
            />
          </FloatingPanel>
        )}

        {view === 'search' && (
          <FloatingPanel
            title="Buscar"
            icon={<SearchIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={340}
          >
            <SearchPanel
              activeLayers={activeLayers}
              fieldConfigsByLayerId={fieldConfigsByLayerId}
              map={map}
              onSearch={({ layer, filters, bbox }) => {
                setTableLayer(layer);
                setTableCollapsed(false);
                setSearchFilters(filters);
                setSearchBbox(bbox);
                setView(null);
              }}
            />
          </FloatingPanel>
        )}

        {view === 'buscarEndereco' && (
          <FloatingPanel
            title="Buscar endereço"
            icon={<AddressIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={340}
          >
            <AddressSearchPanel map={map} />
          </FloatingPanel>
        )}

        {view === 'palavraChave' && (
          <FloatingPanel
            title="Busca por palavra-chave"
            icon={<KeywordIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={340}
          >
            <KeywordSearchPanel activeLayers={activeLayers} map={map} />
          </FloatingPanel>
        )}

        {view === 'localizarCoordenada' && (
          <FloatingPanel
            title="Localizar Coordenada"
            icon={<LocateIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={300}
          >
            <LocateCoordinatePanel map={map} />
          </FloatingPanel>
        )}

        {view === 'imprimir' && (
          <FloatingPanel
            title="Imprimir mapa"
            icon={<PrintIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={300}
          >
            <PrintPanel map={map} activeLayers={activeLayers} />
          </FloatingPanel>
        )}

        {view === 'mapaBase' && (
          <FloatingPanel
            title="Mapas base"
            icon={<BasemapIcon />}
            onBack={() => setView('menu')}
            onClose={() => setView(null)}
            width={280}
          >
            <BasemapPanel basemapId={basemapId} onChange={setBasemapId} />
          </FloatingPanel>
        )}

        {tableLayer && (
          <Paper
            withBorder
            shadow="md"
            radius="md"
            style={{
              position: 'fixed',
              left: 8,
              right: 8,
              bottom: 8,
              height: tableCollapsed ? 44 : 320,
              zIndex: 190,
              overflow: 'hidden',
              transition: 'height 150ms ease',
            }}
          >
            <AttributeTablePanel
              layer={tableLayer}
              map={map}
              collapsed={tableCollapsed}
              onToggleCollapse={() => setTableCollapsed((c) => !c)}
              onClose={() => {
                setTableLayer(null);
                setSearchFilters(null);
                setSearchBbox(null);
              }}
              extraFilters={searchFilters}
              viewportBbox={searchBbox}
            />
          </Paper>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
