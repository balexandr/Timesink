import { RawFact } from "../feed/types";
import { fetchJson } from "../utils/fetchJson";

export async function fetchTodayInHistory(): Promise<RawFact> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const json = await fetchJson<any>(
    `https://history.muffinlabs.com/date/${month}/${day}`,
  );

  const events = json?.data?.Events;
  if (!events?.length) {
    throw new Error("No historical events");
  }

  const event = events[Math.floor(Math.random() * events.length)];

  return {
    text: event.text,
    year: event.year,
    source: "Today in History",
  };
}
