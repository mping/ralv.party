// Categorias de doces disponíveis (slugs guardados na BD como text[]).

export interface Sweet {
  slug: string;
  label: string;
  emoji: string;
}

export const SWEETS: Sweet[] = [
  { slug: 'chocolates', label: 'Chocolates', emoji: '🍫' },
  { slug: 'gomas', label: 'Gomas', emoji: '🍬' },
  { slug: 'rebucados', label: 'Rebuçados', emoji: '🍭' },
  { slug: 'bolachas', label: 'Bolachas', emoji: '🍪' },
  { slug: 'salgados', label: 'Snacks salgados', emoji: '🥨' },
  { slug: 'outros', label: 'Outros', emoji: '🎃' },
];

export function sweetLabel(slug: string): string {
  return SWEETS.find((s) => s.slug === slug)?.label ?? slug;
}

export function sweetEmoji(slug: string): string {
  return SWEETS.find((s) => s.slug === slug)?.emoji ?? '🍬';
}
