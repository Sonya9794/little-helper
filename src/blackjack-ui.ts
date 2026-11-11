import { button, el, invoke } from './api';
import { Blackjack, cardText, total, type Card } from './blackjack-game';

export async function blackjackUI(root: HTMLElement): Promise<void> {
  document.body.classList.add('blackjack');
  const game = new Blackjack(); let bet = '10', error = '', resetting = false;
  const chips = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  function act(action: () => void): void {
    try { error = ''; action(); } catch (cause) { error = String(cause instanceof Error ? cause.message : cause); }
    render(); root.querySelector<HTMLElement>(game.active ? '[data-focus=blackjack-hit]' : '[data-focus=blackjack-deal]')?.focus();
  }
  async function back(): Promise<void> {
    try { await invoke('close_blackjack'); } catch (cause) { error = String(cause); render(); }
  }
  function hand(title: string, cards: readonly Card[], hidden: boolean): HTMLElement {
    const section = el('section', undefined, 'blackjack-hand'); section.append(el('h2', title));
    const row = el('div', undefined, 'blackjack-cards');
    for (const [index, card] of cards.entries()) {
      const concealed = hidden && index === 1;
      const node = el('span', concealed ? '?' : cardText(card), `playing-card${concealed ? ' card-hidden' : card.suit === 'hearts' || card.suit === 'diamonds' ? ' card-red' : ''}`);
      node.setAttribute('role', 'img'); node.setAttribute('aria-label', concealed ? 'Face-down card' : `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' } as Record<number,string>)[card.rank] ?? card.rank} of ${card.suit}`);
      row.append(node);
    }
    if (!cards.length) row.append(el('p', 'Waiting for a deal…', 'muted'));
    section.append(row);
    if (cards.length) section.append(el('p', hidden ? `Showing: ${total(cards.slice(0,1)).value}` : `Total: ${total(cards).value}${total(cards).soft ? ' (soft)' : ''}`, 'hand-total'));
    return section;
  }
  function render(): void {
    root.replaceChildren(); const header = el('header');
    header.append(el('h1', 'Blackjack'), button('← Back to Games', () => { void back(); })); root.append(header);
    root.append(el('p', 'Offline · Play-money chips only · Session resets when you quit the app', 'muted'));
    const summary = el('div', undefined, 'blackjack-summary');
    summary.append(el('strong', `Chips: ${chips(game.balance)}`), el('span', `Round bet: ${chips(game.bet)}`)); root.append(summary);
    if (error) { const alert = el('p', error, 'error'); alert.setAttribute('role', 'alert'); root.append(alert); }
    const table = el('div', undefined, 'blackjack-table');
    table.append(hand('Dealer', game.dealer, game.active), hand('Your Hand', game.player, false));
    const status = el('p', game.active ? 'Your move.' : game.result ? ({blackjack:'Blackjack! You win 3:2.',win:'You win!',loss:'Dealer wins.',push:'Push — your bet is returned.',bust:'Bust! Dealer wins.'}[game.result]) : 'Choose a bet and deal your first round.', 'blackjack-result');
    status.setAttribute('role', 'status'); table.append(status); root.append(table);
    const controls = el('div', undefined, 'blackjack-controls');
    if (game.active) {
      const double = button('Double', () => act(() => game.double()), 'blackjack-double'); double.disabled = !game.canDouble;
      controls.append(button('Hit', () => act(() => game.hit()), 'blackjack-hit'), button('Stand', () => act(() => game.stand()), 'blackjack-stand'), double);
    } else {
      const form = el('form'); const label = el('label', 'Bet (chips)'); const input = el('input');
      input.type = 'number'; input.min = '1'; input.max = String(Math.floor(game.balance)); input.step = '1'; input.required = true; input.value = bet; input.disabled = resetting; input.dataset.focus = 'blackjack-bet';
      input.oninput = () => { bet = input.value; }; label.append(input);
      const deal = el('button', game.player.length ? 'Deal Next Round' : 'Deal'); deal.type = 'submit'; deal.dataset.focus = 'blackjack-deal'; deal.disabled = resetting || game.balance < 1;
      form.append(label, deal); form.onsubmit = event => { event.preventDefault(); act(() => game.deal(Number(bet))); }; controls.append(form);
      if (game.balance < 1) controls.append(el('p', 'No whole chips left. Reset chips to play again.'));
      const reset = button('Reset Chips', () => { resetting = true; render(); root.querySelector<HTMLButtonElement>('[data-focus=blackjack-reset-cancel]')?.focus(); }); reset.disabled = resetting; controls.append(reset);
    }
    root.append(controls);
    if (resetting) {
      const confirm = el('section', undefined, 'blackjack-reset'); confirm.setAttribute('aria-label','Confirm chip reset');
      confirm.append(el('p','Reset your session to 1,000 play-money chips?'), button('Cancel', () => { resetting = false; render(); }, 'blackjack-reset-cancel'), button('Confirm Reset', () => act(() => { game.reset(); bet = '10'; resetting = false; })));
      root.append(confirm);
    }
    const rules = el('details'); rules.append(el('summary','Rules & Session'));
    rules.append(el('p','One fresh 52-card deck per round. Aces count as 1 or 11. Dealer stands on all 17s, including soft 17. A two-card blackjack pays 3:2; ordinary wins pay 1:1; ties return your bet. Dealer blackjack is checked immediately. Double on your first two cards costs another bet and deals exactly one card. No splits, insurance, or surrender. Whole-chip bets may win half-chip payouts.'));
    rules.append(el('p','Closing this window, going Back, or minimizing to tray preserves the round for this app session. Quitting the app resets the round and chips; no Blackjack file is saved.'));
    root.append(rules);
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); if (resetting) { resetting = false; render(); } else void back(); } });
  render();
}
