import { UnsplashAttribution } from "../images/unsplash";

export type SourceType = "Wikipedia" | "Today in History";

export interface RawFact {
  text: string;
  year?: string;
  source: string;
}

export interface FeedItem {
  id: string;
  year: string;
  title: string;
  fact: string;
  source: string;
  imageUri: string;
  unsplashAttribution?: UnsplashAttribution;
}
