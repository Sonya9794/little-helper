import test from 'node:test';
import assert from 'node:assert/strict';
import { Blackjack, total, shuffledDeck } from '../src/blackjack-game.ts';
import { menuChoices } from '../src/menu-model.ts';

function deck(...ranks) {
  const rest = [];
  for (const suit of ['clubs','diamonds','hearts','spades']) for (let rank=1;rank<=13;rank++) rest.push({rank,suit});
  const first = ranks.map(rank => { const i=rest.findIndex(card=>card.rank===rank); assert.notEqual(i,-1); return rest.splice(i,1)[0]; });
  return [...first,...rest];
}
test('Games replaces the chess shortcut and shows only games plus directional Back',()=>{
  const main = menuChoices('main',null); assert.equal(main.at(-1).label,'Games'); assert.equal(main.at(-1).arrow,'right'); assert.deepEqual(main.at(-1).action,{type:'group',group:'games'});
  const games = menuChoices('games',{most_common:'Task',latest:'Prompt',count:2});
  assert.deepEqual(games.map(c=>c.label),['Chess','Blackjack','Back']); assert.equal(games.at(-1).arrow,'left');
  assert.deepEqual(games.map(c=>c.action),[{type:'chess'},{type:'blackjack'},{type:'group',group:'main'}]);
});
test('shuffled deck has exactly 52 distinct valid cards',()=>{
  const cards=shuffledDeck(); assert.equal(cards.length,52); assert.equal(new Set(cards.map(c=>`${c.suit}-${c.rank}`)).size,52);
});
test('ace totals handle soft, hard, multiple aces, and busts',()=>{
  const hand=(...ranks)=>ranks.map(rank=>({rank,suit:'hearts'}));
  assert.deepEqual(total(hand(1,6)),{value:17,soft:true}); assert.deepEqual(total(hand(1,1,9)),{value:21,soft:true});
  assert.deepEqual(total(hand(1,6,10)),{value:17,soft:false}); assert.equal(total(hand(13,12,2)).value,22);
});
test('deal reserves chips, alternates hands, and rejects invalid bets/decks without mutation',()=>{
  const g=new Blackjack(); for(const bet of [0,-1,1.5,NaN,Infinity,1001]) assert.throws(()=>g.deal(bet,deck()));
  const duplicate=deck();duplicate[1]=duplicate[0];assert.throws(()=>g.deal(10,duplicate)); assert.equal(g.balance,1000);
  g.deal(10,deck(10,9,7,8)); assert.equal(g.balance,990); assert.equal(g.active,true); assert.equal(total(g.player).value,17);
  const before=JSON.stringify(g);assert.throws(()=>g.deal(10,deck()));assert.throws(()=>g.reset());assert.equal(JSON.stringify(g),before);
});
test('natural blackjack pays 3:2 including half chips; both naturals push and dealer natural wins immediately',()=>{
  const g=new Blackjack();g.deal(5,deck(1,9,13,8));assert.equal(g.result,'blackjack');assert.equal(g.balance,1007.5);
  const push=new Blackjack();push.deal(10,deck(1,1,10,13));assert.equal(push.result,'push');assert.equal(push.balance,1000);
  const loss=new Blackjack();loss.deal(10,deck(10,1,9,13));assert.equal(loss.result,'loss');assert.equal(loss.balance,990);
});
test('dealer stands on soft 17, draws below 17, and pays normal wins and pushes',()=>{
  const soft=new Blackjack();soft.deal(10,deck(10,1,8,6,10));soft.stand();assert.equal(soft.dealer.length,2);assert.equal(soft.result,'win');assert.equal(soft.balance,1010);
  const draw=new Blackjack();draw.deal(10,deck(10,9,8,6,2));draw.stand();assert.equal(draw.dealer.length,3);assert.equal(draw.result,'win');
  const push=new Blackjack();push.deal(10,deck(10,10,8,8));push.stand();assert.equal(push.result,'push');assert.equal(push.balance,1000);
});
test('player bust settles once without drawing dealer; hit to 21 auto-stands',()=>{
  const bust=new Blackjack();bust.deal(10,deck(10,9,8,7,5));bust.hit();assert.equal(bust.result,'bust');assert.equal(bust.balance,990);assert.equal(bust.dealer.length,2);
  for(const action of ['hit','stand','double']) assert.throws(()=>bust[action]());assert.equal(bust.balance,990);
  const twentyone=new Blackjack();twentyone.deal(10,deck(10,10,5,8,6));twentyone.hit();assert.equal(twentyone.result,'win');assert.equal(twentyone.balance,1010);
});
test('dealer bust and higher dealer total settle correctly',()=>{
  const bust=new Blackjack();bust.deal(10,deck(10,10,8,6,10));bust.stand();assert.equal(bust.result,'win');
  const loss=new Blackjack();loss.deal(10,deck(10,10,7,9));loss.stand();assert.equal(loss.result,'loss');assert.equal(loss.balance,990);
});
test('Double reserves one additional bet, draws one card, auto-stands, and pays doubled stake',()=>{
  const g=new Blackjack();g.deal(10,deck(5,10,6,8,10));assert.equal(g.canDouble,true);g.double();assert.equal(g.bet,20);assert.equal(g.player.length,3);assert.equal(g.result,'win');assert.equal(g.balance,1020);assert.equal(g.canDouble,false);
  const bust=new Blackjack();bust.deal(10,deck(10,9,8,8,6));bust.double();assert.equal(bust.result,'bust');assert.equal(bust.balance,980);
});
test('Double is blocked after Hit or with insufficient chips, including an all-in bet',()=>{
  const g=new Blackjack();g.deal(10,deck(2,10,3,8,2));g.hit();assert.equal(g.canDouble,false);assert.throws(()=>g.double());
  const all=new Blackjack();all.deal(1000,deck(10,10,8,9));assert.equal(all.canDouble,false);assert.throws(()=>all.double());all.stand();assert.equal(all.balance,0);assert.throws(()=>all.deal(1));
  all.reset();assert.equal(all.balance,1000);assert.equal(all.player.length,0);assert.equal(all.result,null);assert.equal(all.bet,0);
});
