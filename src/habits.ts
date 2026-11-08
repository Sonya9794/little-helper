import { button, el, type Edit, type Habits } from './api';

export function habitTracker(state: Habits, onEdit: (edit: Edit) => Promise<void>, back: () => void): HTMLElement {
  const section = el('section');
  section.append(el('h2', 'Habit Tracker'), el('p', state.date + ' · Resets at local midnight', 'muted'));
  const list = el('ol', undefined, 'habits');
  for (const habit of state.habits) {
    const row = el('li'); const line = el('div', undefined, 'habit-line');
    const check = el('input'); check.type = 'checkbox'; check.checked = habit.checked;
    check.setAttribute('aria-label', `Complete: ${habit.text}`); check.dataset.focus = `check-${habit.id}`;
    check.onchange = () => { void onEdit({ kind: 'check', id: habit.id, checked: check.checked }); };
    const name = el('input'); name.type = 'text'; name.value = habit.text; name.className = 'habit-name'; name.title = habit.text;
    name.setAttribute('aria-label', `Rename habit: ${habit.text}`); name.dataset.focus = `name-${habit.id}`;
    name.onchange = () => { void onEdit({ kind: 'rename', id: habit.id, text: name.value }); };
    name.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); name.blur(); } };
    line.append(check, name); row.append(line);
    const controls = el('div', undefined, 'habit-controls');
    const up = button('↑', () => { void onEdit({ kind: 'move', id: habit.id, to: habit.order - 1 }); }, `up-${habit.id}`);
    up.disabled = habit.order === 0; up.setAttribute('aria-label', `Move ${habit.text} up`);
    const down = button('↓', () => { void onEdit({ kind: 'move', id: habit.id, to: habit.order + 1 }); }, `down-${habit.id}`);
    down.disabled = habit.order === state.habits.length - 1; down.setAttribute('aria-label', `Move ${habit.text} down`);
    const remove = button('Delete', () => {
      if (!habit.checked) { void onEdit({ kind: 'delete', id: habit.id, confirmed: false }); return; }
      const confirm = el('div', undefined, 'confirmation'); confirm.setAttribute('role', 'group');
      confirm.append(el('p', `Delete “${habit.text}”? It is completed for today.`));
      const yes = button('Delete completed habit', () => { void onEdit({ kind: 'delete', id: habit.id, confirmed: true }); });
      confirm.append(yes, button('Cancel', () => { confirm.remove(); remove.focus(); }));
      row.querySelector('.confirmation')?.remove(); row.append(confirm); yes.focus();
    }, `delete-${habit.id}`);
    controls.append(up, down, remove); row.append(controls); list.append(row);
  }
  if (!state.habits.length) section.append(el('p', 'No habits yet. Add one below.', 'muted'));
  section.append(list);
  const form = el('form', undefined, 'add-habit'); const label = el('label', 'New habit');
  const input = el('input'); input.type = 'text'; input.required = true; input.dataset.focus = 'new-habit'; label.append(input);
  const add = el('button', 'Add habit'); add.type = 'submit';
  form.append(label, add); form.onsubmit = event => { event.preventDefault(); void onEdit({ kind: 'add', text: input.value }); };
  section.append(form, button('Close tracker', back, 'close-tracker'));
  return section;
}
