export function slugify(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `item-${Date.now().toString(36)}`;
}

export function splitList(value: string): string[] {
  return value
    .split(/[,،\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
