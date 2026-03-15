import { safeFetch, safeTextFetch } from "./fetcher";

const BASE = "https://mtgeloproject.net";

export interface MtgEloProfile {
  current_rating: number;
  record: [number, number, number];
  pro_record: [number | null, number | null, number | null];
  ranking: number | null;
  active_ranking: number | null;
  nakamura_number: number | null;
  best_event: string | null;
}

export interface MtgEloEvent {
  code: string;
  name: string;
  date: string;
  format: string;
  type: string;
  is_pro: boolean;
  site: string;
}

export interface MtgEloMatch {
  match_id: number;
  round: string;
  result: string;
  format: string;
  own_elo: { start: number; end: number };
  opp_data: { id: string; opp: string; start: number };
}

export type MtgEloMatches = Record<string, MtgEloMatch[]>;

export interface MtgEloPlayerData {
  profile: MtgEloProfile | null;
  events: MtgEloEvent[];
  matches: MtgEloMatches;
}

function parseAstroValue(val: unknown): unknown {
  if (!Array.isArray(val)) {
    if (val && typeof val === "object") {
      return parseAstroObject(val as Record<string, unknown>);
    }
    return val;
  }
  const [type, inner] = val;
  if (type === 0) {
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return parseAstroObject(inner as Record<string, unknown>);
    }
    return inner;
  }
  if (type === 1 && Array.isArray(inner)) return inner.map(parseAstroValue);
  return inner;
}

function parseAstroObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = parseAstroValue(val);
  }
  return result;
}

export async function fetchMtgEloProfile(
  playerId: string,
): Promise<MtgEloProfile | null> {
  const result = await safeTextFetch(`${BASE}/profile/${playerId}`);
  if (!result.data) return null;

  const match = result.data.match(
    /props="(\{[^"]*playerid[^"]*current_rating[^"]*)"/,
  );
  if (!match) return null;

  try {
    const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const parsed = JSON.parse(decoded);
    const info = parseAstroValue(parsed.info) as Record<string, unknown>;
    if (!info) return null;

    const record = info.record as number[];
    const proRecord = info.pro_record as (number | null)[];

    return {
      current_rating: info.current_rating as number,
      record: [record[0], record[1], record[2]],
      pro_record: [proRecord[0], proRecord[1], proRecord[2]],
      ranking: info.ranking as number | null,
      active_ranking: info.active_ranking as number | null,
      nakamura_number: info.nakamura_number as number | null,
      best_event: info.best_event as string | null,
    };
  } catch (err) {
    console.warn(`[mtgelo] Failed to parse profile for ${playerId}:`, err);
    return null;
  }
}

interface EventsResponse {
  data: MtgEloEvent[];
}

export async function fetchMtgEloEvents(
  playerId: string,
): Promise<MtgEloEvent[]> {
  const result = await safeFetch<EventsResponse>(
    `${BASE}/api/players/${playerId}/events`,
  );
  return result.data?.data ?? [];
}

export async function fetchMtgEloMatches(
  playerId: string,
): Promise<MtgEloMatches> {
  const result = await safeFetch<MtgEloMatches>(
    `${BASE}/api/players/${playerId}/matches`,
  );
  return result.data ?? {};
}

export async function fetchAllMtgEloData(
  playerId: string,
): Promise<MtgEloPlayerData> {
  const [profile, events, matches] = await Promise.all([
    fetchMtgEloProfile(playerId),
    fetchMtgEloEvents(playerId),
    fetchMtgEloMatches(playerId),
  ]);
  return { profile, events, matches };
}
