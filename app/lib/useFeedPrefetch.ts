import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import { FeedItem, generateFeed } from "./feed";

const ACCESS_KEY = "4K5y4QovQEXF1QDeoauur6Pwf8qKm8rjBQ5N4jwhJJA";
const RATE_LIMIT_KEY = "unsplash:rateLimit";
const MAX_REQUESTS_PER_HOUR = 50;

export interface UnsplashAttribution {
  photographerName: string;
  photographerUrl: string;
  imageUrl: string;
}

interface RateLimitData {
  count: number;
  resetTime: number;
}

async function getRateLimitData(): Promise<RateLimitData> {
  try {
    const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (!data) {
      return { count: 0, resetTime: Date.now() + 60 * 60 * 1000 };
    }
    return JSON.parse(data);
  } catch {
    return { count: 0, resetTime: Date.now() + 60 * 60 * 1000 };
  }
}

async function updateRateLimitData(data: RateLimitData): Promise<void> {
  await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

async function canMakeRequest(): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const data = await getRateLimitData();
  const now = Date.now();

  if (now >= data.resetTime) {
    const newData: RateLimitData = {
      count: 0,
      resetTime: now + 60 * 60 * 1000,
    };
    await updateRateLimitData(newData);
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR, resetTime: newData.resetTime };
  }

  if (data.count >= MAX_REQUESTS_PER_HOUR) {
    const minutesUntilReset = Math.ceil((data.resetTime - now) / 60000);
    console.log(`🚫 Unsplash rate limit reached (${data.count}/${MAX_REQUESTS_PER_HOUR}). Resets in ${minutesUntilReset} minutes.`);
    return { allowed: false, remaining: 0, resetTime: data.resetTime };
  }

  return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - data.count, resetTime: data.resetTime };
}

async function incrementRequestCount(): Promise<void> {
  const data = await getRateLimitData();
  data.count += 1;
  await updateRateLimitData(data);
  console.log(`📊 Unsplash API calls: ${data.count}/${MAX_REQUESTS_PER_HOUR} this hour`);
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

// Extract meaningful keywords from the fact text
function extractSearchQuery(text: string): string {
  // Remove common words and extract key nouns/concepts
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'was', 'were', 'is', 'are', 'been', 'being'];
  
  // Extract words, remove stopwords, take first 2-3 meaningful words
  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .slice(0, 3);
  
  // If we found meaningful words, use them
  if (words.length > 0) {
    const query = words.join(' ');
    console.log(`🔍 Extracted search query: "${query}" from text: "${text.substring(0, 60)}..."`);
    return query;
  }
  
  // Fallback to generic historical image
  console.log(`⚠️ Could not extract keywords, using fallback query`);
  return 'historical monument';
}

export async function fetchUnsplashImage(query: string): Promise<{ uri: string; attribution?: UnsplashAttribution }> {
  // Extract better search terms from the full text
  const searchQuery = extractSearchQuery(query);
  const cacheKey = `unsplash:${searchQuery}`;
  
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (typeof parsed === 'object' && 'uri' in parsed) {
        console.log(`💾 Cache hit for "${searchQuery}"`);
        return parsed;
      }
      console.log(`🔄 Old cache format for "${searchQuery}", clearing...`);
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.log(`🗑️ Invalid cache for "${searchQuery}", clearing...`);
      await AsyncStorage.removeItem(cacheKey);
    }
  }

  const rateLimitStatus = await canMakeRequest();
  if (!rateLimitStatus.allowed) {
    console.log(`⏸️ Skipping Unsplash request - rate limit reached (${rateLimitStatus.remaining} remaining)`);
    return { uri: "" };
  }

  try {
    const params = new URLSearchParams({
      query: searchQuery,
      orientation: "portrait",
      client_id: ACCESS_KEY,
    });

    const url = `https://api.unsplash.com/photos/random?${params}`;
    console.log(`🌐 Fetching from Unsplash: ${url}`);
    
    const response = await fetch(url);

    await incrementRequestCount();

    console.log(`📡 Unsplash response status: ${response.status}`);

    if (response.status === 403) {
      console.log("🚫 Unsplash API returned 403 - rate limit exceeded on their end");
      return { uri: "" };
    }

    if (response.status === 404) {
      console.log(`🔍 No images found for "${searchQuery}" - will show placeholder`);
      const emptyResult = { uri: "" };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(emptyResult));
      return emptyResult;
    }

    if (!response.ok) {
      console.warn(`⚠️ Unsplash API error ${response.status} for "${searchQuery}"`);
      return { uri: "" };
    }

    const data = await response.json();
    console.log(`📦 Unsplash data received:`, {
      id: data.id,
      hasUrls: !!data.urls,
      regularUrl: data.urls?.regular?.substring(0, 50),
      hasUser: !!data.user,
    });
    
    const uri = data?.urls?.regular ?? "";

    if (uri) {
      const result = {
        uri,
        attribution: {
          photographerName: data.user?.name || "Unknown",
          photographerUrl: `${data.user?.links?.html}?utm_source=timesink&utm_medium=referral`,
          imageUrl: `${data.links?.html}?utm_source=timesink&utm_medium=referral`,
        },
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      console.log(`✅ Fetched and cached image for "${searchQuery}": ${uri.substring(0, 60)}...`);
      return result;
    }

    console.log(`⚠️ No URL in response for "${searchQuery}"`);
    return { uri: "" };
  } catch (error) {
    console.warn(`⚠️ Failed to fetch Unsplash image for "${searchQuery}":`, error);
    return { uri: "" };
  }
}

export async function getRateLimitStatus(): Promise<{ used: number; limit: number; remaining: number; resetTime: number }> {
  const data = await getRateLimitData();
  const now = Date.now();

  if (now >= data.resetTime) {
    return {
      used: 0,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining: MAX_REQUESTS_PER_HOUR,
      resetTime: now + 60 * 60 * 1000,
    };
  }

  return {
    used: data.count,
    limit: MAX_REQUESTS_PER_HOUR,
    remaining: MAX_REQUESTS_PER_HOUR - data.count,
    resetTime: data.resetTime,
  };
}

export async function resetRateLimit(): Promise<void> {
  await AsyncStorage.removeItem(RATE_LIMIT_KEY);
  console.log("🔄 Rate limit reset");
}

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
          console.log(`🖼️ Preloading image for: ${item.title.substring(0, 50)}...`);
          preloadImage(item.imageUri);
        } else {
          console.log(`⚠️ No image URI for: ${item.title.substring(0, 50)}...`);
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
        items.forEach((item) => {
          seenFacts.current.add(item.fact);
          console.log(`📝 Initial item: ${item.title.substring(0, 50)}... | Image: ${item.imageUri ? 'YES' : 'NO'}`);
        });

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