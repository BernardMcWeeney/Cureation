/**
 * Shared category color mappings for news, blog, and content cards.
 * Each value is a Tailwind class string for bg + text + border.
 */

export const categoryColors: Record<string, string> = {
  news: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  reviews: 'bg-green-500/20 text-green-400 border-green-500/40',
  interviews: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
  rumors: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  editorials: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  history: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  analysis: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
};

export const defaultCategoryColor = 'bg-white/10 text-primary border-primary/40';

export function getCategoryColor(category: string): string {
  return categoryColors[category] || defaultCategoryColor;
}
