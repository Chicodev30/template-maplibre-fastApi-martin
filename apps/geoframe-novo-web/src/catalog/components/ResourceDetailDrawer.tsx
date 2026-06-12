// Drawer de detalhe do resource: metadados + campos/tipos do banco.
// A edicao de campos/tipos (ALTER TABLE) sera habilitada num passo seguinte;
// por ora os campos sao exibidos em modo leitura.
import {
  Badge,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { CatalogResource, ResourceMetadata } from '../types/resource.types';
import { useResourceColumns } from '../api/resources.api';

interface Props {
  resource: CatalogResource | null;
  metadata?: ResourceMetadata;
  onClose: () => void;
}

export function ResourceDetailDrawer({ resource, metadata, onClose }: Props) {
  const { data: columns, isLoading } = useResourceColumns(resource?.tableName ?? null);

  return (
    <Drawer
      opened={!!resource}
      onClose={onClose}
      position="right"
      size="md"
      title={<Title order={4}>{resource?.title}</Title>}
    >
      {resource && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light">{metadata?.geometry_type ?? 'geometria'}</Badge>
            {metadata?.srid != null && <Badge variant="light">SRID {metadata.srid}</Badge>}
            <Badge variant="light" color="gray">
              {metadata?.feature_count != null
                ? `~${metadata.feature_count.toLocaleString('pt-BR')} feições`
                : 'contagem n/d'}
            </Badge>
          </Group>

          <Text size="sm" c="dimmed">
            {resource.id}
          </Text>

          <div>
            <Title order={6} mb="xs">
              Campos
            </Title>
            {isLoading ? (
              <Loader size="sm" />
            ) : (
              <ScrollArea h={400}>
                <Table stickyHeader striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Campo</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Nulo?</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {columns?.map((col) => (
                      <Table.Tr key={col.name}>
                        <Table.Td>{col.name}</Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {col.data_type}
                          </Text>
                        </Table.Td>
                        <Table.Td>{col.nullable ? 'sim' : 'não'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </Stack>
      )}
    </Drawer>
  );
}
