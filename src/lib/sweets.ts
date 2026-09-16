// Available sweet categories. English slugs are stored in Postgres as text[].

export interface Sweet {
  slug: string;
  label: string;
  emoji: string;
}

export const SWEETS: Sweet[] = [
  { slug: 'chocolate', label: 'Chocolates', emoji: '🍫' },
  { slug: 'gummies', label: 'Gomas', emoji: '🍬' },
  { slug: 'hard_candy', label: 'Rebuçados', emoji: '🍭' },
  { slug: 'cookies', label: 'Bolachas', emoji: '🍪' },
  { slug: 'savory_snacks', label: 'Snacks salgados', emoji: '🥨' },
  { slug: 'other', label: 'Outros', emoji: '🎃' },
];

export function sweetLabel(slug: string): string {
  return SWEETS.find((s) => s.slug === slug)?.label ?? slug;
}

export function sweetEmoji(slug: string): string {
  return SWEETS.find((s) => s.slug === slug)?.emoji ?? '🍬';
}
