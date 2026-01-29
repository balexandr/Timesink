import { fetchUnsplashImage } from "../images/unsplash";
import { fetchTodayInHistory } from "../souces/today";
import { fetchWikipediaFact } from "../souces/wikipedia";
import { generateId } from "../utils/id";
import { MAX_SOURCE_ATTEMPTS } from "./constants";
import { isGarbageFact, isInteresting, isTooLong } from "./filters";
import { rewriteFact } from "./rewrite";
import { FeedItem, RawFact } from "./types";

export async function generateFeed(
  count: number,
  unsplashDisabled = false,
): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  while (items.length < count) {
    let raw: RawFact | null = null;
    let attempts = 0;

    while (!raw && attempts < MAX_SOURCE_ATTEMPTS) {
      attempts++;
      try {
        raw =
          Math.random() > 0.5
            ? await fetchWikipediaFact()
            : await fetchTodayInHistory();

        if (isGarbageFact(raw.text) || !isInteresting(raw.text) || isTooLong(raw.text)) {
          raw = null;
        }
      } catch {
        raw = null;
      }
    }

    if (!raw) continue;

    const title = rewriteFact(raw.text, raw.year);
    const imageData = unsplashDisabled ? { uri: "" } : await fetchUnsplashImage(title);

    items.push({
      id: generateId(),
      year: raw.year ?? "",
      title,
      fact: raw.text,
      source: raw.source,
      imageUri: imageData.uri,
      unsplashAttribution: imageData.attribution,
    });
  }

  return items;
}
export { FeedItem };
