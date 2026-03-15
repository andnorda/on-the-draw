import {
  fetchAllMtgEloData,
  fetchMtgEloProfile,
  type MtgEloPlayerData,
} from "./mtgelo";
import { fetchMeleeResults, type MeleeResult } from "./meleegg";

export interface PlayerTournamentData {
  elo: MtgEloPlayerData;
  melee: MeleeResult[];
}

const emptyElo: MtgEloPlayerData = {
  profile: null,
  events: [],
  matches: {},
};

export async function fetchPlayerData(
  mtgeloId: string | null,
  meleeggUsername: string | null,
): Promise<PlayerTournamentData> {
  const [elo, melee] = await Promise.all([
    mtgeloId ? fetchAllMtgEloData(mtgeloId) : Promise.resolve(emptyElo),
    meleeggUsername ? fetchMeleeResults(meleeggUsername) : Promise.resolve([]),
  ]);
  return { elo, melee };
}

export async function fetchTeamRatings(
  players: Array<{ id: string; mtgelo: string | null }>,
): Promise<Map<string, number | null>> {
  const ratings = new Map<string, number | null>();
  const results = await Promise.all(
    players.map(async (p) => {
      if (!p.mtgelo) return { id: p.id, rating: null };
      const profile = await fetchMtgEloProfile(p.mtgelo);
      return {
        id: p.id,
        rating: profile?.current_rating ?? null,
      };
    }),
  );
  for (const r of results) {
    ratings.set(r.id, r.rating);
  }
  return ratings;
}
