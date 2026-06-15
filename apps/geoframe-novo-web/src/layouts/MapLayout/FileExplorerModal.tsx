// Modal "Explorador de arquivos": navega pelos buckets MinIO liberados para o usuário.
import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Box,
  Button,
  FileButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  getObjectDownloadUrl,
  OBJECTS_PAGE_SIZE,
  useAccessibleBuckets,
  useBucketObjects,
  useDeleteObject,
  useSearchObjects,
  useUploadObject,
} from '../../catalog/api/storage.api';
import { ApiError } from '../../app/http';
import type { StorageObject } from '../../catalog/api/storage.api';
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileImageIcon,
  FilePdfIcon,
  FileVideoIcon,
  FileZipIcon,
  GridViewIcon,
  ListViewIcon,
  TrashIcon,
  UploadIcon,
} from './icons';

type ViewMode = 'list' | 'grid';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function isPreviewable(name: string): boolean {
  const ext = getExtension(name);
  return ext === 'pdf' || IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext);
}

function PreviewContent({ obj, url }: { obj: StorageObject; url: string | null }) {
  const ext = getExtension(obj.name);

  if (!url) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (ext === 'pdf') {
    return <iframe src={url} title={obj.name} style={{ width: '100%', height: '75vh', border: 'none' }} />;
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return (
      <Group justify="center">
        <img src={url} alt={obj.name} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
      </Group>
    );
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return (
      <Group justify="center">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={url} controls style={{ maxWidth: '100%', maxHeight: '75vh' }} />
      </Group>
    );
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return (
      <Group justify="center" py="xl">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={url} controls style={{ width: '100%' }} />
      </Group>
    );
  }

  return null;
}

function PreviewModal({ obj, url, onClose }: { obj: StorageObject | null; url: string | null; onClose: () => void }) {
  return (
    <Modal
      opened={!!obj}
      onClose={onClose}
      title={obj?.name}
      size="xl"
      zIndex={1000}
      styles={{ title: { fontWeight: 600, fontSize: 14 }, content: { width: '90vw', maxWidth: 1100 } }}
    >
      {obj && <PreviewContent obj={obj} url={url} />}
    </Modal>
  );
}

