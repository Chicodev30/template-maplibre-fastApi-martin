// Tipos de estilo de uma camada do group-layer.

export type LabelPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface LabelStyle {
  enabled: boolean;
  field?: string | null;
  color: string;
  size: number;
  haloColor: string;
  position: LabelPosition;
  fontFamily: string;
}

export interface LayerStyle {
  color: string;
  opacity: number;
  outlineColor?: string | null;
  outlineWidth: number;
  label: LabelStyle;
}

export const LABEL_POSITION_OPTIONS: Array<{ value: LabelPosition; label: string }> = [
  { value: 'top', label: 'Acima' },
  { value: 'bottom', label: 'Abaixo' },
  { value: 'left', label: 'Esquerda' },
  { value: 'right', label: 'Direita' },
  { value: 'center', label: 'Centro' },
];

export const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Noto Sans Regular', label: 'Noto Sans' },
  { value: 'Noto Sans Bold', label: 'Noto Sans (negrito)' },
];

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export const FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: 'equals', label: 'Igual' },
  { value: 'not_equals', label: 'Diferente' },
  { value: 'contains', label: 'Contém' },
  { value: 'starts_with', label: 'Começa com' },
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual' },
];

// Preset de estilo salvo para um recurso (catalogo "Estilização").
export interface ResourceStyleSummary {
  id: number;
  resourceId: string;
  name: string;
  updatedAt: string;
}

export interface ResourceStyleDetail extends ResourceStyleSummary {
  style: LayerStyle;
}

export interface ResourceStyleInput {
  resourceId: string;
  name: string;
  style: LayerStyle;
}

export function defaultLayerStyle(): LayerStyle {
  return {
    color: '#3388ff',
    opacity: 0.8,
    outlineColor: '#1c4f8a',
    outlineWidth: 1,
    label: {
      enabled: false,
      field: null,
      color: '#222222',
      size: 12,
      haloColor: '#ffffff',
      position: 'top',
      fontFamily: 'Noto Sans Regular',
    },
  };
}
