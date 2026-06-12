// Seletor de papel para o bypass de dev (so aparece quando authDevBypass=true).
import { Select, Tooltip } from '@mantine/core';
import { useAuth } from './useAuth';
import { DEV_ROLE_OPTIONS } from './auth.types';

export function DevRoleSwitcher() {
  const { devBypass, devRole, setDevRole } = useAuth();
  if (!devBypass) return null;

  return (
    <Tooltip label="Papel simulado (modo dev — sem Keycloak)" position="bottom">
      <Select
        size="xs"
        w={210}
        data={DEV_ROLE_OPTIONS.map((o) => ({ value: o.value, label: `dev: ${o.label}` }))}
        value={devRole}
        onChange={(v) => setDevRole(v ?? '')}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
      />
    </Tooltip>
  );
}
