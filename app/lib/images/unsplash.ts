import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function fetchUnsplashImage(query: string): Promise<{ uri: string; attribution?: UnsplashAttribution }> {
  const cacheKey = `unsplash:${query}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Check if it's the new format with attribution
      if (typeof parsed === 'object' && 'uri' in parsed) {
        console.log(`💾 Cache hit for "${query}"`);
        return parsed;
      }
      // Old format - just a string URL, clear it and fetch fresh
      console.log(`🔄 Old cache format for "${query}", clearing...`);
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      // Invalid JSON, probably old string format - clear it
      console.log(`🗑️ Invalid cache for "${query}", clearing...`);
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
      query,
      orientation: "portrait",
      client_id: ACCESS_KEY,
    });

    const response = await fetch(
      `https://api.unsplash.com/photos/random?${params}`,
    );

    await incrementRequestCount();

    if (response.status === 403) {
      console.log("🚫 Unsplash API returned 403 - rate limit exceeded on their end");
      return { uri: "" };
    }

    if (response.status === 404) {
      console.log(`🔍 No images found for "${query}" - will show placeholder`);
      const emptyResult = { uri: "" };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(emptyResult));
      return emptyResult;
    }

    if (!response.ok) {
      console.warn(`⚠️ Unsplash API error ${response.status} for "${query}"`);
      return { uri: "" };
    }

    const data = await response.json();
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
      console.log(`✅ Fetched and cached image for "${query}"`);
      return result;
    }

    return { uri: "" };
  } catch (error) {
    console.warn(`⚠️ Failed to fetch Unsplash image for "${query}":`, error);
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
