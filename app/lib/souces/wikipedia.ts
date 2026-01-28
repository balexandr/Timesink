import { RawFact } from "../feed/types";
import { fetchJson } from "../utils/fetchJson";

export async function fetchWikipediaFact(): Promise<RawFact> {
  const json = await fetchJson<any>(
    "https://en.wikipedia.org/api/rest_v1/page/random/summary",
  );

  if (!json.extract) {
    throw new Error("Missing Wikipedia extract");
  }

  const yearMatch = json.extract.match(/\b(\d{3,4})\b/);

  return {
    text: json.extract,
    year: yearMatch?.[1],
    source: "Wikipedia",
  };
}
