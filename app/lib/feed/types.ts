export type SourceType = "Wikipedia" | "Today in History";

export interface RawFact {
  text: string;
  year?: string;
  source: SourceType;
}

export interface FeedItem {
  id: string;
  year: string;
  title: string;
  fact: string;
  source: SourceType;
  imageUri: string;
}
