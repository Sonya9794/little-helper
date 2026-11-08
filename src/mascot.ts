import { listen } from '@tauri-apps/api/event';
import { invoke, el } from './api';

// Rendering contract: draw the replaceable artwork, then send precisely its rendered
// physical-pixel alpha values to the native input-shape adapter. No animation here.
export async function mascot(root: HTMLElement): Promise<void> {
  document.body.classList.add('mascot');
  const canvas = el('canvas'); canvas.setAttribute('aria-label', 'Little Helper: click for menu, drag to move, right-click for tray options');
  root.append(canvas);
  const image = new Image(); image.src = '/mascot.svg'; await image.decode();
  let rendering = false; let queued = false;
  async function draw(): Promise<void> {
    if (rendering) { queued = true; return; }
    rendering = true;
    try {
      canvas.width = Math.round(innerWidth * devicePixelRatio);
      canvas.height = Math.round(innerHeight * devicePixelRatio);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('The mascot canvas could not start.');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = Array.from({ length: canvas.width * canvas.height }, (_, i) => pixels[i * 4 + 3]);
      await invoke('install_mask', { width: canvas.width, height: canvas.height, alpha });
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
  canvas.onpointerdown = event => {
    if (event.button !== 0) return;
    press = { x: event.screenX, y: event.screenY, dragged: false };
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove = event => {
    if (!press || press.dragged || !(event.buttons & 1)) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) >= 4) {
      press.dragged = true;
      canvas.releasePointerCapture(event.pointerId);
      void invoke('start_drag').catch(error => invoke('ui_error', { message: String(error) }));
    }
  };
  canvas.onpointerup = event => {
    if (event.button !== 0) return;
    const clicked = press && !press.dragged; press = null;
    if (clicked) void invoke('show_menu').catch(error => invoke('ui_error', { message: String(error) }));
  };
  canvas.onpointercancel = () => { press = null; };
  canvas.oncontextmenu = event => {
    event.preventDefault(); press = null;
    void invoke('context_menu').catch(error => invoke('ui_error', { message: String(error) }));
  };
  await draw();
}
