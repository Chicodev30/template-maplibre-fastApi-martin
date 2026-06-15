// Menu principal acessado pelo botão hamburger do header: em telas pequenas
// abre como drawer; em telas grandes abre como painel flutuante (FloatingPanel).
// Contém a navegação do app (Camadas) e informações/ações do usuário (admin, logout).
import type { ReactNode } from 'react';
import { ActionIcon, Avatar, Box, Drawer, Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { keycloak } from '../../auth/keycloak';
import { ROLE_LABEL } from '../../auth/auth.types';
import { AddressIcon, AdminIcon, BasemapIcon, FileExplorerIcon, KeywordIcon, LayerIcon, LegendIcon, LocateIcon, LogoutIcon, PrintIcon, SearchIcon } from './icons';
import { FloatingPanel } from './FloatingPanel';

const MENU_WIDTH = 280;

function NavItem({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      px="sm"
      py={8}
      className="gf-menu-item"
      style={{ borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <Box c="gray.6" style={{ display: 'flex' }} aria-hidden="true">
        {icon}
      </Box>
      <Box>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Box>
    </UnstyledButton>
  );
}

function MainMenuContent({
  onOpenCamadas,
  onOpenLegendas,
  onOpenBuscar,
  onOpenBuscarEndereco,
  onOpenPalavraChave,
  onOpenLocalizarCoordenada,
  onOpenExploradorArquivos,
  onOpenImprimir,
  onOpenMapaBase,
}: {
  onOpenCamadas: () => void;
  onOpenLegendas: () => void;
  onOpenBuscar: () => void;
  onOpenBuscarEndereco: () => void;
  onOpenPalavraChave: () => void;
  onOpenLocalizarCoordenada: () => void;
  onOpenExploradorArquivos: () => void;
  onOpenImprimir: () => void;
  onOpenMapaBase: () => void;
}) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = keycloak.tokenParsed?.preferred_username ?? user?.username ?? '?';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Stack gap={0}>
      <Group
        justify="space-between"
        gap="sm"
        px="sm"
        py={10}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Group gap="sm" style={{ minWidth: 0 }}>
          <Avatar radius="xl" size="md" color="gray">
            {initial}
          </Avatar>
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} lineClamp={1}>
              {displayName}
            </Text>
            {role && (
              <Text size="xs" c="dimmed">
                {ROLE_LABEL[role]}
              </Text>
            )}
          </Box>
        </Group>

        <Group gap={4} wrap="nowrap">
          {role === 'admin' && (
            <Tooltip label="Portal admin">
              <ActionIcon variant="subtle" color="gray" aria-label="Portal admin" onClick={() => navigate('/admin')}>
                <AdminIcon />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Sair">
            <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={logout}>
              <LogoutIcon />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Stack gap={6} p={4}>
        <NavItem
          icon={<LayerIcon />}
          label="Camadas"
          description="Grupos de camadas do mapa"
          onClick={onOpenCamadas}
        />
        <NavItem
          icon={<LegendIcon />}
          label="Legendas"
          description="Cores, contornos e rotulos"
          onClick={onOpenLegendas}
        />
        <NavItem
          icon={<SearchIcon />}
          label="Buscar"
          description="Pesquisar feições por atributos"
          onClick={onOpenBuscar}
        />
        <NavItem
          icon={<AddressIcon />}
          label="Buscar endereço"
          description="Localizar endereço no mapa"
          onClick={onOpenBuscarEndereco}
        />
        <NavItem
          icon={<KeywordIcon />}
          label="Palavra-chave"
          description="Pesquisar feições por valor exato"
          onClick={onOpenPalavraChave}
        />
        <NavItem
          icon={<LocateIcon />}
          label="Localizar Coordenada"
          description="Ir para coordenada WGS84, TM-POA e SIRGAS 2000"
          onClick={onOpenLocalizarCoordenada}
        />
        <NavItem
          icon={<FileExplorerIcon />}
          label="Explorador de arquivos"
          description="Navegar e enviar arquivos nos buckets liberados"
          onClick={onOpenExploradorArquivos}
        />
        <NavItem icon={<PrintIcon />} label="Imprimir" description="Gerar PDF do mapa atual" onClick={onOpenImprimir} />
        <NavItem icon={<BasemapIcon />} label="Mapas base" description="Trocar o mapa base" onClick={onOpenMapaBase} />
      </Stack>
    </Stack>
  );
}

export function MainMenu({
  opened,
  onClose,
  onOpenCamadas,
  onOpenLegendas,
  onOpenBuscar,
  onOpenBuscarEndereco,
  onOpenPalavraChave,
  onOpenLocalizarCoordenada,
  onOpenExploradorArquivos,
  onOpenImprimir,
  onOpenMapaBase,
}: {
  opened: boolean;
  onClose: () => void;
  onOpenCamadas: () => void;
  onOpenLegendas: () => void;
  onOpenBuscar: () => void;
  onOpenBuscarEndereco: () => void;
  onOpenPalavraChave: () => void;
  onOpenLocalizarCoordenada: () => void;
  onOpenExploradorArquivos: () => void;
  onOpenImprimir: () => void;
  onOpenMapaBase: () => void;
}) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  if (isMobile) {
    return (
      <Drawer opened={opened} onClose={onClose} title="Menu Principal" size={MENU_WIDTH} padding={0}>
        <MainMenuContent
          onOpenCamadas={onOpenCamadas}
          onOpenLegendas={onOpenLegendas}
          onOpenBuscar={onOpenBuscar}
          onOpenBuscarEndereco={onOpenBuscarEndereco}
          onOpenPalavraChave={onOpenPalavraChave}
          onOpenLocalizarCoordenada={onOpenLocalizarCoordenada}
          onOpenExploradorArquivos={onOpenExploradorArquivos}
          onOpenImprimir={onOpenImprimir}
          onOpenMapaBase={onOpenMapaBase}
        />
      </Drawer>
    );
  }

  if (!opened) return null;

  return (
    <FloatingPanel title="Menu Principal" onClose={onClose} width={MENU_WIDTH}>
      <MainMenuContent
        onOpenCamadas={onOpenCamadas}
        onOpenLegendas={onOpenLegendas}
        onOpenBuscar={onOpenBuscar}
        onOpenBuscarEndereco={onOpenBuscarEndereco}
        onOpenPalavraChave={onOpenPalavraChave}
        onOpenLocalizarCoordenada={onOpenLocalizarCoordenada}
        onOpenExploradorArquivos={onOpenExploradorArquivos}
        onOpenImprimir={onOpenImprimir}
        onOpenMapaBase={onOpenMapaBase}
      />
    </FloatingPanel>
  );
}
