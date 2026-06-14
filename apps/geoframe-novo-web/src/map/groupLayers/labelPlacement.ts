// Deriva text-anchor/text-offset do MapLibre a partir da posicao do rotulo
// escolhida no editor de estilo (LabelPosition).
import type { LabelPosition } from '../../catalog/types/style.types';

export interface LabelPlacement {
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offset: [number, number];
}

const OFFSET = 0.8;

export function labelPlacement(position: LabelPosition): LabelPlacement {
  switch (position) {
    case 'bottom':
      return { anchor: 'top', offset: [0, OFFSET] };
    case 'left':
      return { anchor: 'right', offset: [-OFFSET, 0] };
    case 'right':
      return { anchor: 'left', offset: [OFFSET, 0] };
    case 'center':
      return { anchor: 'center', offset: [0, 0] };
    case 'top':
    default:
      return { anchor: 'bottom', offset: [0, -OFFSET] };
  }
}
