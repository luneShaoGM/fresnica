export function formatPublicAddress(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) {
    return normalized;
  }
  return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
}
