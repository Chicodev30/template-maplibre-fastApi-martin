// Geração de PDF do mapa: captura o canvas do OpenLayers e gera PDF com jsPDF.
import type Map from 'ol/Map';
import { jsPDF } from 'jspdf';
import type { GeometryKind } from '../layouts/MapLayout/LegendsPanel';

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

export function printMap(map: Map, options: PrintMapOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const [sizeWidth, sizeHeight] = PRINT_PAGE_SIZES[options.paperSize];
    const landscapeBase: [number, number] = sizeWidth >= sizeHeight ? [sizeWidth, sizeHeight] : [sizeHeight, sizeWidth];
    const [widthMm, heightMm] =
      options.orientation === 'landscape' ? landscapeBase : [landscapeBase[1], landscapeBase[0]];

    // Captura o canvas do OL após o próximo render completo.
    map.once('rendercomplete', () => {
      try {
        // OL pode ter múltiplos canvas (um por layer); composita todos num canvas único.
        const mapCanvas = document.createElement('canvas');
        const viewport = map.getViewport();
        const size = map.getSize() ?? [viewport.clientWidth, viewport.clientHeight];
        mapCanvas.width = size[0];
        mapCanvas.height = size[1];
        const ctx = mapCanvas.getContext('2d')!;

        viewport.querySelectorAll<HTMLCanvasElement>('canvas').forEach((canvas) => {
          if (canvas.width > 0) {
            ctx.drawImage(canvas, 0, 0);
          }
        });

        const imageData = mapCanvas.toDataURL('image/png');

        const doc = new jsPDF({
          orientation: widthMm >= heightMm ? 'l' : 'p',
          unit: 'mm',
          format: [widthMm, heightMm],
          compress: true,
        });

        doc.addImage(imageData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

        const hasTitle = !!options.title.trim();
        if (hasTitle) drawTitle(doc, options.title.trim(), widthMm);
        if (options.legends.length > 0) drawLegend(doc, options.legends, widthMm, hasTitle);

        doc.save(`${options.fileName ?? 'mapa'}.pdf`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    map.renderSync();
  });
}
