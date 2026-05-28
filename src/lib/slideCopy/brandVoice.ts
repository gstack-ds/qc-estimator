export const BANNED_WORDS = ['decor', 'set up', 'tear down', 'stuff', 'things', 'party'];
export const SPARING_WORDS = ['curated', 'elevated', 'immersive', 'unforgettable', 'one-of-a-kind'];

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export function spellNumber(n: number): string {
  if (Number.isInteger(n) && n >= 0 && n <= 9) return ONES[n];
  return String(n);
}

export function oxfordComma(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function removeDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ');
}

export function formatCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function checkBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((w) => lower.includes(w));
}

export function checkSparingWords(text: string): string[] {
  const lower = text.toLowerCase();
  return SPARING_WORDS.filter((w) => lower.includes(w));
}

export function applyBrandVoice(text: string): string {
  return removeDashes(text);
}
