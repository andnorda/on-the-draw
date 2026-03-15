import { readFileSync } from "node:fs";
import type { PlayerTournamentData } from "./player-data";

export function loadPlayerData(playerId: string): PlayerTournamentData {
  const raw = readFileSync(`src/data/api/${playerId}.json`, "utf-8");
  return JSON.parse(raw) as PlayerTournamentData;
}

export interface PremierStats {
  gpTop8s: number;
  gpWins: number;
  ptTop8s: number;
  ptWins: number;
  rcTop8s: number;
  rcWins: number;
  ssTop8s: number;
  ssWins: number;
}

export function computePremierStats(data: PlayerTournamentData): PremierStats {
  const eventsByCode = new Map(data.elo.events.map((e) => [e.code, e]));
  let gpTop8s = 0;
  let gpWins = 0;
  let ptTop8s = 0;
  let ptWins = 0;
  let rcTop8s = 0;
  let rcWins = 0;
  let ssTop8s = 0;
  let ssWins = 0;

  for (const [code, matches] of Object.entries(data.elo.matches)) {
    const event = eventsByCode.get(code);
    if (!event) continue;
    const isGp = event.type === "gp";
    const isPt = event.type === "pt" || event.type === "worlds";
    const isRc = event.type === "rc";
    const isSs = event.type === "ss";
    if (!isGp && !isPt && !isRc && !isSs) continue;

    const hasTop8 = matches.some((m) => m.round === "Q");
    if (!hasTop8) continue;

    const won = matches.some(
      (m) => m.round === "F" && m.result.startsWith("Won"),
    );

    if (isGp) {
      gpTop8s++;
      if (won) gpWins++;
    } else if (isPt) {
      ptTop8s++;
      if (won) ptWins++;
    } else if (isRc) {
      rcTop8s++;
      if (won) rcWins++;
    } else {
      ssTop8s++;
      if (won) ssWins++;
    }
  }

  return { gpTop8s, gpWins, ptTop8s, ptWins, rcTop8s, rcWins, ssTop8s, ssWins };
}

export function formatTitle(stats: PremierStats): string | null {
  const parts: string[] = [];

  if (stats.ptWins > 0) {
    parts.push(stats.ptWins > 1 ? `${stats.ptWins}x Pro Tour Champion` : "Pro Tour Champion");
  } else if (stats.ptTop8s > 0) {
    parts.push(stats.ptTop8s > 1 ? `${stats.ptTop8s}x Pro Tour Top 8` : "Pro Tour Top 8");
  }

  if (stats.gpWins > 0) {
    parts.push(stats.gpWins > 1 ? `${stats.gpWins}x Grand Prix Champion` : "Grand Prix Champion");
  } else if (stats.gpTop8s > 0) {
    parts.push(stats.gpTop8s > 1 ? `${stats.gpTop8s}x Grand Prix Top 8` : "Grand Prix Top 8");
  }

  if (stats.rcWins > 0) {
    parts.push(stats.rcWins > 1 ? `${stats.rcWins}x RC Champion` : "RC Champion");
  } else if (stats.rcTop8s > 0) {
    parts.push(stats.rcTop8s > 1 ? `${stats.rcTop8s}x RC Top 8` : "RC Top 8");
  }

  if (stats.ssWins > 0) {
    parts.push(stats.ssWins > 1 ? `${stats.ssWins}x Spotlight Series Champion` : "Spotlight Series Champion");
  } else if (stats.ssTop8s > 0) {
    parts.push(stats.ssTop8s > 1 ? `${stats.ssTop8s}x Spotlight Series Top 8` : "Spotlight Series Top 8");
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface PlayerSummary {
  rating: number | null;
  lastDeck: string | null;
  title: string | null;
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
    const title = formatTitle(computePremierStats(data));

    summaries.set(p.id, { rating, lastDeck, title });
  }
  return summaries;
}
