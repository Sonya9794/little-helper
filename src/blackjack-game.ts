export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export interface Card { rank: number; suit: Suit }
export type Result = 'blackjack' | 'win' | 'loss' | 'push' | 'bust';
export function total(cards: readonly Card[]): { value: number; soft: boolean } {
  let value = cards.reduce((sum, card) => sum + Math.min(card.rank, 10), 0);
  const soft = cards.some(card => card.rank === 1) && value + 10 <= 21;
  if (soft) value += 10;
  return { value, soft };
}
export function cardText(card: Card): string {
  const rank = ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[card.rank] ?? String(card.rank);
  return `${rank}${{ clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[card.suit]}`;
}
// Rejection sampling avoids modulo bias. Only local operating-system randomness is used.
export function shuffledDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const)
    for (let rank = 1; rank <= 13; rank++) cards.push({ rank, suit });
  const sample = new Uint32Array(1);
  for (let i = cards.length - 1; i > 0; i--) {
    const bound = i + 1, limit = Math.floor(0x100000000 / bound) * bound;
    do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
    const j = sample[0] % bound;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export class Blackjack {
  balance = 1000;
  bet = 0;
  player: Card[] = [];
  dealer: Card[] = [];
  result: Result | null = null;
  private deck: Card[] = [];
  private cursor = 0;
  private doubled = false;
  get active(): boolean { return this.player.length > 0 && this.result === null; }
  get canDouble(): boolean { return this.active && this.player.length === 2 && !this.doubled && this.balance >= this.bet; }
  deal(bet: number, deck: readonly Card[] = shuffledDeck()): void {
    if (this.active) throw new Error('Finish this round before dealing again.');
    if (!Number.isSafeInteger(bet) || bet < 1 || bet > this.balance) throw new Error('Enter a whole-chip bet between 1 and your available chips.');
    const identities = deck.map(card => `${card.suit}-${card.rank}`);
    if (deck.length !== 52 || new Set(identities).size !== 52 || deck.some(card => !Number.isInteger(card.rank) || card.rank < 1 || card.rank > 13 || !['clubs','diamonds','hearts','spades'].includes(card.suit)))
      throw new Error('A complete, unique 52-card deck is required.');
    this.deck = deck.map(card => ({ ...card })); this.cursor = 0;
    this.balance -= bet; this.bet = bet; this.doubled = false; this.result = null;
    this.player = []; this.dealer = [];
    this.player.push(this.draw()); this.dealer.push(this.draw());
    this.player.push(this.draw()); this.dealer.push(this.draw());
    const playerNatural = total(this.player).value === 21, dealerNatural = total(this.dealer).value === 21;
    if (playerNatural || dealerNatural) this.settle(playerNatural && dealerNatural ? 'push' : playerNatural ? 'blackjack' : 'loss');
  }
  hit(): void {
    this.requireActive(); this.player.push(this.draw());
    const value = total(this.player).value;
    if (value > 21) this.settle('bust');
    else if (value === 21) this.stand();
  }
  stand(): void {
    this.requireActive();
    while (total(this.dealer).value < 17) this.dealer.push(this.draw());
    const player = total(this.player).value, dealer = total(this.dealer).value;
    this.settle(dealer > 21 || player > dealer ? 'win' : player === dealer ? 'push' : 'loss');
  }
  double(): void {
    if (!this.canDouble) throw new Error('Double is available only on your first two cards with enough chips.');
    this.balance -= this.bet; this.bet *= 2; this.doubled = true;
    this.player.push(this.draw());
    if (total(this.player).value > 21) this.settle('bust'); else this.stand();
  }
  reset(): void {
    if (this.active) throw new Error('Finish this round before resetting chips.');
    this.balance = 1000; this.bet = 0; this.player = []; this.dealer = []; this.result = null;
    this.deck = []; this.cursor = 0; this.doubled = false;
  }
  private requireActive(): void { if (!this.active) throw new Error('Deal a new round first.'); }
  private draw(): Card {
    const card = this.deck[this.cursor++];
    if (!card) throw new Error('The deck has run out of cards.');
    return { ...card };
  }
  private settle(result: Result): void {
    this.result = result;
    this.balance += result === 'blackjack' ? this.bet * 2.5 : result === 'win' ? this.bet * 2 : result === 'push' ? this.bet : 0;
  }
}
