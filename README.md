# MTG Card Browser

A Magic: The Gathering card browser & market analytics app, built as a
Keboola Data App. Pulls card metadata from Scryfall plus pricing data from
TCGPlayer (USD) and 401 Games (CAD) to give side-by-side visibility into
both markets.

## Features

- **Browse** — filterable grid over all cards (set, rarity, color identity,
  artist, type, TCGPlayer grade, card variant), free-text search, sort by
  name / price TCG / price 401 / rarity / collector #.
- **Card detail popup** — full art, oracle + flavor text, stats, TCGPlayer
  sealed-guide grade & commentary, external links (Scryfall / TCGplayer /
  401 Games / 401 Games Foil), current-price widgets for USD / FOIL / ETCHED
  TCGP and CAD / CAD FOIL 401, and two **date-synchronized** price-history
  charts (TCGPlayer + 401).
- **TCGPlayer analytics tab** — market overview, total-market-value trend,
  top movers, price distribution, price trends by rarity & by set, rarity
  breakdown, most-valuable cards table, top artists by portfolio value.
- **401 analytics tab** — same sections adapted to CAD prices and scoped to
  cards present in the 401 dataset (top artists is skipped).

## Screenshots

### Browse tab
![Browse tab](documentation/01-browse.png)

### Card detail popup
![Card detail](documentation/02-card-detail.png)

Date-synchronized price-history charts (TCGPlayer + 401 share the same
X-axis window — the last 14 days across both sources):

![Card detail charts](documentation/03-card-detail-charts.png)

### TCGPlayer analytics tab
![TCGPlayer analytics](documentation/04-tcgplayer-analytics.png)

### 401 analytics tab
Similar to the TCGPlayer stats.

## Stack

- Node 18+ / Express backend — exports Keboola Storage tables as CSV,
  in-memory cache with a 5-minute TTL.
- Vanilla JavaScript frontend — module-pattern IIFEs, no build step.
- Chart.js for all charts, PapaParse for CSV parsing.

## Data sources

All five tables come from the Keboola Storage project configured via
`KBC_URL` + `KBC_TOKEN`. Columns listed are those the app actually reads —
the tables may have more.

### `out.c-scryfall.cards`
Scryfall card master. Required columns:

| Column | Used for |
|---|---|
| `id` | Scryfall UUID — primary key, join key to `401_mapping.scryfall_id` |
| `name` | Card name |
| `set`, `set_name` | Set code + display name |
| `collector_number` | Join key for price snapshots (with `set`) |
| `artist` | Filters & artist portfolio chart |
| `type_line`, `mana_cost`, `cmc` | Card attributes |
| `oracle_text`, `flavor_text` | Popup text |
| `power`, `toughness`, `loyalty` | Stats display |
| `rarity` | Filters + rarity breakdown charts |
| `colors`, `color_identity` | JSON-stringified arrays |
| `keywords`, `layout`, `frame_effects` | Card attributes |
| `full_art`, `foil`, `nonfoil` | Booleans (strings "True"/"False") used by variant filters |
| `finishes` | Finish display |
| `image_uris_normal`, `image_uris_large`, `image_uris_small`, `image_uris_art_crop` | Images |
| `scryfall_uri` | External link |
| `tcgplayer_id` | TCGplayer external link |
| `prices_usd`, `prices_usd_foil`, `prices_usd_etched` | Current-price widgets & sort |
| `edhrec_rank`, `released_at`, `border_color`, `lang` | Misc display + Japanese/borderless filters |

### `out.c-scryfall.cards_price_snapshot`
TCGPlayer price history, one row per card per snapshot date.

| Column | Used for |
|---|---|
| `set`, `collector_number` | Join key to `cards` (composite) |
| `snapshot_date` | X-axis label (YYYY-MM-DD) |
| `prices_usd`, `prices_usd_foil`, `prices_usd_etched` | Price series |

### `out.c-scryfall.TCGPlayer_sealed_guide`
TCGPlayer sealed-guide grades + commentary per card (optional; failure to
load degrades gracefully).

| Column | Used for |
|---|---|
| `Set` | Join key (lowercased, composite with `Collector_Number`) |
| `Collector_Number` | Join key |
| `Usability_Tier` | Grade shown in card popup + grade filter |
| `Contextual_Commentary_from_Article` | Commentary shown in popup |

### `in.c-401games.card_prices`
Raw scraped 401 Games prices — one row per product per scrape timestamp.

| Column | Used for |
|---|---|
| `product_id` | Join key (composite with `variant_id`) to `401_mapping` |
| `variant_id` | Join key |
| `scrape_datetime` | ISO timestamp; collapsed to `YYYY-MM-DD` (last scrape of the day wins) |
| `price` | Parsed from `"$X.XX CAD"` to numeric CAD |

### `out.c-401games.401_mapping`
Scryfall → 401 Games product mapping. May contain two rows per Scryfall ID
(one for non-foil, one for foil).

| Column | Used for |
|---|---|
| `scryfall_id` | Join key to `cards.id` |
| `product_id`, `variant_id` | Join key to `card_prices` |
| `product_url` | Link rendered as "401 Games" / "401 Games (Foil)" |
| `is_foil` | Boolean-string — selects which mapping slot (foil vs non-foil) |

## Running locally

```bash
npm install
KBC_URL=https://connection.eu-central-1.keboola.com \
KBC_TOKEN=<your-storage-token> \
npm start
```

Open http://localhost:3000.

The server pre-warms all five tables on startup (see terminal logs) and
caches them in memory for 5 minutes. Force a refresh with
`POST /api/refresh`. `GET /debug/api-test` verifies Storage connectivity
for troubleshooting.

## Deployment

Designed to run inside **Keboola Data Apps** — the platform injects
`KBC_URL` + `KBC_TOKEN` as environment variables and starts the app with
`npm start` (see `package.json`). The startup handler also responds to
`POST /` because the Data Apps runtime probes root on boot.

## Regenerating screenshots

```bash
npm install --save-dev puppeteer-core    # one-time
node scripts/take-screenshots.js         # writes PNGs into documentation/
```

Requires Chromium at `/Applications/Chromium.app/Contents/MacOS/Chromium`
and the dev server running on port 3000. Adjust the `CHROMIUM` and
`APP_URL` constants at the top of the script if your setup differs.
