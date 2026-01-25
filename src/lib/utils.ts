/**
 * Utility functions
 */

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  if (!name || name.trim() === "") return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return name.substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Combine class names (simplified cn function)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
