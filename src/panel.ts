import { listen } from '@tauri-apps/api/event';
import { invoke, button, el, type Snapshot } from './api';
import { habitTracker } from './habits';

export async function panel(root: HTMLElement): Promise<void> {
  document.body.classList.add('panel');
  let data: Snapshot | null = null;
  let view: 'menu' | 'prompt' | 'habits' = 'menu';
  let error = ''; let status = ''; let busy = false;
  let queue: Promise<void> = Promise.resolve(); let pending = 0;
  const show = (next: typeof view) => { view = next; error = ''; status = ''; render(); root.querySelector<HTMLElement>('textarea, section input, section button')?.focus(); };
  async function refresh(preserveDraft = false): Promise<void> {
    const previous = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const key = previous?.dataset.focus;
    const draft = preserveDraft && previous && (previous.tagName === 'TEXTAREA' || (previous.tagName === 'INPUT' && previous.type === 'text')) ? previous.value : null;
    data = await invoke<Snapshot>('snapshot'); render();
    if (key) {
      const next = root.querySelector<HTMLInputElement>(`[data-focus="${CSS.escape(key)}"]`);
      if (next) { if (draft !== null) next.value = draft; next.focus(); }
      else root.querySelector<HTMLElement>('section input, section button')?.focus();
    }
  }
  function perform(action: () => Promise<unknown>, message = ''): Promise<void> {
    pending++; busy = true;
    queue = queue.then(async () => {
      error = ''; status = ''; root.setAttribute('aria-busy', 'true');
      try { await action(); status = message; await refresh(); }
      catch (e) { error = String(e); render(); }
      finally { pending--; busy = pending > 0; if (!busy) root.removeAttribute('aria-busy'); }
    });
    return queue;
  }
  function render(): void {
    root.replaceChildren();
    const header = el('header'); const title = el('div'); title.append(el('h1', 'Little Helper'), el('p', 'Offline · Saved only on this computer', 'muted'));
    header.append(title, button('Close', () => { void perform(() => invoke('hide_panel')); }, 'close-panel')); root.append(header);
    if (view !== 'menu') root.append(button('← Menu', () => show('menu'), 'back'));
    if (error) { const alert = el('p', error, 'error'); alert.setAttribute('role', 'alert'); root.append(alert); }
    if (status) { const note = el('p', status, 'status'); note.setAttribute('role', 'status'); root.append(note); }
    for (const notice of data?.notices ?? []) root.append(el('p', notice, 'error'));
    if (!data) { root.append(el('p', 'Loading local data…')); return; }
    if (view === 'menu') {
      const section = el('section', undefined, 'menu'); section.append(el('h2', 'Saved prompts'));
      if (data.history_error) section.append(el('p', data.history_error, 'error'));
      const history = data.history;
      if (history?.latest === null) section.append(el('p', 'No saved prompts yet. Choose Other… to save your first prompt.', 'muted'));
      if (history?.most_common != null && history.latest != null) {
        for (const [label, text] of [['Most common', history.most_common], ['Latest', history.latest]]) {
          const choice = button('', () => { void perform(() => invoke('submit_prompt', { text }), 'Saved locally.'); }, label === 'Latest' ? 'latest' : 'most-common');
          choice.className = 'prompt-choice'; choice.append(el('strong', label), el('span', text, 'prompt-text')); section.append(choice);
        }
      }
      const other = button('Other…', () => show('prompt'), 'other'); other.disabled = Boolean(data.history_error);
      section.append(other, button('Habit Tracker', () => { void perform(async () => { data = await invoke('snapshot'); view = 'habits'; }); }, 'habits'));
      root.append(section);
    } else if (view === 'prompt') {
      const section = el('section'); section.append(el('h2', 'Save a prompt'));
      const form = el('form'); const label = el('label', 'Prompt'); const input = el('textarea');
      input.rows = 7; input.required = true; input.dataset.focus = 'prompt-text'; label.append(input);
      const submit = el('button', 'Save prompt'); submit.type = 'submit';
      form.append(label, submit, button('Cancel', () => show('menu')));
      form.onsubmit = event => { event.preventDefault(); void perform(async () => { await invoke('submit_prompt', { text: input.value }); view = 'menu'; }, 'Saved locally.'); };
      input.onkeydown = event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); } };
      section.append(form); root.append(section);
    } else {
      if (data.habit_error) root.append(el('p', data.habit_error, 'error'));
      if (data.habits) root.append(habitTracker(data.habits, edit => perform(() => invoke('edit_habit', { edit })), () => show('menu')));
    }
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (view === 'menu') void perform(() => invoke('hide_panel')); else show('menu'); }
  });
  await listen('panel-opened', () => { view = 'menu'; error = ''; status = ''; void perform(async () => {}); });
  await listen('local-error', () => { void perform(async () => {}); });
  await listen('date-check', () => { void perform(async () => {}); });
  window.addEventListener('focus', () => { void refresh(true).catch(e => { error = String(e); render(); }); });
  // A date comparison, not an assumption that a midnight timer always ran.
  setInterval(() => {
    if (busy || document.hidden) return;
    void invoke<Snapshot>('snapshot').then(next => {
      if (next.habits?.date !== data?.habits?.date || next.habit_error !== data?.habit_error) void refresh(true);
    }).catch(e => { error = String(e); render(); });
  }, 15_000);
  function scheduleMidnight(): void {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setTimeout(() => {
      void refresh(true).catch(e => { error = String(e); render(); });
      scheduleMidnight();
    }, next.getTime() - now.getTime() + 25);
  }
  scheduleMidnight();
  render(); await refresh();
}
