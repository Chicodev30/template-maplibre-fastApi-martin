// Painel flutuante e arrastável, com cabeçalho minimalista (voltar/ícone/
// título/fechar) e corpo dimensionado de acordo com o conteúdo (até um
// limite de altura, com rolagem). Usado pelo menu principal e pelo painel
// "Camadas".
import { useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { ActionIcon, Box, Group, Paper, Text } from '@mantine/core';
import { BackIcon, CloseIcon } from './icons';

export function FloatingPanel({
  title,
  icon,
  onBack,
  onClose,
  width = 280,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <Paper
      withBorder
      shadow="md"
      radius="md"
      style={{
        position: 'fixed',
        top: 'calc(var(--app-shell-header-offset, 0px) + 8px)',
        left: 8,
        width,
        maxHeight: 'calc(100vh - var(--app-shell-header-offset, 0px) - 16px)',
        zIndex: 196,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      <Group
        gap={6}
        wrap="nowrap"
        px="sm"
        py={8}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', cursor: 'move', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {onBack && (
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Voltar" onClick={onBack}>
            <BackIcon />
          </ActionIcon>
        )}
        {icon && (
          <Box c="gray.6" style={{ display: 'flex' }} aria-hidden="true">
            {icon}
          </Box>
        )}
        <Text fw={700} size="sm" style={{ flex: 1 }} lineClamp={1}>
          {title}
        </Text>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Fechar" onClick={onClose}>
          <CloseIcon />
        </ActionIcon>
      </Group>

      <Box style={{ overflowY: 'auto', minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}
