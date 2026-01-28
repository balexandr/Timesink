import { Asset } from "expo-asset";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import { FeedItem, generateFeed } from "./feed";

interface UseFeedPrefetchOptions {
  initialCount?: number;
  prefetchCount?: number;
  queueMinSize?: number;
  prefetchInterval?: number;
}

// Preload the placeholder image
const PLACEHOLDER = require("../(tabs)/assets/history_placeholder.png");
let placeholderPreloaded = false;

const preloadPlaceholder = async (): Promise<void> => {
  if (placeholderPreloaded) return;

  try {
    await Asset.fromModule(PLACEHOLDER).downloadAsync();
    placeholderPreloaded = true;
    console.log("✅ Placeholder image preloaded");
  } catch (error) {
    console.warn("⚠️ Failed to preload placeholder:", error);
  }
};

// Preload images into memory
const preloadImage = (uri: string): Promise<void> => {
  return new Promise((resolve) => {
    Image.prefetch(uri)
      .then(() => {
        resolve();
      })
      .catch((error) => {
        console.warn(`⚠️ Failed to preload image: ${error}`);
        resolve(); // Don't fail the whole operation
      });
  });
};

export function useFeedPrefetch({
  initialCount = 20,
  prefetchCount = 10,
  queueMinSize = 15,
  prefetchInterval = 3000,
}: UseFeedPrefetchOptions = {}) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const seenFacts = useRef(new Set<string>());
  const prefetchQueue = useRef<FeedItem[]>([]);
  const isPrefetching = useRef(false);
  const lastLoadTime = useRef(0);

  // Background prefetch function with image preloading
  const prefetchItems = useCallback(async () => {
    if (isPrefetching.current) {
      console.log("⏸️ Already prefetching, skipping");
      return;
    }

    isPrefetching.current = true;
    console.log("🔄 Starting prefetch...");

    try {
      const newItems = await generateFeed(prefetchCount, false);

      const uniqueItems = newItems.filter((item) => {
        if (seenFacts.current.has(item.fact)) {
          return false;
        }
        seenFacts.current.add(item.fact);
        return true;
      });

      console.log(`Got ${uniqueItems.length} unique items from ${newItems.length} total`);

      // Start preloading images but don't wait for them
      uniqueItems.forEach((item) => {
        if (item.imageUri) {
          preloadImage(item.imageUri); // Fire and forget
        }
      });

      // Add to queue immediately
      prefetchQueue.current.push(...uniqueItems);
      console.log(
        `✅ Prefetch complete. Queue: ${prefetchQueue.current.length} items`
      );
    } catch (e) {
      console.error("❌ Failed to prefetch", e);
    } finally {
      isPrefetching.current = false;
    }
  }, [prefetchCount]);

  // Initial load - preload placeholder first, then load feed
  useEffect(() => {
    const loadFeed = async () => {
      try {
        // Preload placeholder first
        await preloadPlaceholder();

        // Load just 5 items initially for quick display
        const items = await generateFeed(5, false);
        items.forEach((item) => seenFacts.current.add(item.fact));

        // Start preloading images but don't wait
        items.forEach((item) => {
          if (item.imageUri) {
            preloadImage(item.imageUri);
          }
        });

        console.log(`Initial feed loaded: ${items.length} items`);
        setFeed(items);
        setLoading(false);

        // Then immediately start prefetching more
        prefetchItems();
      } catch (e) {
        console.error("Failed to load feed", e);
        setLoading(false);
      }
    };

    loadFeed();
  }, [prefetchItems]);

  // Continuous background prefetching
  useEffect(() => {
    const interval = setInterval(() => {
      if (prefetchQueue.current.length < queueMinSize && !isPrefetching.current) {
        console.log(
          `📊 Queue low (${prefetchQueue.current.length}), triggering prefetch`
        );
        prefetchItems();
      }
    }, prefetchInterval);

    return () => clearInterval(interval);
  }, [prefetchItems, queueMinSize, prefetchInterval]);

  const loadMore = useCallback(() => {
    const now = Date.now();
    // Debounce: only allow one load per 200ms
    if (now - lastLoadTime.current < 200) {
      console.log("⏸️ Debouncing loadMore");
      return;
    }
    lastLoadTime.current = now;

    console.log(
      `📥 loadMore called - Queue: ${prefetchQueue.current.length}`
    );

    // Pull from prefetch queue
    const itemsToAdd = prefetchQueue.current.splice(0, 5);

    if (itemsToAdd.length > 0) {
      console.log(`Adding ${itemsToAdd.length} items from queue`);
      setFeed((prevFeed) => {
        const newFeed = [...prevFeed, ...itemsToAdd];
        console.log(`✅ Feed updated: ${prevFeed.length} -> ${newFeed.length}`);
        return newFeed;
      });

      // Trigger prefetch if queue is getting low
      if (prefetchQueue.current.length < 10 && !isPrefetching.current) {
        console.log("🔄 Queue running low, triggering prefetch");
        prefetchItems();
      }
    } else {
      console.log("⚠️ No items in queue! Triggering emergency prefetch");
      prefetchItems();
    }
  }, [prefetchItems]);

  return {
    feed,
    loading,
    loadMore,
    queueSize: prefetchQueue.current.length,
  };
}