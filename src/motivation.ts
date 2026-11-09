// Original short encouragements, bundled locally. No attribution or network fetch.
export const QUOTES = [
  'A small step is still a step forward.',
  'You can begin again from where you are.',
  'Give the next ten minutes a chance.',
  'Progress can be quiet and still be real.',
  'Make room for one thing that matters today.',
  'Rest is part of looking after your future self.',
  'A difficult day does not erase your effort.',
  'Start with the part that feels manageable.',
  'Your pace is allowed to be your own.',
  'One finished task can make the next one lighter.',
  'Curiosity is a good reason to try.',
  'You do not need a perfect plan to take a useful step.',
  'Practice gives tomorrow something to build on.',
  'Leave a little space for something you enjoy.',
  'The work you do today can be simple and worthwhile.',
  'A pause can help you choose your next step.',
  'Notice what you have already made possible.',
  'Learning counts, even before the result arrives.',
  'Choose a kind next step for yourself.',
  'There is value in showing up for a little while.',
] as const;
export function randomQuote(random: () => number = Math.random): string {
  return QUOTES[Math.floor(random() * QUOTES.length)];
}
