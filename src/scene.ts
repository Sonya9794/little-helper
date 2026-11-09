import { invoke, el } from './api';
import type { Rect } from './choice-layout';
export interface Metrics { active: boolean; width: number; height: number; mascot: Rect | null }
// Paint at native client resolution and install exactly the resulting alpha.
// Choices stay hidden until ready; native DPI handling hides the mascot on scale changes.
export async function paintScene(canvas: HTMLCanvasElement, paint: (ctx: CanvasRenderingContext2D, metrics: Metrics) => void): Promise<void> {
  const metrics = await invoke<Metrics>('prepare_scene');
  if (!metrics.active) return;
  canvas.width = metrics.width; canvas.height = metrics.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('The overlay canvas could not start.');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paint(ctx, metrics);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = Array.from({ length: canvas.width * canvas.height }, (_, i) => pixels[i * 4 + 3]);
  await invoke('install_mask', { width: canvas.width, height: canvas.height, alpha });
}
export function sceneCanvas(root: HTMLElement): HTMLCanvasElement { const canvas = el('canvas'); root.append(canvas); return canvas; }
