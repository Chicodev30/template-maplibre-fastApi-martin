// Painel "Mapas base": lista minimalista de mapas base disponiveis, com o
// item atualmente selecionado destacado.
import { Box, Stack, Text, UnstyledButton } from '@mantine/core';
import { BASEMAPS } from '../../map/basemaps';
import { CheckIcon } from './icons';

export function BasemapPanel({
  basemapId,
  onChange,
}: {
  basemapId: string;
  onChange: (id: string) => void;
}) {
  return (
    <Stack gap={4} p={8}>
      {BASEMAPS.map((basemap) => {
        const selected = basemap.id === basemapId;
        return (
          <UnstyledButton
            key={basemap.id}
            onClick={() => onChange(basemap.id)}
            px="sm"
            py={8}
            style={{
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              border: '1px solid var(--mantine-color-gray-3)',
              background: selected ? 'var(--mantine-color-blue-0)' : undefined,
            }}
          >
            <Text size="sm" fw={selected ? 600 : 400}>
              {basemap.label}
            </Text>
            {selected && (
              <Box c="blue.7" style={{ display: 'flex' }} aria-hidden="true">
                <CheckIcon />
              </Box>
            )}
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
