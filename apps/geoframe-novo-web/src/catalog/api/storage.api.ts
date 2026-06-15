// API do Explorador de arquivos (buckets MinIO) e administracao de buckets.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from '../../app/http';

export const BASE = '/storage';

export interface BucketSummary {
  bucketName: string;
  canUpload: boolean;
  canDelete: boolean;
  allowedExtensions: string[];
  maxFileSizeMb: number;
}

export interface StorageObject {
  name: string;
  size: number;
  lastModified: string | null;
}

export interface StorageObjectsPage {
  objects: StorageObject[];
  nextCursor: string | null;
}

export interface BucketConfig {
  allowedExtensions: string[];
  maxFileSizeMb: number;
}

export type BucketGrantPrincipalType = 'role' | 'user';

export interface BucketAccessGrant {
  id: number;
  principalType: BucketGrantPrincipalType;
  principalValue: string;
  canUpload: boolean;
  canDelete: boolean;
}

export interface BucketAccessGrantInput {
  principalType: BucketGrantPrincipalType;
  principalValue: string;
  canUpload: boolean;
  canDelete: boolean;
}

export interface BucketAdminSummary {
  bucketName: string;
  config: BucketConfig;
  grants: BucketAccessGrant[];
}

function encodeObjectName(objectName: string): string {
  return objectName.split('/').map(encodeURIComponent).join('/');
}

// --- Explorador de arquivos ---

export function useAccessibleBuckets() {
  return useQuery({
    queryKey: ['storage', 'buckets'],
    queryFn: () => apiGet<BucketSummary[]>(`${BASE}/buckets`),
  });
}

export const OBJECTS_PAGE_SIZE = 50;

export function useBucketObjects(bucketName: string | null, cursor: string | undefined, limit = OBJECTS_PAGE_SIZE) {
  return useQuery({
    queryKey: ['storage', 'objects', bucketName, cursor, limit],
    enabled: !!bucketName,
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      return apiGet<StorageObjectsPage>(
        `${BASE}/buckets/${encodeURIComponent(bucketName ?? '')}/objects?${params.toString()}`,
      );
    },
  });
}

export function useSearchObjects(bucketName: string | null, query: string) {
  return useQuery({
    queryKey: ['storage', 'search', bucketName, query],
    enabled: !!bucketName && query.trim().length > 0,
    queryFn: () => {
      const params = new URLSearchParams({ q: query, limit: '100' });
      return apiGet<StorageObjectsPage>(
        `${BASE}/buckets/${encodeURIComponent(bucketName ?? '')}/search?${params.toString()}`,
      );
    },
  });
}

export function useUploadObject(bucketName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiPostForm<StorageObject>(`${BASE}/buckets/${encodeURIComponent(bucketName)}/objects`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'objects', bucketName] });
    },
  });
}

export function useDeleteObject(bucketName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (objectName: string) =>
      apiDelete(`${BASE}/buckets/${encodeURIComponent(bucketName)}/objects/${encodeObjectName(objectName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'objects', bucketName] });
    },
  });
}

export async function getObjectDownloadUrl(bucketName: string, objectName: string): Promise<string> {
  const result = await apiGet<{ url: string }>(
    `${BASE}/buckets/${encodeURIComponent(bucketName)}/objects/${encodeObjectName(objectName)}/download`,
  );
  return result.url;
}

// --- Administracao de buckets ---

export function useAdminBuckets() {
  return useQuery({
    queryKey: ['storage', 'admin', 'buckets'],
    queryFn: () => apiGet<BucketAdminSummary[]>(`${BASE}/admin/buckets`),
  });
}

export function useCreateBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bucketName: string) => apiPost<BucketAdminSummary>(`${BASE}/admin/buckets`, { bucketName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'admin', 'buckets'] });
    },
  });
}

export function useUpdateBucketConfig(bucketName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: BucketConfig) =>
      apiPut<BucketConfig>(`${BASE}/admin/buckets/${encodeURIComponent(bucketName)}/config`, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'admin', 'buckets'] });
    },
  });
}

export function useUpdateBucketGrants(bucketName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grants: BucketAccessGrantInput[]) =>
      apiPut<BucketAccessGrant[]>(`${BASE}/admin/buckets/${encodeURIComponent(bucketName)}/grants`, grants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'admin', 'buckets'] });
    },
  });
}
