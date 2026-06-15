// Gestao de resources.
// Galeria de recursos: casa o catalogo MVT do Martin com os metadados do banco.
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { env } from '../../app/env';
import {
  useCatalogResources,
  useResourceMetadata,
  useResourceOverrides,
} from '../../catalog/api/resources.api';
import { ResourceCard } from '../../catalog/components/ResourceCard';

export function ResourcesPage() {
  const catalog = useCatalogResources();
  const metadata = useResourceMetadata();
  const overrides = useResourceOverrides();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const resources = useMemo(() => {
    const list = catalog.data ?? [];
    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          (r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
        )
      : list;
  }, [catalog.data, search]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>Recursos</Title>
          <Text c="dimmed" size="sm">
            {catalog.data?.length ?? 0} camadas publicadas no Martin
          </Text>
        </div>
        <Group gap="sm">
          <TextInput
            placeholder="Filtrar..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={240}
          />
          <Button onClick={() => navigate('/admin/catalog/resources/new')}>
            Adicionar Recurso
          </Button>
        </Group>
      </Group>

      {catalog.isError && (
        <Alert color="red" title="Falha ao carregar o catalogo">
          A API nao respondeu (ou o Martin esta fora). A API e o gateway dos tiles.
          Verifique se ela esta no ar em{' '}
          <Text span ff="monospace">
            {env.apiBaseUrl}
          </Text>
          .
        </Alert>
      )}
      {metadata.isError && (
        <Alert color="yellow" title="Metadados do banco indisponiveis">
          A galeria funciona, mas sem contagem de feicoes e tipos. Verifique a API FastAPI.
        </Alert>
      )}

      {catalog.isLoading ? (
        <Center h={300}>
          <Loader />
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              metadata={metadata.data?.[r.id]}
              bboxOverride={overrides.data?.[r.id]?.bboxOverride}
              excludedFeatures={overrides.data?.[r.id]?.excludedFeatures}
              onClick={() =>
                navigate(`/admin/catalog/resources/${encodeURIComponent(r.id)}`)
              }
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