function FileThumbnail({ name, size = 28 }: { name: string; size?: number }) {
  const ext = getExtension(name);
  if (ext === 'pdf') return <FilePdfIcon size={size} />;
  if (ARCHIVE_EXTENSIONS.has(ext)) return <FileZipIcon size={size} />;
  if (IMAGE_EXTENSIONS.has(ext)) return <FileImageIcon size={size} />;
  if (VIDEO_EXTENSIONS.has(ext)) return <FileVideoIcon size={size} />;
  return <FileIcon size={size} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export function FileExplorerModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [bucketName, setBucketName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [previewObject, setPreviewObject] = useState<StorageObject | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: buckets, isLoading: bucketsLoading } = useAccessibleBuckets();
  const { data: page, isLoading: objectsLoading } = useBucketObjects(bucketName, cursors[pageIndex]);
  const isSearching = debouncedSearch.trim().length > 0;
  const { data: searchPage, isFetching: searchLoading } = useSearchObjects(bucketName, debouncedSearch);
  const objects = isSearching ? searchPage?.objects ?? [] : page?.objects ?? [];
  const objectsLoadingState = isSearching ? searchLoading : objectsLoading;
  const upload = useUploadObject(bucketName ?? '');
  const remove = useDeleteObject(bucketName ?? '');

  const bucket = buckets?.find((b) => b.bucketName === bucketName) ?? null;

  const selectBucket = (value: string | null) => {
    setBucketName(value);
    setFeedback(null);
    setPageIndex(0);
    setCursors([undefined]);
    setSearchInput('');
  };

  const goNextPage = () => {
    if (!page?.nextCursor) return;
    setCursors((current) => {
      if (current[pageIndex + 1] !== undefined) return current;
      const next = [...current];
      next[pageIndex + 1] = page.nextCursor ?? undefined;
      return next;
    });
    setPageIndex((p) => p + 1);
  };

  const goPrevPage = () => {
    setPageIndex((p) => Math.max(0, p - 1));
  };

  const handleUpload = (file: File | null) => {
    if (!file || !bucketName) return;
    setFeedback(null);
    upload.mutate(file, {
      onError: (err) => setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao enviar arquivo.') }),
    });
  };

  const handleDelete = (objectName: string) => {
    if (!bucketName) return;
    setFeedback(null);
    remove.mutate(objectName, {
      onError: (err) => setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao excluir arquivo.') }),
    });
  };

  const handleDownload = async (objectName: string) => {
    if (!bucketName) return;
    try {
      const url = await getObjectDownloadUrl(bucketName, objectName);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao gerar link de download.') });
    }
  };

  const handlePreview = async (obj: StorageObject) => {
    if (!bucketName) return;
    setPreviewObject(obj);
    setPreviewUrl(null);
    try {
      const url = await getObjectDownloadUrl(bucketName, obj.name);
      setPreviewUrl(url);
    } catch (err) {
      setFeedback({ type: 'error', message: errorMessage(err, 'Erro ao gerar pré-visualização.') });
      setPreviewObject(null);
    }
  };

  const closePreview = () => {
    setPreviewObject(null);
    setPreviewUrl(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Explorador de arquivos"
      size="lg"
      styles={{ title: { fontWeight: 600, fontSize: 14 }, content: { width: 880, maxWidth: '95vw' } }}
    >
      <Stack gap="sm">
        <Group align="flex-end" gap="sm">
          <Select
            label="Bucket"
            placeholder={bucketsLoading ? 'Carregando...' : 'Selecione um bucket'}
            data={(buckets ?? []).map((b) => ({ value: b.bucketName, label: b.bucketName }))}
            value={bucketName}
            onChange={selectBucket}
            searchable
            disabled={bucketsLoading}
            nothingFoundMessage="Nenhum bucket disponível"
            size="sm"
            style={{ flex: 1 }}
          />
          <Group gap={4}>
            <Tooltip label="Lista">
              <ActionIcon
                variant={viewMode === 'list' ? 'filled' : 'default'}
                color="gray"
                onClick={() => setViewMode('list')}
                aria-label="Visualizar em lista"
              >
                <ListViewIcon />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Miniaturas">
              <ActionIcon
                variant={viewMode === 'grid' ? 'filled' : 'default'}
                color="gray"
                onClick={() => setViewMode('grid')}
                aria-label="Visualizar em miniaturas"
              >
                <GridViewIcon />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {bucket && (
          <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
              Tipos aceitos: {bucket.allowedExtensions.join(', ')}. Limite por arquivo: {bucket.maxFileSizeMb} MB.
            </Text>
            {bucket.canUpload && (
              <FileButton onChange={handleUpload} accept={bucket.allowedExtensions.join(',')}>
                {(props) => (
                  <Button {...props} size="xs" variant="default" leftSection={<UploadIcon />} loading={upload.isPending}>
                    Enviar
                  </Button>
                )}
              </FileButton>
            )}
          </Group>
        )}

        {feedback && (
          <Alert color={feedback.type === 'error' ? 'red' : 'green'} variant="light" py={6}>
            <Text size="xs">{feedback.message}</Text>
          </Alert>
        )}

        {bucketName && (
          <>
            <Autocomplete
              label="Filtrar arquivos"
              placeholder="Digite parte do nome do arquivo..."
              value={searchInput}
              onChange={setSearchInput}
              data={isSearching ? objects.map((obj) => obj.name) : []}
              leftSection={searchLoading ? <Loader size={12} /> : undefined}
              size="sm"
            />

            <ScrollArea h={440} type="auto" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 6 }}>
              {objectsLoadingState ? (
                <Group justify="center" py="md">
                  <Loader size="sm" />
                </Group>
              ) : objects.length > 0 ? (
                viewMode === 'list' ? (
                  <Stack gap={0}>
                    {objects.map((obj, i) => (
                      <Group
                        key={obj.name}
                        justify="space-between"
                        wrap="nowrap"
                        px="sm"
                        py={6}
                        gap="xs"
                        style={{
                          background: i % 2 === 0 ? 'transparent' : 'var(--mantine-color-gray-0)',
                          borderBottom: '1px solid var(--mantine-color-gray-1)',
                        }}
                      >
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                          <Box c="gray.6" style={{ display: 'flex', flexShrink: 0 }}>
                            <FileThumbnail name={obj.name} size={14} />
                          </Box>
                          <Box style={{ minWidth: 0 }}>
                            <Text size="xs" fw={500} truncate>
                              {obj.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatSize(obj.size)} · {formatDate(obj.lastModified)}
                            </Text>
                          </Box>
                        </Group>
                        <Group gap={4} wrap="nowrap">
                          {isPreviewable(obj.name) && (
                            <Tooltip label="Pré-visualizar">
                              <UnstyledButton
                                onClick={() => handlePreview(obj)}
                                c="gray.6"
                                style={{ display: 'flex', padding: 4 }}
                                aria-label="Pré-visualizar"
                              >
                                <EyeIcon off={false} />
                              </UnstyledButton>
                            </Tooltip>
                          )}
                          <Tooltip label="Baixar">
                            <UnstyledButton
                              onClick={() => handleDownload(obj.name)}
                              c="gray.6"
                              style={{ display: 'flex', padding: 4 }}
                              aria-label="Baixar"
                            >
                              <DownloadIcon />
                            </UnstyledButton>
                          </Tooltip>
                          {bucket?.canDelete && (
                            <Tooltip label="Excluir">
                              <UnstyledButton
                                onClick={() => handleDelete(obj.name)}
                                c="red.6"
                                style={{ display: 'flex', padding: 4 }}
                                aria-label="Excluir"
                                disabled={remove.isPending}
                              >
                                <TrashIcon />
                              </UnstyledButton>
                            </Tooltip>
                          )}
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                ) : (
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" p="sm">
                    {objects.map((obj) => (
                      <Stack
                        key={obj.name}
                        gap={4}
                        align="center"
                        p="sm"
                        style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 6 }}
                      >
                        <Box c="gray.6" style={{ display: 'flex' }}>
                          <FileThumbnail name={obj.name} size={36} />
                        </Box>
                        <Text size="xs" fw={500} ta="center" lineClamp={2} title={obj.name} style={{ width: '100%' }}>
                          {obj.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatSize(obj.size)}
                        </Text>
                        <Group gap={4} wrap="nowrap">
                          {isPreviewable(obj.name) && (
                            <Tooltip label="Pré-visualizar">
                              <UnstyledButton
                                onClick={() => handlePreview(obj)}
                                c="gray.6"
                                style={{ display: 'flex', padding: 4 }}
                                aria-label="Pré-visualizar"
                              >
                                <EyeIcon off={false} />
                              </UnstyledButton>
                            </Tooltip>
                          )}
                          <Tooltip label="Baixar">
                            <UnstyledButton
                              onClick={() => handleDownload(obj.name)}
                              c="gray.6"
                              style={{ display: 'flex', padding: 4 }}
                              aria-label="Baixar"
                            >
                              <DownloadIcon />
                            </UnstyledButton>
                          </Tooltip>
                          {bucket?.canDelete && (
                            <Tooltip label="Excluir">
                              <UnstyledButton
                                onClick={() => handleDelete(obj.name)}
                                c="red.6"
                                style={{ display: 'flex', padding: 4 }}
                                aria-label="Excluir"
                                disabled={remove.isPending}
                              >
                                <TrashIcon />
                              </UnstyledButton>
                            </Tooltip>
                          )}
                        </Group>
                      </Stack>
                    ))}
                  </SimpleGrid>
                )
              ) : (
                <Group justify="center" py="md">
                  <Text size="xs" c="dimmed">
                    {isSearching ? 'Nenhum arquivo encontrado.' : 'Nenhum arquivo neste bucket.'}
                  </Text>
                </Group>
              )}
            </ScrollArea>

            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {isSearching
                  ? searchLoading
                    ? `Buscando "${debouncedSearch}"...`
                    : `${objects.length} resultado(s) para "${debouncedSearch}"${objects.length === 100 ? ' (limitado)' : ''}`
                  : objects.length > 0
                    ? `${objects.length} arquivo(s) · até ${OBJECTS_PAGE_SIZE} por página`
                    : 'Nenhum arquivo'}
              </Text>
              {!isSearching && (
                <Group gap="xs">
                  <Button size="xs" variant="default" onClick={goPrevPage} disabled={pageIndex === 0}>
                    Anterior
                  </Button>
                  <Text size="xs" c="dimmed">
                    Página {pageIndex + 1}
                  </Text>
                  <Button size="xs" variant="default" onClick={goNextPage} disabled={!page?.nextCursor}>
                    Próxima
                  </Button>
                </Group>
              )}
            </Group>
          </>
        )}
      </Stack>

      <PreviewModal obj={previewObject} url={previewUrl} onClose={closePreview} />
    </Modal>
  );
}
