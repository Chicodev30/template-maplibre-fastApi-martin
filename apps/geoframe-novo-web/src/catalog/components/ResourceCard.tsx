// Card de um resource na galeria.
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import type {
  CatalogResource,
  ExcludedFeature,
  ResourceMetadata,
} from '../types/resource.types';
import { ResourceThumbnail } from './ResourceThumbnail';

interface Props {
  resource: CatalogResource;
  metadata?: ResourceMetadata;
  bboxOverride?: [number, number, number, number] | null;
  excludedFeatures?: ExcludedFeature[];
  onClick: () => void;
}

export function ResourceCard({
  resource,
  metadata,
  bboxOverride,
  excludedFeatures,
  onClick,
}: Props) {
  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <Card.Section>
        <ResourceThumbnail
          sourceId={resource.id}
          boundsOverride={bboxOverride}
          excludedFeatures={excludedFeatures}
        />
      </Card.Section>

      <Stack gap={6} mt="sm">
        <Text fw={600} size="sm" truncate title={resource.title}>
          {resource.title}
        </Text>
        <Text size="xs" c="dimmed" truncate title={resource.id}>
          {resource.id}
        </Text>
        <Group gap={6}>
          {metadata?.geometry_type && (
            <Badge size="sm" variant="light">
              {metadata.geometry_type}
            </Badge>
          )}
          <Badge size="sm" variant="light" color="gray">
            {metadata?.feature_count != null
              ? `~${metadata.feature_count.toLocaleString('pt-BR')}`
              : '—'}{' '}
            feições
          </Badge>
        </Group>
      </Stack>
    </Card>
  );
}
