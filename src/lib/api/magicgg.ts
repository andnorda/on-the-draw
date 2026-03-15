import { safeTextFetch } from "./fetcher";

const BASE = "https://magic.gg/decklists";

interface ProTourConfig {
  /** Tournament name prefix to match against melee.gg TournamentName */
  meleePrefix: string;
  /** magic.gg decklist page slugs */
  slugs: string[];
  /** Event name as it appears in decklistId strings (for older format pages) */
  decklistIdEvent?: string;
}

const PRO_TOURS: ProTourConfig[] = [
  {
    meleePrefix: "Pro Tour Magic: The Gathering\u2014FINAL FANTASY",
    slugs: [
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-a-c",
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-d-g",
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-h-k",
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-l-n",
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-o-s",
      "pro-tour-magic-the-gathering-final-fantasy-standard-decklists-t-z",
    ],
  },
  {
    meleePrefix: "Pro Tour Edge of Eternities",
    slugs: [
      "pro-tour-edge-of-eternities-modern-decklists-a-d",
      "pro-tour-edge-of-eternities-modern-decklists-e-h",
      "pro-tour-edge-of-eternities-modern-decklists-i-l",
      "pro-tour-edge-of-eternities-modern-decklists-m-o",
      "pro-tour-edge-of-eternities-modern-decklists-p-s",
      "pro-tour-edge-of-eternities-modern-decklists-t-z",
    ],
  },
  {
    meleePrefix: "Pro Tour Modern Horizons 3",
    slugs: [
      "pro-tour-modern-horizons-3-modern-decklists-a-d",
      "pro-tour-modern-horizons-3-modern-decklists-e-j",
      "pro-tour-modern-horizons-3-modern-decklists-k-n",
      "pro-tour-modern-horizons-3-modern-decklists-o-t",
      "pro-tour-modern-horizons-3-modern-decklists-u-z",
    ],
  },
  {
    meleePrefix: "Pro Tour Lorwyn Eclipsed",
    slugs: [
      "pro-tour-lorwyn-eclipsed-standard-decklists-a-e",
      "pro-tour-lorwyn-eclipsed-standard-decklists-f-l",
      "pro-tour-lorwyn-eclipsed-standard-decklists-m-r",
      "pro-tour-lorwyn-eclipsed-standard-decklists-s-z",
    ],
  },
  {
    meleePrefix: "Pro Tour Murders at Karlov Manor",
    decklistIdEvent: "Pro Tour Murders at Karlov Manor",
    slugs: [
      "pro-tour-murders-at-karlov-manor-pioneer-decklists-a-d",
      "pro-tour-murders-at-karlov-manor-pioneer-decklists-e-j",
      "pro-tour-murders-at-karlov-manor-pioneer-decklists-k-n",
      "pro-tour-murders-at-karlov-manor-pioneer-decklists-o-s",
      "pro-tour-murders-at-karlov-manor-pioneer-decklists-t-z",
    ],
  },
  {
    meleePrefix: "Pro Tour The Lord of the Rings",
    decklistIdEvent: "Pro Tour The Lord of The Rings",
    slugs: [
      "pro-tour-the-lord-of-the-rings-modern-decklists-a-d",
      "pro-tour-the-lord-of-the-rings-modern-decklists-e-j",
      "pro-tour-the-lord-of-the-rings-modern-decklists-k-n",
      "pro-tour-the-lord-of-the-rings-modern-decklists-o-s",
      "pro-tour-the-lord-of-the-rings-modern-decklists-t-z",
    ],
  },
];

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface DecklistEntry {
  playerName: string;
  deckName: string;
}

async function fetchDecklistPage(
  slug: string,
  decklistIdEvent?: string,
): Promise<DecklistEntry[]> {
  const result = await safeTextFetch(`${BASE}/${slug}`, {
    headers: new Headers({ "User-Agent": "Mozilla/5.0" }),
  });
  if (!result.data) return [];

  // Newer format: <deck-list deck-title="Player" subtitle="Archetype">
  const entries: DecklistEntry[] = [];
  const htmlRe = /deck-title="([^"]+?)"[^>]*subtitle="([^"]+?)"/g;
  let match;
  while ((match = htmlRe.exec(result.data)) !== null) {
    entries.push({ playerName: match[1], deckName: match[2] });
  }
  if (entries.length > 0) return entries;

  // Older format: decklistId:Archetype_Parts_PlayerName_EventName_Date_GUID
  if (!decklistIdEvent) return [];
  const idRe = /decklistId:([^"]+)/g;
  while ((match = idRe.exec(result.data)) !== null) {
    const raw = match[1];
    // Split on the known event name to separate archetype+player from date+guid
    const eventIdx = raw.indexOf(`_${decklistIdEvent}_`);
    if (eventIdx === -1) continue;
    const left = raw.slice(0, eventIdx); // "Archetype_Parts_PlayerName"
    // Player name contains spaces, archetype words are single words joined by _
    // Find the last segment that contains a space — that's where the player name starts
    const parts = left.split("_");
    let playerStart = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].includes(" ")) {
        playerStart = i;
        break;
      }
    }
    if (playerStart === -1) continue;
    const deckName = parts.slice(0, playerStart).join(" ");
    const playerName = parts.slice(playerStart).join(" ");
    if (!deckName || !playerName) continue;
    entries.push({ playerName, deckName });
  }
  return entries;
}

export interface ProTourDecklists {
  meleePrefix: string;
  /** normalized player name → deck archetype name */
  decks: Map<string, string>;
}

export async function fetchProTourDecklists(): Promise<ProTourDecklists[]> {
  const results: ProTourDecklists[] = [];

  for (const pt of PRO_TOURS) {
    const pages = await Promise.all(
      pt.slugs.map((slug) => fetchDecklistPage(slug, pt.decklistIdEvent)),
    );
    const decks = new Map<string, string>();
    for (const entries of pages) {
      for (const { playerName, deckName } of entries) {
        decks.set(normalizeName(playerName), deckName);
      }
    }
    results.push({ meleePrefix: pt.meleePrefix, decks });
    console.log(`  magic.gg: ${pt.meleePrefix} — ${decks.size} decklists`);
  }

  return results;
}
