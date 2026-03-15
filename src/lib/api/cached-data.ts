import { readFileSync } from "node:fs";
import type { PlayerTournamentData } from "./player-data";

export function loadPlayerData(playerId: string): PlayerTournamentData {
  const raw = readFileSync(`src/data/api/${playerId}.json`, "utf-8");
  return JSON.parse(raw) as PlayerTournamentData;
}

export interface PlayerSummary {
  rating: number | null;
  lastDeck: string | null;
}

export function loadTeamSummaries(
  players: Array<{ id: string }>,
): Map<string, PlayerSummary> {
  const summaries = new Map<string, PlayerSummary>();
  for (const p of players) {
    const data = loadPlayerData(p.id);
    const rating = data.elo.profile?.current_rating ?? null;

    // Find last deck from melee results (sorted by date desc)
    const sorted = [...data.melee]
      .filter((r) => r.DecklistName && r.DecklistName !== "Decklist")
      .sort(
        (a, b) =>
          new Date(b.TournamentStartDate).getTime() -
          new Date(a.TournamentStartDate).getTime(),
      );
    const lastDeck = sorted[0]?.DecklistName ?? null;

    summaries.set(p.id, { rating, lastDeck });
  }
  return summaries;
}
