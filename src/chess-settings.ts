import { el } from './api';
import type { ChessSettings } from './chess-api';
export function chessSettings(initial: ChessSettings, save: (settings: ChessSettings) => Promise<unknown>): HTMLElement {
  const section = el('section', undefined, 'chess-settings');
  section.append(el('h2', 'Chess difficulty'));
  const form = el('form'); const modes = el('fieldset'); modes.className = 'rating-modes'; modes.append(el('legend', 'Elo mode'));
  const fields = el('div'); let selected = initial.mode;
  const values = { ...initial };
  const readFields = () => { fields.querySelectorAll<HTMLInputElement>('input').forEach(input => {
    const name = input.name as 'adaptive_elo' | 'preset_elo' | 'win_step' | 'loss_step'; values[name] = Number(input.value);
  }); };
  const renderFields = () => {
    fields.replaceChildren();
    const add = (name: 'adaptive_elo' | 'preset_elo' | 'win_step' | 'loss_step', label: string, min: number, max: number) => {
      const wrapper = el('label', label); const input = el('input'); input.type = 'number'; input.name = name;
      input.min = String(min); input.max = String(max); input.step = '1'; input.required = true; input.value = String(values[name]);
      input.dataset.focus = `chess-${name}`; if (name.endsWith('_elo')) input.id = 'chess-elo'; wrapper.append(input); fields.append(wrapper);
    };
    if (selected === 'adaptive') {
      add('adaptive_elo', 'Current adaptive Elo', 200, 3190);
      add('win_step', 'Points gained after you win', 1, 200);
      add('loss_step', 'Points lost after you lose', 1, 200);
    } else add('preset_elo', 'Current preset Elo', 200, 3190);
  };
  for (const mode of ['adaptive', 'preset'] as const) {
    const label = el('label'); const input = el('input'); input.type = 'radio'; input.name = 'rating-mode'; input.value = mode; input.checked = selected === mode;
    input.onchange = () => { readFields(); selected = mode; renderFields(); };
    label.append(input, document.createTextNode(mode === 'adaptive' ? 'Adaptive' : 'Preset')); modes.append(label);
  }
  const submit = el('button', 'Save chess settings'); submit.type = 'submit';
  const message = el('p', '', 'status'); message.setAttribute('role', 'status');
  form.onsubmit = event => { event.preventDefault(); readFields(); submit.disabled = true;
    void save({ ...values, mode: selected }).then(() => { message.textContent = 'Chess settings saved. Refresh changes in chess setup to use them.'; })
      .catch(error => { message.textContent = String(error); message.className = 'error'; })
      .finally(() => { submit.disabled = false; });
  };
  renderFields(); form.append(modes, fields, submit, message);
  section.append(form, el('p', 'Elo is a practice difficulty estimate (200–3190). Below 1320, the helper deliberately makes weaker moves. Adaptive and preset values are stored separately. Draws and abandoned games do not change Elo.', 'muted'));
  return section;
}
