# On The Draw

Astro 6 static site for competitive MTG team "On The Draw" (20 players across Europe/Asia). Displays player profiles with Elo ratings, tournament history, decklists, and match data.

All data is fetched at build time (~20s, ~100+ API requests).

## Commands

```sh
npm install
npm run build    # Build to ./dist/, fetches all external data
npm run dev      # Dev server at localhost:4321
npm run preview  # Preview production build
```

## Architecture

```
src/
├── components/
│   ├── EloChart.astro          # SVG polyline Elo chart
│   ├── TournamentHistory.astro # Merged tournament table (elo + melee)
│   ├── PlayerCard.astro        # Roster grid card
│   ├── ExternalLink.astro
│   ├── Nav.astro
│   └── Footer.astro
├── data/
│   └── players.json            # Roster with mtgelo IDs and melee.gg usernames
├── lib/api/
│   ├── fetcher.ts              # safeFetch<T>(), safeTextFetch() — return {data, error}, never throw
│   ├── mtgelo.ts               # mtgeloproject.net: profile (HTML scraping), events, matches
│   ├── meleegg.ts              # melee.gg: results, standings, decklist enrichment
│   └── player-data.ts          # Aggregation (fetchPlayerData, fetchTeamRatings)
├── pages/
│   ├── index.astro
│   └── team/
│       ├── index.astro         # Roster grid with Elo ratings
│       └── [id].astro          # Player profile page
├── content.config.ts           # Astro content collection
└── styles/
    └── global.css              # Dark theme, gold accents (#c9a84c), Georgia/system-ui
```

### Data Flow

1. `players.json` defines the roster with `mtgelo` IDs and `meleegg` usernames
2. Player pages call `fetchPlayerData(mtgeloId, meleeggUsername)` — API calls run in parallel
3. `TournamentHistory.astro` merges elo events and melee results, matching by normalized name + month
4. Decklists link to `melee.gg/Decklist/View/{guid}` when available

## Data Sources

### mtgeloproject.net

| Endpoint | Response |
|---|---|
| `GET /api/search/{lastname}` | Player IDs, current Elo |
| `GET /api/players/{id}/events` | `{data: [{code, name, date, format, type, is_pro, site}]}` |
| `GET /api/players/{id}/matches` | Object keyed by event code, arrays of `{match_id, round, result, own_elo, opp_data}` |
| `GET /profile/{id}` (HTML) | Profile scraped from Astro island props: current_rating, record, pro_record, ranking, nakamura_number |

Profile data uses recursive `[type, value]` tuple serialization (type 0 = literal, type 1 = array). Parsed in `mtgelo.ts`.

### melee.gg

| Endpoint | Method | Description |
|---|---|---|
| `/Profile/GetResults/{username}` | POST `{}` | Tournament results (DataTables format) |
| `/Tournament/View/{id}` | GET | Tournament HTML (contains round IDs) |
| `/Standing/GetRoundStandings/{roundId}` | POST (form-encoded) | Standings with decklist data |
| `/Decklist/View/{guid}` | GET | Decklist page |

All melee.gg requests require `User-Agent: curl/8.0` — Node's default gets 403. Results must be filtered by `Game === "MagicTheGathering"` (site also hosts Lorcana).

#### Decklist Enrichment

The profile API often returns `DecklistId: 0` even when a decklist exists. The build enriches missing decklists by:

1. Fetching tournament HTML → extracting last completed round ID from `.round-selector[data-id][data-is-completed="True"]`
2. POSTing to `/Standing/GetRoundStandings/{roundId}` with `roundId`, `search[value]={username}`, and DataTables `columns` in form-encoded body
3. Extracting GUID-based `DecklistId` and `DecklistName` from the `Decklists` array

## Known Issues

- Oscar Mattias Jorstedt listed as "Mattias Jorstedt" on mtgeloproject.net
- Matúš Lamačka has no melee.gg profile
- Bartosz Wojciechowski may have duplicate mtgelo entries (`0m7xm44e` vs `ojk43gxv`)
- Tournament matching (normalized name + year-month) can occasionally produce false or missed matches
