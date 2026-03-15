import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fetchPlayerData } from "../src/lib/api/player-data.ts";
import {
  fetchProTourDecklists,
  normalizeName,
  type ProTourDecklists,
} from "../src/lib/api/magicgg.ts";
import type { MeleeResult } from "../src/lib/api/meleegg.ts";

interface Player {
  id: string;
  name: string;
  meleegg: string | null;
  mtgelo: string | null;
  aliases?: string[];
}

const STALE_MS = 60 * 60 * 1000; // 1 hour
const OUTPUT_DIR = "src/data/api";
const force = process.argv.includes("--force");

function isFresh(path: string): boolean {
  try {
    const mtime = statSync(path).mtimeMs;
    return Date.now() - mtime < STALE_MS;
  } catch {
    return false;
  }
}

function enrichWithMagicGG(
  melee: MeleeResult[],
  player: Player,
  proTours: ProTourDecklists[],
): void {
  const nameKeys = [normalizeName(player.name)];
  for (const alias of player.aliases ?? []) {
    nameKeys.push(normalizeName(alias));
  }

  for (const result of melee) {
    for (const pt of proTours) {
      if (!result.TournamentName.startsWith(pt.meleePrefix)) continue;
      for (const key of nameKeys) {
        const deckName = pt.decks.get(key);
        if (deckName) {
          result.DecklistName = deckName;
          break;
        }
      }
    }
  }
}

const players: Player[] = JSON.parse(
  readFileSync("src/data/players.json", "utf-8"),
);

mkdirSync(OUTPUT_DIR, { recursive: true });

const toFetch = force
  ? players
  : players.filter((p) => !isFresh(`${OUTPUT_DIR}/${p.id}.json`));

if (toFetch.length === 0) {
  console.log("All player data is fresh, nothing to fetch.");
  process.exit(0);
}

console.log(
  `Fetching data for ${toFetch.length}/${players.length} players${force ? " (--force)" : ""}…\n`,
);

const [results, proTours] = await Promise.all([
  Promise.all(
    toFetch.map(async (player) => {
      const data = await fetchPlayerData(player.mtgelo, player.meleegg);
      return { player, data };
    }),
  ),
  fetchProTourDecklists(),
]);

console.log();

for (const [i, { player, data }] of results.entries()) {
  enrichWithMagicGG(data.melee, player, proTours);
  const path = `${OUTPUT_DIR}/${player.id}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`[${i + 1}/${toFetch.length}] ${player.id}`);
}

console.log("\nDone.");
