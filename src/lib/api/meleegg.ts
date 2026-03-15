import { safeFetch, safeTextFetch } from "./fetcher";

const BASE = "https://melee.gg";

const MELEE_HEADERS = new Headers({
  "Content-Type": "application/json",
  "User-Agent": "curl/8.0",
});

export interface MeleeResult {
  TournamentName: string;
  TournamentStartDate: string;
  TournamentId: number;
  Rank: number;
  Record: string;
  Format: string | null;
  FormatDescription: string | null;
  DecklistName: string | null;
  DecklistId: number;
  DecklistGuid: string | null;
  ParticipatingCount: number;
  OrganizationName: string;
  Game: string;
}

interface MeleeResponse {
  data: MeleeResult[];
  recordsTotal: number;
}

interface StandingsDecklist {
  DecklistId: string;
  DecklistName: string;
}

interface StandingsEntry {
  Team: { Players: Array<{ Username: string }> };
  Decklists: StandingsDecklist[];
}

interface StandingsResponse {
  data: StandingsEntry[];
  recordsTotal: number;
}

/** Extract the last completed round ID from a tournament page. */
async function fetchLastRoundId(
  tournamentId: number,
): Promise<string | null> {
  const result = await safeTextFetch(
    `${BASE}/Tournament/View/${tournamentId}`,
    { headers: new Headers({ "User-Agent": "curl/8.0" }) },
  );
  if (!result.data) return null;
  const matches = [
    ...result.data.matchAll(
      /round-selector"[^>]*data-id="(\d+)"[^>]*data-is-completed="True"/g,
    ),
  ];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

/** Search tournament standings for a player's decklist. */
async function fetchDecklistFromStandings(
  roundId: string,
  username: string,
): Promise<{ guid: string; name: string } | null> {
  const params = new URLSearchParams({
    draw: "1",
    start: "0",
    length: "1",
    roundId,
    "search[value]": username,
    "search[regex]": "false",
    "columns[0][data]": "Rank",
    "columns[0][name]": "Rank",
    "columns[1][data]": "Players",
    "columns[1][name]": "Players",
    "columns[2][data]": "Decklists",
    "columns[2][name]": "Decklists",
    "order[0][column]": "0",
    "order[0][dir]": "asc",
  });
  const result = await safeFetch<StandingsResponse>(
    `${BASE}/Standing/GetRoundStandings/${roundId}`,
    {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "curl/8.0",
      }),
      body: params.toString(),
    },
  );
  const entry = result.data?.data?.[0];
  const decklist = entry?.Decklists?.[0];
  if (!decklist?.DecklistId) return null;
  return { guid: decklist.DecklistId, name: decklist.DecklistName };
}

/** Enrich results that are missing decklists by querying tournament standings. */
async function enrichDecklists(
  results: MeleeResult[],
  username: string,
): Promise<void> {
  const missing = results.filter((r) => !r.DecklistId);
  if (missing.length === 0) return;

  // Deduplicate by tournament ID so we fetch each tournament once
  const byTournament = new Map<number, MeleeResult[]>();
  for (const r of missing) {
    const list = byTournament.get(r.TournamentId) ?? [];
    list.push(r);
    byTournament.set(r.TournamentId, list);
  }

  await Promise.all(
    [...byTournament.entries()].map(async ([tournamentId, entries]) => {
      const roundId = await fetchLastRoundId(tournamentId);
      if (!roundId) return;
      const decklist = await fetchDecklistFromStandings(roundId, username);
      if (!decklist) return;
      for (const entry of entries) {
        entry.DecklistGuid = decklist.guid;
        entry.DecklistName = decklist.name;
      }
    }),
  );
}

export async function fetchMeleeResults(
  username: string,
): Promise<MeleeResult[]> {
  const result = await safeFetch<MeleeResponse>(
    `${BASE}/Profile/GetResults/${username}`,
    {
      method: "POST",
      headers: MELEE_HEADERS,
      body: "{}",
    },
  );
  if (!result.data) return [];
  const mtgResults = result.data.data.filter(
    (r) => r.Game === "MagicTheGathering",
  );
  await enrichDecklists(mtgResults, username);
  return mtgResults;
}
