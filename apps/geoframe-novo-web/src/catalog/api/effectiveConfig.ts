// Config "efetiva" de uma camada: se ela referencia um perfil de configuracao
// (configProfileId), usa o perfil; senao, cai no default do recurso
// (resource_configs) — todos os campos visiveis, sem restricao, sem limite de
// zoom quando nem perfil nem default existem.
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/http';
import type {
  ResourceConfig,
  ResourceConfigProfileDetail,
  ResourceFieldConfig,
  ResourceSecurityRule,
} from '../types/resource.types';

export interface EffectiveResourceConfig {
  fields: Record<string, ResourceFieldConfig>;
  securityRules: ResourceSecurityRule[];
  minZoom: number | null;
  maxZoom: number | null;
}

const EMPTY_CONFIG: EffectiveResourceConfig = {
  fields: {},
  securityRules: [],
  minZoom: null,
  maxZoom: null,
};

async function fetchEffectiveConfig(
  resourceId: string,
  configProfileId?: number | null,
): Promise<EffectiveResourceConfig> {
  if (configProfileId != null) {
    const profile = await apiGet<ResourceConfigProfileDetail>(
      `/catalog/config-profiles/${configProfileId}`,
    );
    return {
      fields: profile.fields,
      securityRules: profile.securityRules,
      minZoom: profile.minZoom,
      maxZoom: profile.maxZoom,
    };
  }
  const config = await apiGet<ResourceConfig>(
    `/catalog/resources/${encodeURIComponent(resourceId)}/config`,
  );
  return {
    fields: config.fields,
    securityRules: config.securityRules,
    minZoom: null,
    maxZoom: null,
  };
}

export function useEffectiveResourceConfig(
  resourceId: string,
  configProfileId?: number | null,
) {
  return useQuery({
    queryKey: ['effective-resource-config', resourceId, configProfileId ?? null],
    queryFn: () => fetchEffectiveConfig(resourceId, configProfileId),
    enabled: !!resourceId,
    staleTime: 60_000,
  });
}

// Versao em lote, para resolver a config de varias camadas ativas de uma vez
// (ex.: popups do mapa, onde o numero de camadas e dinamico).
export function useEffectiveResourceConfigs(
  layers: Array<{ id: string; resourceId: string; configProfileId?: number | null }>,
): Record<string, EffectiveResourceConfig> {
  const results = useQueries({
    queries: layers.map((layer) => ({
      queryKey: ['effective-resource-config', layer.resourceId, layer.configProfileId ?? null],
      queryFn: () => fetchEffectiveConfig(layer.resourceId, layer.configProfileId),
      staleTime: 60_000,
    })),
  });

  const map: Record<string, EffectiveResourceConfig> = {};
  layers.forEach((layer, index) => {
    map[layer.id] = results[index]?.data ?? EMPTY_CONFIG;
  });
  return map;
}
