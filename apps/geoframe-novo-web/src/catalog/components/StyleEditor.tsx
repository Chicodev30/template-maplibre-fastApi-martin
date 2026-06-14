// Editor de estilo básico de uma camada: cor, opacidade, contorno e rótulo.
// (Estilo avançado data-driven por campo é um 2º passo — ver plano.)
import {
  ColorInput,
  Divider,
  Group,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { FONT_OPTIONS, LABEL_POSITION_OPTIONS } from '../types/style.types';
import type { LayerStyle } from '../types/style.types';
import type { ResourceColumn } from '../types/resource.types';

export function StyleEditor({
  style,
  columns,
  onChange,
}: {
  style: LayerStyle;
  columns: ResourceColumn[];
  onChange: (patch: Partial<LayerStyle>) => void;
}) {
  const fieldOptions = columns.map((c) => ({ value: c.name, label: c.name }));
  const onlyLabel = style.opacity === 0 && style.outlineWidth === 0;

  return (
    <Stack gap="sm">
      <Switch
        label="Somente rótulo (ocultar geometria)"
        description="Esconde preenchimento e contorno, mantendo apenas o texto do rótulo"
        checked={onlyLabel}
        onChange={(e) =>
          e.currentTarget.checked
            ? onChange({ opacity: 0, outlineWidth: 0, label: { ...style.label, enabled: true } })
            : onChange({ opacity: 0.8, outlineWidth: 1 })
        }
      />

      {!onlyLabel && (
        <>
          <Divider />

          <ColorInput
            label="Cor"
            value={style.color}
            onChange={(color) => onChange({ color })}
            format="hex"
            withEyeDropper={false}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Opacidade — {Math.round(style.opacity * 100)}%
            </Text>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={style.opacity}
              onChange={(opacity) => onChange({ opacity })}
              label={(v) => `${Math.round(v * 100)}%`}
            />
          </div>

          <Group grow align="flex-end">
            <ColorInput
              label="Contorno"
              value={style.outlineColor ?? ''}
              onChange={(outlineColor) => onChange({ outlineColor })}
              format="hex"
              withEyeDropper={false}
              placeholder="sem contorno"
            />
            <NumberInput
              label="Espessura"
              value={style.outlineWidth}
              onChange={(v) => onChange({ outlineWidth: Number(v) || 0 })}
              min={0}
              max={10}
              step={0.5}
            />
          </Group>
        </>
      )}

      <Divider label="Rótulos" labelPosition="left" />

      <Switch
        label="Exibir rótulo na camada"
        checked={style.label.enabled}
        onChange={(e) =>
          onChange({ label: { ...style.label, enabled: e.currentTarget.checked } })
        }
      />

      {style.label.enabled && (
        <Stack gap="sm">
          <Select
            label="Campo do rótulo"
            placeholder="Selecione um campo"
            data={fieldOptions}
            value={style.label.field ?? null}
            onChange={(field) => onChange({ label: { ...style.label, field } })}
            searchable
          />
          <Group grow>
            <ColorInput
              label="Cor do texto"
              value={style.label.color}
              onChange={(color) => onChange({ label: { ...style.label, color } })}
              format="hex"
              withEyeDropper={false}
            />
            <ColorInput
              label="Halo"
              value={style.label.haloColor}
              onChange={(haloColor) => onChange({ label: { ...style.label, haloColor } })}
              format="hex"
              withEyeDropper={false}
            />
          </Group>
          <NumberInput
            label="Tamanho do texto"
            value={style.label.size}
            onChange={(v) => onChange({ label: { ...style.label, size: Number(v) || 12 } })}
            min={8}
            max={36}
          />
          <Group grow>
            <Select
              label="Posição do rótulo"
              data={LABEL_POSITION_OPTIONS}
              value={style.label.position}
              onChange={(position) =>
                position && onChange({ label: { ...style.label, position: position as LayerStyle['label']['position'] } })
              }
              allowDeselect={false}
            />
            <Select
              label="Família da fonte"
              data={FONT_OPTIONS}
              value={style.label.fontFamily}
              onChange={(fontFamily) =>
                fontFamily && onChange({ label: { ...style.label, fontFamily } })
              }
              allowDeselect={false}
            />
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
