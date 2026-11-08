import { invoke } from '@tauri-apps/api/core';
export { invoke };
export interface Summary { latest: string | null; most_common: string | null; count: number }
export interface Habit { id: number; text: string; order: number; checked: boolean }
export interface Habits { date: string; habits: Habit[] }
export interface Snapshot { history: Summary | null; history_error: string | null; habits: Habits | null; habit_error: string | null; notices: string[] }
export type Edit = { kind: 'add'; text: string } | { kind: 'rename'; id: number; text: string } | { kind: 'delete'; id: number; confirmed: boolean } | { kind: 'move'; id: number; to: number } | { kind: 'check'; id: number; checked: boolean };
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(text: string, action: () => void, key?: string): HTMLButtonElement {
  const node = el('button', text); node.type = 'button'; node.onclick = action;
  if (key) node.dataset.focus = key;
  return node;
}
