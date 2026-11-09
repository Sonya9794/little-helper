import { listen } from '@tauri-apps/api/event';
import { invoke, button, el, type Snapshot, type Mode } from './api';
import { habitTracker } from './habits';
import { randomQuote } from './motivation';
interface Request { page: 'menu' | 'prompt' | 'saved' | 'habits' | 'motivation'; text: string | null; revision: number }

export async function panel(root: HTMLElement): Promise<void> {
  document.body.classList.add('panel');
  let data: Snapshot | null = null;
  let view: Request['page'] = 'menu';
  let selectedText = '', quote = '', revision = -1;
  let mode: Mode = 'normal';
  let promptDraft = '';
  let error = ''; let status = ''; let busy = false;
  let queue: Promise<void> = Promise.resolve(); let pending = 0;
  const back = () => { void perform(() => invoke('return_to_choices')); };
  function applyRequest(request: Request): void {
    if (request.revision === revision) return;
    revision = request.revision; view = request.page; selectedText = request.text ?? '';
    if (view === 'prompt') promptDraft = '';
    if (view === 'motivation') quote = randomQuote();
    error = ''; status = ''; render();
    root.querySelector<HTMLElement>('textarea, section input, section button')?.focus();
  }
  async function refresh(preserveDraft = false): Promise<void> {
    const previous = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const key = previous?.dataset.focus;
    const draft = preserveDraft && previous && (previous.tagName === 'TEXTAREA' || (previous.tagName === 'INPUT' && previous.type === 'text')) ? previous.value : null;
    [data, mode] = await Promise.all([invoke<Snapshot>('snapshot'), invoke<Mode>('get_mode')]); render();
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
    if (view !== 'menu') root.append(button('← Back to choices', back, 'back'));
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
        for (const [index, text] of [history.most_common, history.latest].entries()) {
          const choice = button('', () => { void perform(async () => { await invoke('submit_prompt', { text }); await invoke('open_detail', { page: 'saved', text }); }); }, `saved-${index}`);
          choice.className = 'prompt-choice'; choice.append(el('span', text, 'prompt-text')); section.append(choice);
        }
      }
      const other = button('Other…', () => { void perform(() => invoke('open_detail', { page: 'prompt', text: null })); }, 'other');
      section.append(other,
        button('Habit Tracker', () => { void perform(() => invoke('open_detail', { page: 'habits', text: null })); }, 'habits'),
        button('Motivation', () => { void perform(() => invoke('open_detail', { page: 'motivation', text: null })); }, 'motivation'));
      root.append(section);
    } else if (view === 'prompt') {
      const section = el('section'); section.append(el('h2', 'Save a prompt'));
      if (data.history_error) section.append(el('p', data.history_error, 'error'));
      else if (!data.history?.count) section.append(el('p', 'No saved prompts yet. Save your first prompt to add it to the choices around Little Helper.', 'muted'));
      const form = el('form'); const label = el('label', 'Prompt'); const input = el('textarea');
      input.rows = 7; input.required = true; input.dataset.focus = 'prompt-text'; label.append(input);
      input.value = promptDraft; input.oninput = () => { promptDraft = input.value; };
      const submit = el('button', 'Save prompt'); submit.type = 'submit'; submit.disabled = Boolean(data.history_error);
      form.append(label, submit, button('Cancel', back));
      form.onsubmit = event => { event.preventDefault(); void perform(async () => { await invoke('submit_prompt', { text: input.value }); promptDraft = ''; await invoke('return_to_choices'); }); };
      input.onkeydown = event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); } };
      section.append(form); root.append(section);
      const settings = el('section', undefined, 'mode-section'); const heading = el('h2', 'Mode'); heading.id = 'mode-label';
      const row = el('div', undefined, 'mode-slider'); const slider = el('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '1'; slider.value = mode === 'dvd' ? '1' : '0';
      slider.dataset.focus = 'mode'; slider.setAttribute('aria-labelledby', heading.id);
      slider.setAttribute('aria-valuetext', mode === 'dvd' ? 'DVD' : 'Normal');
      slider.oninput = () => { slider.setAttribute('aria-valuetext', slider.value === '1' ? 'DVD' : 'Normal'); };
      slider.onchange = () => {
        const next: Mode = slider.value === '1' ? 'dvd' : 'normal';
        void perform(() => invoke('set_mode', { mode: next }));
      };
      row.append(el('span', 'Normal'), slider, el('span', 'DVD'));
      settings.append(heading, row, el('p', 'DVD glides and bounces around this monitor. It pauses while you hover or use the menu. Close the panel and choices to watch it go.', 'muted'));
      root.append(settings);
    } else if (view === 'habits') {
      if (data.habit_error) root.append(el('p', data.habit_error, 'error'));
      if (data.habits) root.append(habitTracker(data.habits, edit => perform(() => invoke('edit_habit', { edit })), back));
    } else if (view === 'saved') {
      const section = el('section'); section.append(el('h2', 'Saved prompt'), el('p', selectedText, 'prompt-text saved-text'), el('p', 'Saved locally.', 'status'));
      root.append(section);
    } else if (view === 'motivation') {
      const section = el('section'); section.append(el('h2', 'Motivation'), el('blockquote', quote, 'quote'));
      section.append(button('Another quote', () => { quote = randomQuote(); render(); root.querySelector<HTMLElement>('[data-focus="another-quote"]')?.focus(); }, 'another-quote'));
      root.append(section);
    }
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (view === 'menu') void perform(() => invoke('hide_panel')); else back(); }
  });
  await listen<Request>('panel-opened', event => { applyRequest(event.payload); void perform(async () => {}); });
  await listen('local-error', () => { void perform(async () => {}); });
  await listen('date-check', () => { void perform(async () => {}); });
  await listen('mode-changed', () => { void refresh(true).catch(e => { error = String(e); render(); }); });
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
  render(); await refresh(); applyRequest(await invoke<Request>('panel_request'));
}
