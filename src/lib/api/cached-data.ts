import { readFileSync } from "node:fs";
import type { PlayerTournamentData } from "./player-data";

export function loadPlayerData(playerId: string): PlayerTournamentData {
  const raw = readFileSync(`src/data/api/${playerId}.json`, "utf-8");
  return JSON.parse(raw) as PlayerTournamentData;
}

export function loadTeamRatings(
  players: Array<{ id: string }>,
): Map<string, number | null> {
  const ratings = new Map<string, number | null>();
  for (const p of players) {
    const data = loadPlayerData(p.id);
    ratings.set(p.id, data.elo.profile?.current_rating ?? null);
  }
  return ratings;
}
