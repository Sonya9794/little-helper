import { listen } from '@tauri-apps/api/event';
import { invoke, button, el, type Snapshot } from './api';
import { choiceLayout } from './choice-layout';
import { paintScene, sceneCanvas } from './scene';
import { menuChoices, type MenuAction, type ChoiceGroup } from './menu-model';

export async function choices(root: HTMLElement): Promise<void> {
  document.body.classList.add('choices');
  const canvas = sceneCanvas(root); canvas.setAttribute('aria-hidden', 'true');
  let drawing = false, queued = false;
  let group: ChoiceGroup = 'main';
  async function select(action: MenuAction): Promise<unknown> {
    if (action.type === 'saved') { await invoke('submit_prompt',{text:action.text}); return invoke('open_detail',{page:'saved',text:action.text}); }
    if (action.type === 'page') return invoke('open_detail',{page:action.page,text:null});
    if (action.type === 'group') return invoke('set_choice_group',{group:action.group});
    return invoke(action.type === 'chess' ? 'open_chess' : 'open_todo');
  }
  async function draw(): Promise<void> {
    if (drawing) { queued = true; return; } drawing = true;
    try {
      const [data, nextGroup] = await Promise.all([invoke<Snapshot>('snapshot'), invoke<'main' | 'lock_in'>('get_choice_group')]); group = nextGroup;
      root.querySelectorAll('button').forEach(node => node.remove());
      const actions = menuChoices(group, data.history);
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
          const node = button('', () => {
            buttons.forEach(b => { b.disabled = true; });
            void select(action.action).catch(async error => {
              await invoke('ui_error', { message: String(error) });
            });
          });
          const text = el('span', action.label, 'choice-label');
          const arrow = action.arrow ? el('span', action.arrow === 'left' ? '←' : '→', 'choice-arrow') : null;
          arrow?.setAttribute('aria-hidden', 'true');
          if (action.arrow === 'left' && arrow) node.append(arrow);
          node.append(text);
          if (action.arrow === 'right' && arrow) node.append(arrow);
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
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); void invoke(group === 'lock_in' ? 'set_choice_group' : 'hide_choices', group === 'lock_in' ? { group: 'main' } : undefined); } });
  await draw();
}
