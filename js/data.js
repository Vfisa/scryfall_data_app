const DataModule = (() => {
  let cards = [];
  let priceHistoryMap = new Map();
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
    const [cardsRaw, snapshotsRaw, tcgplayerRaw] = await Promise.all([
      loadCSV('/api/tables/cards'),
      loadCSV('/api/tables/snapshots'),
      loadCSV('/api/tables/tcgplayer').catch(err => {
        console.warn('Failed to load tcgplayer data:', err);
        return [];
      }),
    ]);

    cards = cardsRaw.map(parseCard);
    priceHistoryMap = buildPriceHistory(snapshotsRaw);
    const tcgMap = buildTcgplayerMap(tcgplayerRaw);
    applyTcgplayerData(cards, tcgMap);
    filterOptions = buildFilterOptions(cards);

    return { cards, priceHistoryMap, filterOptions };
  }

  function getPriceHistory(card) {
    const key = `${card.set}|${card.collector_number}`;
    return priceHistoryMap.get(key) || [];
  }

  return { load, getPriceHistory };
})();
