// Upload de arquivo vetorial -> nova tabela no schema de recursos.
// Aceita GeoJSON, Shapefile (.zip), GeoPackage, CSV georreferenciado, KML e DXF.
// A tabela criada e publicada automaticamente pelo Martin (auto_publish).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ApiError } from '../../app/http';
import { useUploadResource } from '../../catalog/api/resources.api';

const ACCEPT = '.geojson,.json,.zip,.gpkg,.csv,.kml,.dxf';

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function suggestTableName(name: string): string {
  const base = name.slice(0, name.lastIndexOf('.') >= 0 ? name.lastIndexOf('.') : undefined);
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ResourceUploadPage() {
  const navigate = useNavigate();
  const upload = useUploadResource();

  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [sourceSrid, setSourceSrid] = useState<number | ''>('');
  const [csvWktColumn, setCsvWktColumn] = useState('');
  const [csvXColumn, setCsvXColumn] = useState('');
  const [csvYColumn, setCsvYColumn] = useState('');
  const [csvSrid, setCsvSrid] = useState<number | ''>('');

  const ext = useMemo(() => (file ? fileExtension(file.name) : ''), [file]);
  const isCsv = ext === 'csv';
  const showSourceSrid = ext === 'dxf' || ext === 'zip';

  function handleFileChange(selected: File | null) {
    setFile(selected);
    if (selected && !tableName) {
      setTableName(suggestTableName(selected.name));
    }
  }

  function handleSubmit() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (tableName.trim()) formData.append('table_name', tableName.trim());
    if (sourceSrid !== '') formData.append('source_srid', String(sourceSrid));
    if (isCsv) {
      if (csvWktColumn.trim()) formData.append('csv_wkt_column', csvWktColumn.trim());
      if (csvXColumn.trim()) formData.append('csv_x_column', csvXColumn.trim());
      if (csvYColumn.trim()) formData.append('csv_y_column', csvYColumn.trim());
      if (csvSrid !== '') formData.append('csv_srid', String(csvSrid));
    }

    upload.mutate(formData);
  }

  return (
    <Stack gap="md" maw={560}>
      <div>
        <Title order={3}>Adicionar Novo Recurso</Title>
        <Text c="dimmed" size="sm">
          Envie um arquivo vetorial para criar uma nova camada no banco. A
          camada e publicada automaticamente como MVT.
        </Text>
      </div>

      <Paper withBorder p="md">
        <Stack gap="sm">
          <FileInput
            label="Arquivo"
            description="GeoJSON, Shapefile (.zip com .shp/.shx/.dbf/.prj), GeoPackage, CSV, KML ou DXF"
            placeholder="Selecione um arquivo"
            accept={ACCEPT}
            value={file}
            onChange={handleFileChange}
            clearable
            required
          />

          <TextInput
            label="Nome da camada"
            description="Sera o nome da tabela no banco (somente letras minusculas, numeros e _)"
            placeholder="minha_camada"
            value={tableName}
            onChange={(e) => setTableName(e.currentTarget.value)}
          />

          {showSourceSrid && (
            <NumberInput
              label="SRID de origem (opcional)"
              description="Informe se o arquivo nao tem CRS definido (ex.: shapefile sem .prj, DXF). Sera reprojetado para EPSG:4326."
              placeholder="ex.: 31982"
              value={sourceSrid}
              onChange={(v) => setSourceSrid(typeof v === 'number' ? v : '')}
              min={1}
            />
          )}

          {isCsv && (
            <>
              <Text size="sm" fw={500}>
                Geometria do CSV
              </Text>
              <Text c="dimmed" size="xs">
                Informe a coluna com WKT, ou as colunas de latitude/longitude.
                Se deixar em branco, tentamos detectar automaticamente
                (wkt/geom, lat/lon, etc.).
              </Text>
              <TextInput
                label="Coluna WKT"
                placeholder="wkt"
                value={csvWktColumn}
                onChange={(e) => setCsvWktColumn(e.currentTarget.value)}
              />
              <Group grow>
                <TextInput
                  label="Coluna longitude/X"
                  placeholder="lon"
                  value={csvXColumn}
                  onChange={(e) => setCsvXColumn(e.currentTarget.value)}
                />
                <TextInput
                  label="Coluna latitude/Y"
                  placeholder="lat"
                  value={csvYColumn}
                  onChange={(e) => setCsvYColumn(e.currentTarget.value)}
                />
              </Group>
              <NumberInput
                label="SRID das coordenadas"
                description="Padrao 4326 (graus, WGS84)"
                placeholder="4326"
                value={csvSrid}
                onChange={(v) => setCsvSrid(typeof v === 'number' ? v : '')}
                min={1}
              />
            </>
          )}

          {upload.isError && (
            <Alert color="red" title="Falha ao importar arquivo">
              {upload.error instanceof ApiError
                ? upload.error.message
                : 'Erro inesperado ao enviar o arquivo.'}
            </Alert>
          )}

          {upload.isSuccess && (
            <Alert color="green" title="Recurso criado">
              Tabela <Text span ff="monospace">{upload.data.id}</Text> criada. A
              camada MVT so aparece no mapa apos o servico Martin recarregar o
              catalogo (pode levar alguns minutos, ou pedir para reiniciar o
              container do Martin).{' '}
              <Anchor
                component="button"
                type="button"
                onClick={() =>
                  navigate(`/admin/catalog/resources/${encodeURIComponent(upload.data.id)}`)
                }
              >
                Configurar recurso
              </Anchor>
            </Alert>
          )}

          <Group justify="space-between" mt="sm">
            <Anchor component="button" type="button" onClick={() => navigate(-1)}>
              Cancelar
            </Anchor>
            <Button onClick={handleSubmit} loading={upload.isPending} disabled={!file}>
              Enviar
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
