// Resolucao de visibilidade/rotulo de campos para tabela de atributos e popup,
// a partir da config efetiva (default ou perfil) de um recurso e do usuario
// atual (principals: user:<username> / user:<email> / role:gfr-<papel>).
import type { AuthUser } from '../../auth/auth.types';
import type { ResourceFieldConfig, ResourceSecurityRule } from '../types/resource.types';

export function getUserPrincipals(user: AuthUser | null): string[] {
  if (!user) return [];
  const principals = [`user:${user.username}`, `role:gfr-${user.effective_role}`];
  if (user.email) principals.push(`user:${user.email}`);
  return principals;
}

function hiddenFieldSet(securityRules: ResourceSecurityRule[], principals: string[]): Set<string> {
  const hidden = new Set<string>();
  for (const rule of securityRules) {
    if (rule.type !== 'hide_fields') continue;
    if (rule.principals.some((p) => principals.includes(p))) {
      rule.fieldNames.forEach((field) => hidden.add(field));
    }
  }
  return hidden;
}

// Filtra colunas pelas flags showInTable/showInPopup (default: visivel) e
// pelas restricoes de seguranca aplicaveis ao usuario atual.
export function visibleFields(
  columns: string[],
  fields: Record<string, ResourceFieldConfig>,
  securityRules: ResourceSecurityRule[],
  principals: string[],
  mode: 'table' | 'popup',
): string[] {
  const hidden = hiddenFieldSet(securityRules, principals);
  return columns.filter((col) => {
    if (hidden.has(col)) return false;
    const field = fields[col];
    if (!field) return true;
    return mode === 'table' ? field.showInTable : field.showInPopup;
  });
}

export function fieldLabel(fields: Record<string, ResourceFieldConfig>, col: string): string {
  return fields[col]?.label ?? col;
}
