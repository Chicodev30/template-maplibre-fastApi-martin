// Geracao de PDF do mapa: renderiza o estilo atual num mapa MapLibre
// offscreen na resolucao/DPI escolhida e monta o PDF com jsPDF,
// incluindo titulo e uma legenda opcional com os itens selecionados.
import maplibregl from 'maplibre-gl';
import { jsPDF } from 'jspdf';
import type { GeometryKind } from '../layouts/MapLayout/LegendsPanel';

// Tamanhos de pagina em milimetros, na orientacao paisagem (largura x altura).
export const PRINT_PAGE_SIZES: Record<string, [number, number]> = {
  A3: [420, 297],
  A4: [297, 210],
  A5: [210, 148],
  LETTER: [279, 216],
};

export const PRINT_DPI_OPTIONS = [96, 150, 300] as const;

export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintLegendItem {
  id: string;
  label: string;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  geometryKind: GeometryKind;
}

export interface PrintMapOptions {
  title: string;
  dpi: number;
  paperSize: keyof typeof PRINT_PAGE_SIZES;
  orientation: PrintOrientation;
  legends: PrintLegendItem[];
  fileName?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return [102, 102, 102];
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b];
}

const PANEL_OPACITY = 0.78;

function drawLegend(doc: jsPDF, legends: PrintLegendItem[], pageWidthMm: number, hasTitle: boolean) {
  const rowHeight = 6;
  const padding = 3;
  const titleHeight = 6;
  const width = 58;
  const height = padding * 2 + titleHeight + legends.length * rowHeight;
  const x = pageWidthMm - width - 4;
  const y = (hasTitle ? 9 : 0) + 4;

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: PANEL_OPACITY }));

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Legenda', x + padding, y + padding + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  legends.forEach((legend, index) => {
    const rowY = y + padding + titleHeight + index * rowHeight + rowHeight / 2;
    const symbolX = x + padding;
    const [r, g, b] = hexToRgb(legend.color);
    const [or_, og, ob] = hexToRgb(legend.outlineColor || legend.color);

    if (legend.geometryKind === 'line') {
      doc.setDrawColor(or_, og, ob);
      doc.setLineWidth(Math.max(0.3, legend.outlineWidth * 0.3));
      doc.line(symbolX, rowY, symbolX + 7, rowY);
    } else if (legend.geometryKind === 'point') {
      doc.setFillColor(r, g, b);
      doc.setDrawColor(or_, og, ob);
      doc.setLineWidth(0.2);
      doc.circle(symbolX + 3, rowY, 1.6, 'FD');
    } else {
      doc.setFillColor(r, g, b);
      doc.setDrawColor(or_, og, ob);
      doc.setLineWidth(0.2);
      doc.rect(symbolX, rowY - 2, 7, 4, 'FD');
    }

    doc.setTextColor(40, 40, 40);
    doc.text(legend.label, symbolX + 10, rowY + 1, { maxWidth: width - padding * 2 - 10 });
  });

  doc.restoreGraphicsState();
}

function drawTitle(doc: jsPDF, title: string, pageWidthMm: number) {
  const barHeight = 9;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidthMm, barHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 4, barHeight / 2 + 3);
}

// Resolucao do solo (m/pixel CSS) em Web Mercator, igual a convencao usada por
// servidores de tiles (tile 256px a zoom 0).
function groundResolution(zoom: number, latitudeDeg: number): number {
  return (156543.03392 * Math.cos((latitudeDeg * Math.PI) / 180)) / Math.pow(2, zoom);
}

const NICE_DISTANCES_M = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000,
];

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

