/**
 * Generate initials from a display name
 * - If name has multiple words (space-separated), use first letter of first and last word
 *   e.g., "Charlotte Fangrad" → "CF", "John Paul Smith" → "JS"
 * - If name is a single word, use first two letters
 *   e.g., "Charlotte" → "CH"
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  
  const words = trimmed.split(/\s+/);
  
  if (words.length >= 2) {
    // Multiple words: first letter of first word + first letter of last word
    const first = words[0][0] || '';
    const last = words[words.length - 1][0] || '';
    return (first + last).toUpperCase();
  }
  
  // Single word: first two letters
  return trimmed.substring(0, 2).toUpperCase();
}

