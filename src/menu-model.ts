import type { Summary } from './api';
export type ChoiceGroup = 'main' | 'lock_in' | 'games';
export type MenuAction = { type: 'saved'; text: string } | { type: 'page'; page: 'prompt' | 'habits' | 'motivation' }
  | { type: 'group'; group: ChoiceGroup } | { type: 'chess' | 'todo' | 'blackjack' | 'timer' };
export interface MenuChoice { label: string; arrow?: 'left' | 'right'; action: MenuAction }
export function menuChoices(group: ChoiceGroup, history: Summary | null): MenuChoice[] {
  if (group === 'games') return [
    { label: 'Chess', action: { type: 'chess' } },
    { label: 'Blackjack', action: { type: 'blackjack' } },
    { label: 'Back', arrow: 'left', action: { type: 'group', group: 'main' } },
  ];
  if (group === 'lock_in') return [
    { label: 'Habit Tracker', action: { type: 'page', page: 'habits' } },
    { label: 'Motivation', action: { type: 'page', page: 'motivation' } },
    { label: 'To-Do List', action: { type: 'todo' } },
    { label: 'Timer', action: { type: 'timer' } },
    { label: 'Back', arrow: 'left', action: { type: 'group', group: 'main' } },
  ];
  const choices: MenuChoice[] = [];
  for (const text of [history?.most_common, history?.latest]) if (text != null) choices.push({ label: text.trim().replace(/\s+/g,' '), action: { type: 'saved', text } });
  choices.push({ label: 'Settings', action: { type: 'page', page: 'prompt' } },
    { label: 'Lock In', arrow: 'right', action: { type: 'group', group: 'lock_in' } },
    { label: 'Games', arrow: 'right', action: { type: 'group', group: 'games' } });
  return choices;
}
