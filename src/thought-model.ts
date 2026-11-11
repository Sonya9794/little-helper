export interface ThoughtSettings { version: 1; enabled: boolean; jokes: boolean; facts: boolean; motivation: boolean; min_minutes:number; max_minutes:number }
export const THOUGHTS = {
  jokes: [
    'I tried to organize my thoughts. They requested separate folders.',
    'My workout today was jumping to conclusions. Tiny jumps, obviously.',
    'I have a great memory. I just cannot remember where I put it.',
    'I would tell you a construction joke, but I am still building it.',
    'My calendar is very popular. Every day has a date.',
    'I opened a bakery for computers. Everything comes with cookies.',
    'I am a desktop helper, which means my commute is measured in pixels.',
    'I asked the chessboard for advice. It said to make my move.',
    'I made a belt out of clocks. It was a waist of time.',
    'I have no pockets. This is terrible news for my emergency snacks.',
  ],
  facts: [
    'A standard chessboard has 64 squares.',
    'A triangle has three sides.',
    'Two is the only even prime number.',
    'An hour contains 3,600 seconds.',
    'A standard deck has 52 playing cards, excluding jokers.',
    'An octagon has eight sides.',
    'A square is also a rectangle: all four of its angles are right angles.',
    'Zero is an even number.',
    'The sum of the interior angles of a flat triangle is 180 degrees.',
    'A byte contains eight bits.',
  ],
  motivation: [
    'You do not have to finish everything to make progress.',
    'One small task is a perfectly good place to start.',
    'Your next attempt can be different from your last one.',
    'Make a little room for something you enjoy today.',
    'A short pause can help you see the next step.',
    'Done with care beats an imaginary perfect start.',
    'Learning a little still counts as learning.',
    'Try making the next step smaller.',
    'You can be proud of the effort nobody else sees.',
    'Future you might appreciate one small kindness from present you.',
  ],
} as const;
export function thoughtPool(settings: ThoughtSettings): string[] {
  if (!settings.enabled) return [];
  return (['jokes','facts','motivation'] as const).flatMap(category => settings[category] ? [...THOUGHTS[category]] : []);
}
export function chooseThought(settings: ThoughtSettings, random: number): string | null {
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw Error('Random sample must be in [0, 1).');
  const pool = thoughtPool(settings); return pool.length ? pool[Math.floor(random * pool.length)] : null;
}
