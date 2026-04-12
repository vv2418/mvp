import { EventData } from "@/components/EventCard";

const API_KEY = import.meta.env.VITE_TICKETMASTER_API_KEY;
const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

interface TMImage {
  url: string;
  ratio?: string;
  width?: number;
  height?: number;
}

interface TMEvent {
  id: string;
  name: string;
  info?: string;
  pleaseNote?: string;
  dates: {
    start: {
      localDate?: string;
      localTime?: string;
    };
  };
  images: TMImage[];
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      city?: { name: string };
      state?: { stateCode: string };
    }>;
  };
}

function pickImage(images: TMImage[]): string {
  // Prefer 16:9 ratio, then largest available
  const preferred = images
    .filter((img) => img.ratio === "16_9")
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  return (preferred[0] || images[0])?.url ?? "";
}

function formatDate(localDate?: string): string {
  if (!localDate) return "TBA";
  const d = new Date(localDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SKIP = new Set(["Undefined", "Other", "Miscellaneous"]);

function extractTags(classifications?: TMEvent["classifications"]): string[] {
  if (!classifications?.length) return [];
  const tags: string[] = [];
  for (const c of classifications.slice(0, 2)) {
    const segment = c.segment?.name;
    const genre = c.genre?.name;
    const sub = c.subGenre?.name;
    if (segment && !SKIP.has(segment) && !tags.includes(segment)) tags.push(segment);
    if (genre && !SKIP.has(genre) && !tags.includes(genre)) tags.push(genre);
    if (sub && !SKIP.has(sub) && !tags.includes(sub)) tags.push(sub);
  }
  return tags.slice(0, 3);
}

function tmEventToEventData(event: TMEvent, index: number): EventData {
  const venue = event._embedded?.venues?.[0];
  const venueName = venue?.name ?? "Venue TBA";
  const city = venue?.city?.name ?? "";
  const location = city ? `${venueName}, ${city}` : venueName;

  const tags = extractTags(event.classifications);
  const description =
    event.info ||
    event.pleaseNote ||
    (tags.length ? `${tags.join(" · ")} event at ${venueName}` : `Live event at ${venueName}`);

  // Ticketmaster doesn't expose attendee counts — use a seeded plausible number
  const attendees = 20 + ((index * 37 + event.id.charCodeAt(0) * 13) % 180);

  return {
    id: event.id,
    title: event.name,
    description,
    date: formatDate(event.dates.start.localDate),
    location,
    attendees,
    image: pickImage(event.images),
    tags,
  };
}

export interface FetchEventsOptions {
  lat?: number;
  lng?: number;
  city?: string;
  radius?: number; // miles
  size?: number;
  keyword?: string;
}

export async function fetchTicketmasterEvents(
  options: FetchEventsOptions = {}
): Promise<EventData[]> {
  const { lat, lng, city, radius = 25, size = 20, keyword } = options;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    apikey: API_KEY,
    size: String(size),
    sort: "date,asc",
    radius: String(radius),
    unit: "miles",
    startDateTime: now,
  });

  if (keyword) {
    params.set("keyword", keyword);
  }

  if (lat != null && lng != null) {
    params.set("latlong", `${lat},${lng}`);
  } else if (city) {
    params.set("city", city);
  }

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Ticketmaster API error: ${res.status}`);

  const json = await res.json();
  const events: TMEvent[] = json._embedded?.events ?? [];
  return deduplicateEvents(events.map(tmEventToEventData));
}

/**
 * Ticketmaster lists the same show multiple times with different IDs
 * (e.g. "GA Tickets", "VIP Package", "Flex Ticket").
 * Deduplicate by normalised title + date — keep the first occurrence
 * (lowest index = best sort-by-date ordering).
 */
function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[-–—|:]\s*(vip|ga|general admission|flex|package|presale|tickets?|experience)\b.*/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deduplicateEvents(events: EventData[]): EventData[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${normaliseTitle(e.title)}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
