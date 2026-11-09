import { listen } from '@tauri-apps/api/event';
import { invoke, button, type Snapshot } from './api';
import { choiceLayout } from './choice-layout';
import { paintScene, sceneCanvas } from './scene';

export async function choices(root: HTMLElement): Promise<void> {
  document.body.classList.add('choices');
  const canvas = sceneCanvas(root); canvas.setAttribute('aria-hidden', 'true');
  let drawing = false, queued = false;
  async function draw(): Promise<void> {
    if (drawing) { queued = true; return; } drawing = true;
    try {
      const data = await invoke<Snapshot>('snapshot');
      root.querySelectorAll('button').forEach(node => node.remove());
      const actions: { label: string; run: () => Promise<unknown> }[] = [];
      for (const text of [data.history?.most_common, data.history?.latest]) {
        if (text != null) actions.push({ label: text.trim().replace(/\s+/g, ' '), run: async () => {
          await invoke('submit_prompt', { text }); await invoke('open_detail', { page: 'saved', text });
        } });
      }
      actions.push(
        { label: 'Other…', run: () => invoke('open_detail', { page: 'prompt', text: null }) },
        { label: 'Habit Tracker', run: () => invoke('open_detail', { page: 'habits', text: null }) },
        { label: 'Motivation', run: () => invoke('open_detail', { page: 'motivation', text: null }) },
      );
      const buttons: HTMLButtonElement[] = [];
      await paintScene(canvas, (ctx, metrics) => {
        const scale = devicePixelRatio;
        if (!metrics.mascot) throw new Error('Mascot position is unavailable.');
        const m = metrics.mascot;
        const bounds = choiceLayout(metrics.width / scale, metrics.height / scale,
          { x: m.x / scale, y: m.y / scale, width: m.width / scale, height: m.height / scale }, actions.length);
        ctx.scale(scale, scale);
        bounds.forEach((r, i) => {
          ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2, Math.max(0, (r.height - 2) / 2));
          ctx.fillStyle = '#fffdf5'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#327d68'; ctx.stroke();
          const action = actions[i];
          const node = button(action.label, () => {
            buttons.forEach(b => { b.disabled = true; });
            void action.run().catch(async error => {
              await invoke('ui_error', { message: String(error) });
            });
          });
          node.className = 'round-choice'; node.title = action.label;
          Object.assign(node.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
          root.append(node); buttons.push(node);
        });
      });
      buttons[0]?.focus();
    } catch (error) { await invoke('ui_error', { message: String(error) }); }
    finally { drawing = false; if (queued) { queued = false; void draw(); } }
  }
  await listen('choices-refresh', () => { void draw(); });
  window.addEventListener('resize', () => { void draw(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); void invoke('hide_choices'); } });
  await draw();
}