function drawNorthArrowAndScale(
  doc: jsPDF,
  map: maplibregl.Map,
  pageWidthMm: number,
  pageHeightMm: number,
) {
  const bearing = map.getBearing();
  const { lat } = map.getCenter();
  const metersPerCssPx = groundResolution(map.getZoom(), lat);
  const metersPerMm = metersPerCssPx * (96 / 25.4);
  const scaleDenominator = Math.round(metersPerMm * 1000);

  const margin = 4;
  const width = 46;
  const height = 20;
  const x = pageWidthMm - width - margin;
  const y = pageHeightMm - height - margin;
  const padding = 3;

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: PANEL_OPACITY }));

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  // Seta do norte, rotacionada de acordo com o bearing do mapa, na metade esquerda do painel.
  const northZoneWidth = 14;
  const cx = x + northZoneWidth / 2 + padding / 2;
  const arrowCy = y + height / 2 - 1.5;
  const bearingRad = (bearing * Math.PI) / 180;
  const dir = { x: Math.sin(bearingRad), y: -Math.cos(bearingRad) };
  const perp = { x: -dir.y, y: dir.x };
  const arrowLength = 3.2;
  const arrowWidth = 1.8;
  const tip = { x: cx + dir.x * arrowLength, y: arrowCy + dir.y * arrowLength };
  const baseCenter = { x: cx - dir.x * arrowLength, y: arrowCy - dir.y * arrowLength };
  const baseLeft = { x: baseCenter.x - perp.x * arrowWidth, y: baseCenter.y - perp.y * arrowWidth };
  const baseRight = { x: baseCenter.x + perp.x * arrowWidth, y: baseCenter.y + perp.y * arrowWidth };

  doc.setFillColor(60, 60, 60);
  doc.setDrawColor(60, 60, 60);
  doc.triangle(tip.x, tip.y, baseLeft.x, baseLeft.y, baseRight.x, baseRight.y, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text('N', cx, arrowCy + 8, { align: 'center' });

  // Escala grafica, na metade direita do painel: escolhe uma distancia
  // "redonda" que resulte numa barra entre 12 e 25mm aproximadamente.
  const scaleZoneX = x + northZoneWidth + padding;
  const scaleZoneWidth = width - northZoneWidth - padding * 2;
  let niceDistance = NICE_DISTANCES_M[0];
  for (const candidate of NICE_DISTANCES_M) {
    const barWidthMm = candidate / metersPerMm;
    niceDistance = candidate;
    if (barWidthMm >= 12) break;
  }
  const barWidthMm = Math.min(niceDistance / metersPerMm, scaleZoneWidth);

  const scaleCx = scaleZoneX + scaleZoneWidth / 2;
  const barX = scaleCx - barWidthMm / 2;
  const barY = y + 9;

  doc.setFillColor(60, 60, 60);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.rect(barX, barY, barWidthMm / 2, 1.2, 'F');
  doc.rect(barX + barWidthMm / 2, barY, barWidthMm / 2, 1.2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  doc.text(formatDistance(niceDistance), scaleCx, barY - 1.5, { align: 'center' });
  doc.text(`Escala 1:${scaleDenominator.toLocaleString('pt-BR')}`, scaleCx, barY + 5, {
    align: 'center',
  });

  doc.restoreGraphicsState();
}

export function printMap(map: maplibregl.Map, options: PrintMapOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const [sizeWidth, sizeHeight] = PRINT_PAGE_SIZES[options.paperSize];
    const landscapeBase: [number, number] = sizeWidth >= sizeHeight ? [sizeWidth, sizeHeight] : [sizeHeight, sizeWidth];
    const [widthMm, heightMm] =
      options.orientation === 'landscape' ? landscapeBase : [landscapeBase[1], landscapeBase[0]];

    const cssWidth = (widthMm * 96) / 25.4;
    const cssHeight = (heightMm * 96) / 25.4;

    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => options.dpi / 96,
    });

    const restoreDpr = () => {
      if (originalDescriptor) {
        Object.defineProperty(window, 'devicePixelRatio', originalDescriptor);
      } else {
        Object.defineProperty(window, 'devicePixelRatio', {
          configurable: true,
          writable: true,
          value: originalDpr,
        });
      }
    };

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = `${cssWidth}px`;
    container.style.height = `${cssHeight}px`;
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const style = map.getStyle();
    if (style?.sources) {
      Object.values(style.sources).forEach((source) => {
        const record = source as Record<string, unknown>;
        Object.keys(record).forEach((key) => {
          if (!record[key]) delete record[key];
        });
      });
    }

    let renderMap: maplibregl.Map | null = null;

    const cleanup = () => {
      renderMap?.remove();
      container.remove();
      restoreDpr();
    };

    try {
      renderMap = new maplibregl.Map({
        container,
        style,
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        interactive: false,
        fadeDuration: 0,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }

    renderMap.once('error', (event) => {
      cleanup();
      reject(event.error ?? new Error('Erro ao renderizar mapa para impressao.'));
    });

    renderMap.once('load', () => {
      renderMap?.once('idle', () => {
        try {
          const canvas = renderMap!.getCanvas();
          const imageData = canvas.toDataURL('image/png');

          const doc = new jsPDF({
            orientation: widthMm >= heightMm ? 'l' : 'p',
            unit: 'mm',
            format: [widthMm, heightMm],
            compress: true,
          });

          doc.addImage(imageData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

          const hasTitle = !!options.title.trim();
          if (hasTitle) {
            drawTitle(doc, options.title.trim(), widthMm);
          }

          if (options.legends.length > 0) {
            drawLegend(doc, options.legends, widthMm, hasTitle);
          }

          drawNorthArrowAndScale(doc, map, widthMm, heightMm);

          doc.save(`${options.fileName ?? 'mapa'}.pdf`);
          cleanup();
          resolve();
        } catch (err) {
          cleanup();
          reject(err);
        }
      });
    });
  });
}
