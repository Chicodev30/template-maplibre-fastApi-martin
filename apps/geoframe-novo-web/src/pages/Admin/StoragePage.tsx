// Administracao de buckets MinIO (Explorador de arquivos): criar buckets,
// definir extensoes/tamanho maximo aceitos e liberar acesso por papel ou usuario.
// Buckets nunca podem ser excluidos por aqui.
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  type BucketAccessGrant,
  type BucketAccessGrantInput,
  type BucketAdminSummary,
  useAdminBuckets,
  useCreateBucket,
  useUpdateBucketConfig,
  useUpdateBucketGrants,
} from '../../catalog/api/storage.api';
import { ApiError } from '../../app/http';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'contribuidor', label: 'Contribuidor' },
  { value: 'visualizador', label: 'Visualizador' },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

function CreateBucketForm() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateBucket();

  const handleCreate = () => {
    setError(null);
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
      onError: (err) => setError(errorMessage(err, 'Erro ao criar bucket.')),
    });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Title order={5}>Novo bucket</Title>
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Nome do bucket"
            placeholder="ex: geoframe-uploads"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 1 }}
            description="Letras minusculas, numeros, pontos e hifens (3-63 caracteres)."
          />
          <Button onClick={handleCreate} loading={create.isPending} disabled={name.trim().length < 3}>
            Criar bucket
          </Button>
        </Group>
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function GrantRow({
  grant,
  onChange,
  onRemove,
}: {
  grant: BucketAccessGrantInput;
  onChange: (next: BucketAccessGrantInput) => void;
  onRemove: () => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Select
          data={[
            { value: 'role', label: 'Papel' },
            { value: 'user', label: 'Usuário' },
          ]}
          value={grant.principalType}
          onChange={(value) =>
            onChange({ ...grant, principalType: (value as 'role' | 'user') ?? 'role', principalValue: '' })
          }
          size="xs"
          w={110}
        />
      </Table.Td>
      <Table.Td>
        {grant.principalType === 'role' ? (
          <Select
            data={ROLE_OPTIONS}
            value={grant.principalValue}
            onChange={(value) => onChange({ ...grant, principalValue: value ?? '' })}
            placeholder="Selecione o papel"
            size="xs"
          />
        ) : (
          <TextInput
            value={grant.principalValue}
            onChange={(e) => onChange({ ...grant, principalValue: e.currentTarget.value })}
            placeholder="username"
            size="xs"
          />
        )}
      </Table.Td>
      <Table.Td>
        <Checkbox
          checked={grant.canUpload}
          onChange={(e) => onChange({ ...grant, canUpload: e.currentTarget.checked })}
        />
      </Table.Td>
      <Table.Td>
        <Checkbox
          checked={grant.canDelete}
          onChange={(e) => onChange({ ...grant, canDelete: e.currentTarget.checked })}
        />
      </Table.Td>
      <Table.Td>
        <Button variant="subtle" color="red" size="xs" onClick={onRemove}>
          Remover
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

function toGrantInput(grant: BucketAccessGrant): BucketAccessGrantInput {
  return {
    principalType: grant.principalType,
    principalValue: grant.principalValue,
    canUpload: grant.canUpload,
    canDelete: grant.canDelete,
  };
}

function BucketCard({ bucket }: { bucket: BucketAdminSummary }) {
  const [extensions, setExtensions] = useState(bucket.config.allowedExtensions.join(', '));
  const [maxSize, setMaxSize] = useState<number>(bucket.config.maxFileSizeMb);
  const [grants, setGrants] = useState<BucketAccessGrantInput[]>(bucket.grants.map(toGrantInput));
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const updateConfig = useUpdateBucketConfig(bucket.bucketName);
  const updateGrants = useUpdateBucketGrants(bucket.bucketName);

  const handleSaveConfig = () => {
    setFeedback(null);
    const allowedExtensions = extensions
      .split(',')
      .map((ext) => ext.trim().toLowerCase())
      .filter(Boolean)
      .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
    updateConfig.mutate(
      { allowedExtensions, maxFileSizeMb: maxSize },
      {
        onSuccess: () => setFeedback({ type: 'success', message: 'Restrições salvas.' }),
        onError: (err) => setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao salvar restrições.') }),
      },
    );
  };

  const handleSaveGrants = () => {
    setFeedback(null);
    const valid = grants.filter((g) => g.principalValue.trim().length > 0);
    updateGrants.mutate(valid, {
      onSuccess: (saved) => {
        setGrants(saved.map(toGrantInput));
        setFeedback({ type: 'success', message: 'Liberações salvas.' });
      },
      onError: (err) => setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao salvar liberações.') }),
    });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>{bucket.bucketName}</Title>
          <Badge variant="light">{bucket.grants.length} liberação(ões)</Badge>
        </Group>

        <Group align="flex-end" gap="sm">
          <TextInput
            label="Extensões aceitas (separadas por vírgula)"
            value={extensions}
            onChange={(e) => setExtensions(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <NumberInput
            label="Limite por arquivo (MB)"
            value={maxSize}
            onChange={(value) => setMaxSize(typeof value === 'number' ? value : Number(value) || 1)}
            min={1}
            max={2048}
            w={160}
          />
          <Button variant="default" onClick={handleSaveConfig} loading={updateConfig.isPending}>
            Salvar restrições
          </Button>
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Liberação de acesso
          </Text>
          <Text size="xs" c="dimmed">
            Quem tem ao menos uma liberação pode visualizar e baixar os arquivos do bucket. Administradores
            têm acesso total automaticamente.
          </Text>
          <Table withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Papel / Usuário</Table.Th>
                <Table.Th>Enviar</Table.Th>
                <Table.Th>Excluir</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {grants.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="xs" c="dimmed" ta="center" py="xs">
                      Nenhuma liberação configurada. Apenas administradores têm acesso.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {grants.map((grant, index) => (
                <GrantRow
                  key={index}
                  grant={grant}
                  onChange={(next) => setGrants((current) => current.map((g, i) => (i === index ? next : g)))}
                  onRemove={() => setGrants((current) => current.filter((_, i) => i !== index))}
                />
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="xs"
              onClick={() =>
                setGrants((current) => [
                  ...current,
                  { principalType: 'role', principalValue: '', canUpload: false, canDelete: false },
                ])
              }
            >
              Adicionar liberação
            </Button>
            <Button size="xs" onClick={handleSaveGrants} loading={updateGrants.isPending}>
              Salvar liberações
            </Button>
          </Group>
        </Stack>

        {feedback && (
          <Alert color={feedback.type === 'error' ? 'red' : 'green'} variant="light" py={6}>
            <Text size="xs">{feedback.message}</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

export function StoragePage() {
  const { data: buckets, isLoading, isError } = useAdminBuckets();

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Armazenamento (MinIO)</Title>
        <Text c="dimmed" size="sm">
          Buckets do MinIO usados pelo Explorador de arquivos. É possível criar novos buckets, definir
          extensões/tamanho máximo aceitos e liberar o acesso por papel ou usuário. Buckets não podem ser
          excluídos por aqui.
        </Text>
      </div>

      <CreateBucketForm />

      {isError && (
        <Alert color="red" title="Falha ao carregar buckets">
          Apenas administradores podem gerenciar o armazenamento.
        </Alert>
      )}

      {isLoading ? (
        <Text c="dimmed" size="sm">
          Carregando...
        </Text>
      ) : (
        <Stack gap="sm">
          {buckets?.length === 0 && (
            <Text c="dimmed" size="sm">
              Nenhum bucket encontrado.
            </Text>
          )}
          {buckets?.map((bucket) => <BucketCard key={bucket.bucketName} bucket={bucket} />)}
        </Stack>
      )}
    </Stack>
  );
}
