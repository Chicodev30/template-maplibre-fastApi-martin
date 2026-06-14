// Layout principal do app de mapa: header (titulo + navegacao), mapa e
// painel lateral que abre/fecha de acordo com a navegacao escolhida.
import { useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { AppShell, Group, Paper, Title, UnstyledButton } from '@mantine/core';
import { env } from '../../app/env';
import { MapView } from '../../map/MapView';
import { useActiveLayers } from '../../map/groupLayers/useActiveLayers';
import { useResourceOverrides } from '../../catalog/api/resources.api';
import type { LayerNode } from '../../catalog/types/catalog.types';
import { LeftSidebar } from './LeftSidebar';
import { AttributeTablePanel } from './AttributeTablePanel';
import { LayerIcon } from './icons';

type PanelKey = 'camadas';

const PANEL_WIDTH = 280;

export function MapLayout() {
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [tableLayer, setTableLayer] = useState<LayerNode | null>(null);
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLayers = useActiveLayers(visibilityOverrides);
  const resourceOverrides = useResourceOverrides();

  function togglePanel(panel: PanelKey) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function toggleVisible(id: string, visible: boolean) {
    setVisibilityOverrides((current) => ({ ...current, [id]: visible }));
  }

  return (
    <AppShell header={{ height: 44 }}>
      <AppShell.Header withBorder>
        <Group h="100%" px="sm" gap="lg" wrap="nowrap">
          <Title order={5} fw={700} c="blue.7">
            {env.appTitle}
          </Title>
          <Group gap={4}>
            <UnstyledButton
              onClick={() => togglePanel('camadas')}
              px={8}
              py={4}
              fz="xs"
              fw={500}
              c={activePanel === 'camadas' ? 'blue.7' : 'gray.7'}
              bg={activePanel === 'camadas' ? 'blue.0' : 'transparent'}
              style={{ borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <LayerIcon />
              Camadas
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <MapView
          activeLayers={activeLayers}
          resourceOverrides={resourceOverrides.data}
          onMapReady={(map) => (mapRef.current = map)}
        />

        {activePanel === 'camadas' && (
          <Paper
            withBorder
            shadow="md"
            radius="md"
            style={{
              position: 'fixed',
              top: 'calc(var(--app-shell-header-offset, 0px) + 8px)',
              left: 8,
              width: PANEL_WIDTH,
              height: 'calc(100vh - var(--app-shell-header-offset, 0px) - 16px)',
              zIndex: 190,
              overflow: 'hidden',
            }}
          >
            <LeftSidebar
              onClose={() => setActivePanel(null)}
              visibilityOverrides={visibilityOverrides}
              onToggleVisible={toggleVisible}
              onOpenTable={(node) => {
                setTableLayer(node);
                setTableCollapsed(false);
              }}
            />
          </Paper>
        )}

        {tableLayer && (
          <Paper
            withBorder
            shadow="md"
            radius="md"
            style={{
              position: 'fixed',
              left: PANEL_WIDTH + 16,
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
              map={mapRef.current}
              collapsed={tableCollapsed}
              onToggleCollapse={() => setTableCollapsed((c) => !c)}
              onClose={() => setTableLayer(null)}
            />
          </Paper>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
