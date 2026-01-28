import { MIN_FACT_LENGTH } from "./constants";

export function isGarbageFact(text: string): boolean {
  if (!text) return true;
  if (text.length < MIN_FACT_LENGTH) return true;
  if (text.includes("may refer to")) return true;
  if (/^\w+\?$/.test(text)) return true;
  return false;
}

export function isInteresting(text: string): boolean {
  const keywords = [
    "first",
    "last",
    "discovered",
    "invented",
    "assassinated",
    "killed",
    "exploded",
    "war",
    "mystery",
    "secret",
    "lost",
    "forbidden",
  ];

  return keywords.some((k) => text.toLowerCase().includes(k));
}

export function isTooLong(text: string): boolean {
  // Approximate character limit based on screen real estate
  // Assuming ~20 chars per line, ~15-20 lines for half screen
  const MAX_CHARS = 350;
  return text.length > MAX_CHARS;
}
