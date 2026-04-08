import { ReminderLevel } from '../types';
import { gentle } from './gentle';
import { nudge } from './nudge';
import { pushy } from './pushy';
import { intrusive } from './intrusive';
import { aggressive } from './aggressive';
import { nuclear } from './nuclear';

export const levels: ReminderLevel[] = [
  gentle,
  nudge,
  pushy,
  intrusive,
  aggressive,
  nuclear,
];

export function getLevel(index: number): ReminderLevel {
  return levels[Math.min(index, levels.length - 1)];
}
