export function rewriteFact(text: string, year?: string): string {
  let cleaned = text.replace(/\s*\([^)]*\)/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (year && !cleaned.startsWith(year)) {
    return `${cleaned}`;
  }

  return cleaned;
}
