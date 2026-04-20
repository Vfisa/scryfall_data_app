const DataModule = (() => {
  let cards = [];
  let priceHistoryMap = new Map();
  let priceHistory401Map = new Map();
  let snapshotDates401 = [];
  let filterOptions = {};

  function safeJsonParse(val) {
    if (!val || val === '') return [];
    try {
      return JSON.parse(val.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }

  function parseBool(val) {
    return val === 'True' || val === 'true';
  }

  function parseCard(row) {
    return {
      id: row.id,
      name: row.name || '',
      set: row.set || '',
      set_name: row.set_name || '',
      collector_number: row.collector_number || '',
      artist: row.artist || '',
      type_line: row.type_line || '',
      mana_cost: row.mana_cost || '',
      cmc: parseFloat(row.cmc) || 0,
      oracle_text: row.oracle_text || '',
      flavor_text: row.flavor_text || '',
      power: row.power || '',
      toughness: row.toughness || '',
      loyalty: row.loyalty || '',
      rarity: row.rarity || '',
      colors: safeJsonParse(row.colors),
      color_identity: safeJsonParse(row.color_identity),
      keywords: row.keywords || '',
      layout: row.layout || '',
      full_art: parseBool(row.full_art),
      foil: parseBool(row.foil),
      nonfoil: parseBool(row.nonfoil),
      finishes: row.finishes || '',
      image_normal: row.image_uris_normal || '',
      image_large: row.image_uris_large || '',
      image_small: row.image_uris_small || '',
      image_art_crop: row.image_uris_art_crop || '',
      scryfall_uri: row.scryfall_uri || '',
      tcgplayer_id: row.tcgplayer_id || '',
      prices_usd: row.prices_usd || '',
      prices_usd_foil: row.prices_usd_foil || '',
      prices_usd_etched: row.prices_usd_etched || '',
      edhrec_rank: row.edhrec_rank ? parseInt(row.edhrec_rank) : null,
      released_at: row.released_at || '',
      border_color: row.border_color || '',
      lang: row.lang || 'en',
      frame_effects: row.frame_effects || '',
      tcgplayer_grade: '',
      tcgplayer_commentary: '',
      has_401: false,
      url_401: null,
      url_401_foil: null,
      price_401_cad: null,
      price_401_cad_foil: null,
    };
  }

  function buildTcgplayerMap(rows) {
    const map = new Map();
    rows.forEach(row => {
      const set = (row.Set || '').toLowerCase();
      const num = row.Collector_Number || '';
      if (!set || !num) return;
      map.set(`${set}|${num}`, {
        grade: row.Usability_Tier || '',
        commentary: row.Contextual_Commentary_from_Article || '',
      });
    });
    return map;
  }

  function applyTcgplayerData(cards, tcgMap) {
    cards.forEach(card => {
      const key = `${(card.set || '').toLowerCase()}|${card.collector_number}`;
      const match = tcgMap.get(key);
      if (match) {
        card.tcgplayer_grade = match.grade;
        card.tcgplayer_commentary = match.commentary;
      }
    });
  }

  function buildFilterOptions(cards) {
    const sets = new Set();
    const rarities = new Set();
    const artists = new Set();
    const typeLines = new Set();
    const tcgplayerGrades = new Set();

    cards.forEach(c => {
      if (c.set_name) sets.add(c.set_name);
      if (c.rarity) rarities.add(c.rarity);
      if (c.artist) artists.add(c.artist);
      if (c.type_line) typeLines.add(c.type_line);
      if (c.tcgplayer_grade) tcgplayerGrades.add(c.tcgplayer_grade);
    });

    const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];
    return {
      sets: [...sets].sort(),
      rarities: rarityOrder.filter(r => rarities.has(r)),
      artists: [...artists].sort(),
      typeLines: [...typeLines].sort(),
      tcgplayerGrades: [...tcgplayerGrades].sort(),
    };
  }

  // Parse "$5.00 CAD" → 5.0 (number). Returns null for empty / unparseable.
  function parseCadPrice(raw) {
    if (!raw) return null;
    const match = String(raw).match(/[\d.]+/);
    if (!match) return null;
    const v = parseFloat(match[0]);
    return Number.isFinite(v) ? v : null;
  }

  // Build map: scryfall_id → { nonFoil?: {product_id, variant_id, product_url}, foil?: {...} }
  function build401Mapping(rows) {
    const map = new Map();
    rows.forEach(row => {
      const scryfallId = row.scryfall_id;
      if (!scryfallId) return;
      const key = parseBool(row.is_foil) ? 'foil' : 'nonFoil';
      if (!map.has(scryfallId)) map.set(scryfallId, {});
      map.get(scryfallId)[key] = {
        product_id: row.product_id || '',
        variant_id: row.variant_id || '',
        product_url: row.product_url || '',
      };
    });
    return map;
  }

  // Build map: 'product_id|variant_id' → [{date: 'YYYY-MM-DD', cad: number}] sorted by date.
  // If multiple scrapes exist for the same product on the same day, the latest timestamp wins.
  function build401PriceHistory(rows) {
    const byProduct = new Map(); // 'pid|vid' → Map<date, { ts, cad }>
    rows.forEach(row => {
      const pid = row.product_id || '';
      const vid = row.variant_id || '';
      const ts = row.scrape_datetime || '';
      if (!pid || !vid || !ts) return;
      const date = ts.slice(0, 10);
      const cad = parseCadPrice(row.price);
      if (cad === null) return;
      const key = `${pid}|${vid}`;
      if (!byProduct.has(key)) byProduct.set(key, new Map());
      const dayMap = byProduct.get(key);
      const existing = dayMap.get(date);
      if (!existing || ts > existing.ts) {
        dayMap.set(date, { ts, cad });
      }
    });

    const out = new Map();
    byProduct.forEach((dayMap, key) => {
      const arr = [...dayMap.entries()]
        .map(([date, { cad }]) => ({ date, cad }))
        .sort((a, b) => a.date.localeCompare(b.date));
      out.set(key, arr);
    });
    return out;
  }

  function apply401Data(cards, mapping, priceHistMap) {
    cards.forEach(card => {
      const m = mapping.get(card.id);
      if (!m) return;
      card.has_401 = true;
      if (m.nonFoil) {
        card.url_401 = m.nonFoil.product_url || null;
        const hist = priceHistMap.get(`${m.nonFoil.product_id}|${m.nonFoil.variant_id}`);
        if (hist && hist.length) card.price_401_cad = hist[hist.length - 1].cad;
      }
      if (m.foil) {
        card.url_401_foil = m.foil.product_url || null;
        const hist = priceHistMap.get(`${m.foil.product_id}|${m.foil.variant_id}`);
        if (hist && hist.length) card.price_401_cad_foil = hist[hist.length - 1].cad;
      }
    });
  }

  // Per-card merged history: [{date, cad, cad_foil}] — outer join of the two variants on date.
  function build401PerCardHistory(cards, mapping, priceHistMap) {
    const perCard = new Map();
    cards.forEach(card => {
      const m = mapping.get(card.id);
      if (!m) return;
      const nonFoilHist = m.nonFoil ? (priceHistMap.get(`${m.nonFoil.product_id}|${m.nonFoil.variant_id}`) || []) : [];
      const foilHist = m.foil ? (priceHistMap.get(`${m.foil.product_id}|${m.foil.variant_id}`) || []) : [];
      if (!nonFoilHist.length && !foilHist.length) return;

      const dates = new Set();
      nonFoilHist.forEach(p => dates.add(p.date));
      foilHist.forEach(p => dates.add(p.date));

      const nfByDate = new Map(nonFoilHist.map(p => [p.date, p.cad]));
      const fByDate = new Map(foilHist.map(p => [p.date, p.cad]));

      const merged = [...dates].sort().map(d => ({
        date: d,
        cad: nfByDate.has(d) ? nfByDate.get(d) : null,
        cad_foil: fByDate.has(d) ? fByDate.get(d) : null,
      }));
      perCard.set(card.id, merged);
    });
    return perCard;
  }

  function computeSnapshotDates401(priceHistMap) {
    const dates = new Set();
    priceHistMap.forEach(arr => arr.forEach(p => dates.add(p.date)));
    return [...dates].sort();
  }

  function buildPriceHistory(snapshots) {
    const map = new Map();
    snapshots.forEach(row => {
      const key = `${row.set}|${row.collector_number}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        date: row.snapshot_date || '',
        usd: row.prices_usd || '',
        usd_foil: row.prices_usd_foil || '',
        usd_etched: row.prices_usd_etched || '',
      });
    });
    map.forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }

  function loadCSV(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: result => resolve(result.data),
        error: err => reject(err),
      });
    });
  }

  async function load() {
    const [cardsRaw, snapshotsRaw, tcgplayerRaw, cardPrices401Raw, mapping401Raw] = await Promise.all([
      loadCSV('/api/tables/cards'),
      loadCSV('/api/tables/snapshots'),
      loadCSV('/api/tables/tcgplayer').catch(err => {
        console.warn('Failed to load tcgplayer data:', err);
        return [];
      }),
      loadCSV('/api/tables/card-prices-401').catch(err => {
        console.warn('Failed to load 401 card prices:', err);
        return [];
      }),
      loadCSV('/api/tables/mapping-401').catch(err => {
        console.warn('Failed to load 401 mapping:', err);
        return [];
      }),
    ]);

    cards = cardsRaw.map(parseCard);
    priceHistoryMap = buildPriceHistory(snapshotsRaw);
    const tcgMap = buildTcgplayerMap(tcgplayerRaw);
    applyTcgplayerData(cards, tcgMap);

    const mapping401 = build401Mapping(mapping401Raw);
    const priceHist401 = build401PriceHistory(cardPrices401Raw);
    apply401Data(cards, mapping401, priceHist401);
    priceHistory401Map = build401PerCardHistory(cards, mapping401, priceHist401);
    snapshotDates401 = computeSnapshotDates401(priceHist401);

    filterOptions = buildFilterOptions(cards);

    return { cards, priceHistoryMap, filterOptions };
  }

  function getPriceHistory(card) {
    const key = `${card.set}|${card.collector_number}`;
    return priceHistoryMap.get(key) || [];
  }

  function getPriceHistory401(card) {
    return priceHistory401Map.get(card.id) || [];
  }

  function getSnapshotDates401() {
    return snapshotDates401;
  }

  return { load, getPriceHistory, getPriceHistory401, getSnapshotDates401 };
})();
