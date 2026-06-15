// Operadores de filtro para o painel "Buscar" - espelha (e estende) os
// operadores disponiveis na tabela de atributos do admin.
export type SearchOperator =
  | 'contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in_list'
  | 'is_null'
  | 'is_not_null';

const BASE_OPERATORS: Array<{ value: SearchOperator; label: string }> = [
  { value: 'contains', label: 'Contém' },
  { value: 'equals', label: 'Igual' },
  { value: 'not_equals', label: 'Diferente' },
  { value: 'starts_with', label: 'Começa com' },
  { value: 'ends_with', label: 'Termina com' },
  { value: 'in_list', label: 'Em lista' },
  { value: 'is_null', label: 'É nulo' },
  { value: 'is_not_null', label: 'Não é nulo' },
];

const COMPARISON_OPERATORS: Array<{ value: SearchOperator; label: string }> = [
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual' },
  { value: 'between', label: 'Entre' },
];

const ALL_OPERATORS = [...BASE_OPERATORS, ...COMPARISON_OPERATORS];

export function operatorLabel(operator: string): string {
  return ALL_OPERATORS.find((o) => o.value === operator)?.label ?? operator;
}

export function supportsComparison(dataType: string | undefined): boolean {
  if (!dataType) return false;
  const type = dataType.toLowerCase();
  return [
    'smallint',
    'integer',
    'bigint',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'date',
    'timestamp',
    'timestamp without time zone',
    'timestamp with time zone',
  ].includes(type);
}

// Operadores disponiveis para um campo, ordenados de forma que as
// comparacoes numericas/data apareçam logo apos "Diferente".
export function searchOperatorOptions(dataType: string | undefined): Array<{ value: SearchOperator; label: string }> {
  if (!supportsComparison(dataType)) return BASE_OPERATORS;
  const [contains, equals, notEquals, ...rest] = BASE_OPERATORS;
  return [contains, equals, notEquals, ...COMPARISON_OPERATORS, ...rest];
}

// Operadores que nao exigem nenhum valor de entrada.
export function operatorNeedsValue(operator: string): boolean {
  return operator !== 'is_null' && operator !== 'is_not_null';
}

export function operatorNeedsSecondValue(operator: string): boolean {
  return operator === 'between';
}

export function operatorNeedsListValue(operator: string): boolean {
  return operator === 'in_list';
}

// Descricao legivel dos filtros aplicados, usada no titulo da tabela de
// resultados do painel "Buscar" (ex.: "objectid Igual 117, mz Entre 1 e 5").
export function describeSearchFilters(
  filters: Array<{ column: string; operator: string; value?: string; value2?: string; values?: string[] }>,
  fieldLabels: Record<string, string>,
): string {
  return filters
    .map((f) => {
      const label = fieldLabels[f.column] ?? f.column;
      const opLabel = operatorLabel(f.operator);
      if (operatorNeedsListValue(f.operator)) {
        return `${label} ${opLabel} ${(f.values ?? []).join(', ')}`;
      }
      if (operatorNeedsSecondValue(f.operator)) {
        return `${label} ${opLabel} ${f.value ?? ''} e ${f.value2 ?? ''}`;
      }
      if (!operatorNeedsValue(f.operator)) {
        return `${label} ${opLabel}`;
      }
      return `${label} ${opLabel} ${f.value ?? ''}`;
    })
    .join(', ');
}
