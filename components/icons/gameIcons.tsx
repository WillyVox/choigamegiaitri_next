import type { ComponentType, SVGProps } from 'react';
import {
  SkyStrikeIcon,
  DragonsGateIcon,
  BubbleBurstIcon,
  MergeMeadowIcon,
  CrystalBlocksIcon,
  SudokuZenIcon,
  ChaosOrNahIcon,
} from './index';

/** Maps a GameMeta.slug to its icon component. */
export const GAME_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  'sky-strike': SkyStrikeIcon,
  'dragons-gate': DragonsGateIcon,
  'bubble-burst': BubbleBurstIcon,
  'merge-meadow': MergeMeadowIcon,
  'crystal-blocks': CrystalBlocksIcon,
  'sudoku-zen': SudokuZenIcon,
  'chaos-or-nah': ChaosOrNahIcon,
};
