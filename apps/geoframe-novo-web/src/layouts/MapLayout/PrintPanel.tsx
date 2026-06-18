// Painel "Imprimir": gera um PDF do mapa atual (titulo, DPI, orientacao e
// tamanho de pagina configuraveis), com opcao de incluir uma legenda das
// camadas visiveis na view atual.
import { useEffect, useState } from 'react';
import type Map from 'ol/Map';
import { Alert, Button, Checkbox, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useResourceMetadata } from '../../catalog/api/resources.api';
import { geometryKind } from './LegendsPanel';
import { PrintIcon } from './icons';
import type { ActiveLayer } from '../../map/groupLayers/useActiveLayers';
import { printMap, PRINT_DPI_OPTIONS, PRINT_PAGE_SIZES, type PrintLegendItem, type PrintOrientation } from '../../map/printMap';

const PAPER_SIZE_OPTIONS = Object.keys(PRINT_PAGE_SIZES).map((value) => ({ value, label: value }));
const DPI_LABELS: Record<number, string> = { 96: '96 DPI', 150: '150 DPI (Padrão)', 300: '300 DPI (Alta qualidade)' };

export function PrintPanel({ map, activeLayers }: { map: Map | null; activeLayers: ActiveLayer[] }) {
  const [title, setTitle] = useState('Mapa');
  const [dpi, setDpi] = useState(150);
  const [orientation, setOrientation] = useState<PrintOrientation>('landscape');
  const [paperSize, setPaperSize] = useState<keyof typeof PRINT_PAGE_SIZES>('A4');
  const [includeLegends, setIncludeLegends] = useState(true);
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const [legendsForModal, setLegendsForModal] = useState<PrintLegendItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadata = useResourceMetadata();

  const getVisibleLegends = (): PrintLegendItem[] => {
    const zoom = map?.getView().getZoom() ?? null;

    return activeLayers
      .filter((layer) => {
        if (!layer.visible) return false;
        if (zoom != null) {
          const minZoom = layer.minZoom ?? 0;
          const maxZoom = layer.maxZoom ?? 24;
          if (zoom < minZoom || zoom >= maxZoom) return false;
        }
        return true;
      })
      .map((layer) => ({
        id: layer.id,
        label: layer.label,
        color: layer.style.color,
        outlineColor: layer.style.outlineColor || layer.style.color,
        outlineWidth: layer.style.outlineWidth,
        geometryKind: geometryKind(metadata.data?.[layer.resourceId]?.geometry_type),
      }));
  };

  const runPrint = async (legends: PrintLegendItem[]) => {
    if (!map) return;
    setError(null);
    setGenerating(true);
    try {
      await printMap(map, { title, dpi, paperSize, orientation, legends, fileName: title.trim() || 'mapa' });
    } catch {
      setError('Erro ao gerar o PDF do mapa. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintClick = () => {
    if (includeLegends) {
      const legends = getVisibleLegends();
      if (legends.length > 0) {
        setLegendsForModal(legends);
        setLegendModalOpen(true);
        return;
      }
    }
    void runPrint([]);
  };

  return (
    <Stack gap="sm" p="sm">
      <TextInput label="Título do Mapa" value={title} onChange={(e) => setTitle(e.currentTarget.value)} size="sm" />

      <Select
        label="Resolução (DPI)"
        data={PRINT_DPI_OPTIONS.map((value) => ({ value: String(value), label: DPI_LABELS[value] ?? `${value} DPI` }))}
        value={String(dpi)}
        onChange={(value) => value && setDpi(Number(value))}
        allowDeselect={false}
        size="sm"
      />
      <Text size="xs" c="dimmed" mt={-6}>
        Maior DPI = melhor qualidade e arquivo maior.
      </Text>

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Orientação
        </Text>
        <SegmentedControl
          fullWidth
          size="sm"
          value={orientation}
          onChange={(value) => setOrientation(value as PrintOrientation)}
          data={[
            { value: 'portrait', label: 'Retrato' },
            { value: 'landscape', label: 'Paisagem' },
          ]}
        />
      </Stack>

      <Select
        label="Tamanho do Papel"
        data={PAPER_SIZE_OPTIONS}
        value={paperSize}
        onChange={(value) => value && setPaperSize(value as keyof typeof PRINT_PAGE_SIZES)}
        allowDeselect={false}
        size="sm"
      />

      <Checkbox
        label="Incluir legendas visíveis no PDF"
        checked={includeLegends}
        onChange={(e) => setIncludeLegends(e.currentTarget.checked)}
      />

      {error && (
        <Alert color="red" variant="light" py={6}>
          <Text size="xs">{error}</Text>
        </Alert>
      )}

      <Button onClick={handlePrintClick} loading={generating} disabled={!map} leftSection={<PrintIcon />} fullWidth>
        Imprimir
      </Button>

      <PrintLegendsModal
        opened={legendModalOpen}
        legends={legendsForModal}
        onClose={() => setLegendModalOpen(false)}
        onConfirm={(selected) => {
          setLegendModalOpen(false);
          void runPrint(selected);
        }}
      />
    </Stack>
  );
}

function PrintLegendsModal({
  opened,
  legends,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  legends: PrintLegendItem[];
  onClose: () => void;
  onConfirm: (selected: PrintLegendItem[]) => void;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (opened) setExcluded(new Set());
  }, [opened]);

  const toggle = (id: string, checked: boolean) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Legendas no PDF" size="sm" styles={{ title: { fontWeight: 600, fontSize: 14 } }}>
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Selecione as legendas das camadas visíveis que devem aparecer no PDF.
        </Text>
        <Stack gap={6}>
          {legends.map((legend) => (
            <Checkbox
              key={legend.id}
              label={legend.label}
              checked={!excluded.has(legend.id)}
              onChange={(e) => toggle(legend.id, e.currentTarget.checked)}
            />
          ))}
        </Stack>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="xs" onClick={() => onConfirm(legends.filter((legend) => !excluded.has(legend.id)))}>
            Imprimir
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
