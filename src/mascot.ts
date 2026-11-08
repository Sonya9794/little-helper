import { listen } from '@tauri-apps/api/event';
import { invoke, el } from './api';
import { paintScene } from './scene';

// Rendering contract: draw the replaceable artwork, then send precisely its rendered
// physical-pixel alpha values to the native input-shape adapter. No animation here.
export async function mascot(root: HTMLElement): Promise<void> {
  document.body.classList.add('mascot');
  const canvas = el('canvas'); canvas.setAttribute('aria-label', 'Little Helper: click for menu, drag to move, right-click for tray options');
  canvas.setAttribute('role', 'button'); canvas.tabIndex = 0;
  root.append(canvas);
  const image = new Image(); image.src = '/mascot.svg'; await image.decode();
  let rendering = false; let queued = false;
  async function draw(): Promise<void> {
    if (rendering) { queued = true; return; }
    rendering = true;
    try {
      await paintScene(canvas, (ctx, metrics) => { ctx.drawImage(image, 0, 0, metrics.width, metrics.height); });
    } catch (error) {
      await invoke('ui_error', { message: String(error) });
    } finally {
      rendering = false;
      if (queued) { queued = false; void draw(); }
    }
  }
  await listen('mask-refresh', () => { void draw(); });
  window.addEventListener('resize', () => { void draw(); });
  let press: { x: number; y: number; dragged: boolean } | null = null;
  let suppressClick = false;
  const openChoices = () => { void invoke('show_menu').catch(error => invoke('ui_error', { message: String(error) })); };
  canvas.onpointerdown = event => {
    if (event.button !== 0) return;
    suppressClick = false;
    press = { x: event.screenX, y: event.screenY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove = event => {
    if (!press || press.dragged || !(event.buttons & 1)) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) >= 4) {
      press.dragged = true;
      suppressClick = true;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      void invoke('start_drag').catch(error => invoke('ui_error', { message: String(error) }));
    }
  };
  canvas.onpointerup = event => {
    if (event.button !== 0) return;
    press = null;
  };
  canvas.onclick = event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false; openChoices();
  };
  canvas.onkeydown = event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); suppressClick = false; openChoices(); }
  };
  canvas.onpointercancel = () => { press = null; };
  canvas.oncontextmenu = event => {
    event.preventDefault(); press = null;
    void invoke('context_menu').catch(error => invoke('ui_error', { message: String(error) }));
  };
  await draw();
}
