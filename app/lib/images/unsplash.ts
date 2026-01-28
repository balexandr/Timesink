import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "4K5y4QovQEXF1QDeoauur6Pwf8qKm8rjBQ5N4jwhJJA";

let rateLimitExceeded = false;

export async function fetchUnsplashImage(query: string): Promise<string> {
  // If we've already hit the rate limit, return empty string immediately
  if (true || rateLimitExceeded) {
    return "";
  }

  const cacheKey = `unsplash:${query}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      query,
      orientation: "portrait",
      client_id: ACCESS_KEY,
    });

    const response = await fetch(
      `https://api.unsplash.com/photos/random?${params}`,
    );

    // Check for rate limit error
    if (response.status === 403) {
      console.log("Unsplash rate limit exceeded, using placeholders from now on");
      rateLimitExceeded = true;
      return "";
    }

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    const uri = data?.urls?.regular ?? "";

    if (uri) {
      await AsyncStorage.setItem(cacheKey, uri);
    }

    return uri;
  } catch (error) {
    console.error("Failed to fetch Unsplash image:", error);
    return "";
  }
}

// Optional: Function to reset the flag (useful for testing or if you want to retry later)
export function resetRateLimit() {
  rateLimitExceeded = false;
}
