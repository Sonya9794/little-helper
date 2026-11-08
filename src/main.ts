import './style.css';
import { invoke } from './api';
import { mascot } from './mascot';
import { panel } from './panel';
import { getCurrentWindow } from '@tauri-apps/api/window';
const root = document.querySelector<HTMLElement>('#app')!;
document.addEventListener('contextmenu', event => event.preventDefault());
async function start(): Promise<void> {
  while (!await invoke<boolean>('startup_ready')) await new Promise(resolve => setTimeout(resolve, 50));
  await (getCurrentWindow().label === 'panel' ? panel(root) : mascot(root));
}
void start().catch(error => { root.textContent = String(error); void invoke('ui_error', { message: String(error) }); });
