const ModalModule = (() => {
  let backdrop = null;

  function init() {
    backdrop = document.getElementById('card-modal-backdrop');
    document.getElementById('modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  function open(card) {
    const priceHistory = DataModule.getPriceHistory(card);
    const priceHistory401 = DataModule.getPriceHistory401(card);

    // Image
    const imgEl = document.getElementById('modal-image');
    imgEl.src = card.image_large || card.image_normal || '';
    imgEl.alt = card.name;

    // Name & set
    document.getElementById('modal-card-name').textContent = card.name;
    document.getElementById('modal-set-info').textContent =
      `${card.set_name} \u2022 #${card.collector_number} \u2022 ${card.artist}`;

    // Type line
    document.getElementById('modal-type-line').textContent = card.type_line;

    // Mana cost
    const manaEl = document.getElementById('modal-mana-cost');
    if (card.mana_cost) {
      manaEl.innerHTML = GridModule.renderManaCost(card.mana_cost, false);
      manaEl.style.display = 'flex';
    } else {
      manaEl.style.display = 'none';
    }

    // Oracle text
    const oracleEl = document.getElementById('modal-oracle-text');
    if (card.oracle_text) {
      oracleEl.textContent = card.oracle_text;
      oracleEl.style.display = 'block';
    } else {
      oracleEl.style.display = 'none';
    }

    // Flavor text
    const flavorEl = document.getElementById('modal-flavor-text');
    if (card.flavor_text) {
      flavorEl.textContent = card.flavor_text;
      flavorEl.style.display = 'block';
    } else {
      flavorEl.style.display = 'none';
    }

    // Stats grid
    const statsEl = document.getElementById('modal-stats');
    statsEl.innerHTML = '';
    addStat(statsEl, 'Rarity', card.rarity);
    if (card.cmc) addStat(statsEl, 'CMC', card.cmc);
    if (card.power || card.toughness) addStat(statsEl, 'P/T', `${card.power}/${card.toughness}`);
    if (card.loyalty) addStat(statsEl, 'Loyalty', card.loyalty);
    if (card.color_identity.length) addStat(statsEl, 'Colors', card.color_identity.join(' '));
    if (card.keywords) addStat(statsEl, 'Keywords', cleanArrayString(card.keywords));
    if (card.full_art) addStat(statsEl, 'Full Art', 'Yes');
    if (card.border_color) addStat(statsEl, 'Border', card.border_color);
    addStat(statsEl, 'Finishes', formatFinishes(card));

    // Unified Notes — TCGPlayer grade badge + merged list of TCGPlayer commentary
    // and Strixhaven tips, each labeled with its source. Rendered subtly.
    const notesEl = document.getElementById('modal-notes-section');
    notesEl.innerHTML = '';

    const hasAnyNote = card.tcgplayer_grade
      || card.tcgplayer_commentary
      || (card.tips && card.tips.length);

    if (hasAnyNote) {
      const heading = document.createElement('h4');
      heading.className = 'modal-notes-heading';
      heading.textContent = 'Notes';
      notesEl.appendChild(heading);

      if (card.tcgplayer_grade) {
        const gradeEl = document.createElement('div');
        gradeEl.className = 'modal-notes-grade';
        const gradeLabel = document.createElement('span');
        gradeLabel.className = 'modal-notes-grade-label';
        gradeLabel.textContent = 'TCGPlayer Grade';
        const gradeValue = document.createElement('span');
        gradeValue.className = 'modal-notes-grade-value';
        gradeValue.textContent = card.tcgplayer_grade;
        gradeEl.appendChild(gradeLabel);
        gradeEl.appendChild(gradeValue);
        notesEl.appendChild(gradeEl);
      }

      const list = document.createElement('ul');
      list.className = 'modal-notes-list';

      const addNote = (source, text) => {
        const li = document.createElement('li');
        li.className = 'modal-note';
        const src = document.createElement('span');
        src.className = 'modal-note-source';
        src.textContent = source;
        const body = document.createElement('span');
        body.className = 'modal-note-body';
        body.textContent = text;
        li.appendChild(src);
        li.appendChild(body);
        list.appendChild(li);
      };

      if (card.tcgplayer_commentary) addNote('TCGPlayer', card.tcgplayer_commentary);
      (card.tips || []).forEach(t => addNote('cardgamebase', t));

      if (list.children.length) notesEl.appendChild(list);
    }

    // Links (under image) — two rows: primary (Scryfall + TCGplayer), 401 (401 + 401 Foil)
    const linksEl = document.getElementById('modal-links');
    linksEl.innerHTML = '';

    const primaryRow = document.createElement('div');
    primaryRow.className = 'modal-links-row';
    const row401 = document.createElement('div');
    row401.className = 'modal-links-row';

    const addLink = (row, href, text) => {
      const a = document.createElement('a');
      a.className = 'modal-link';
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = text;
      row.appendChild(a);
    };

    if (card.scryfall_uri) addLink(primaryRow, card.scryfall_uri, 'Scryfall');
    if (card.tcgplayer_id) addLink(primaryRow, `https://www.tcgplayer.com/product/${card.tcgplayer_id}/`, 'TCGplayer');
    if (card.url_401) addLink(row401, card.url_401, '401 Games');
    if (card.url_401_foil) addLink(row401, card.url_401_foil, '401 Games (Foil)');

    if (primaryRow.children.length) linksEl.appendChild(primaryRow);
    if (row401.children.length) linksEl.appendChild(row401);

    // Current prices
    const pricesEl = document.getElementById('modal-prices');
    pricesEl.innerHTML = '';
    renderPriceCard(pricesEl, 'USD TCGP', card.prices_usd, 'usd', '$');
    renderPriceCard(pricesEl, 'FOIL TCGP', card.prices_usd_foil, 'foil', '$');
    renderPriceCard(pricesEl, 'ETCHED TCGP', card.prices_usd_etched, 'etched', '$');
    renderPriceCard(pricesEl, 'CAD 401', card.price_401_cad, 'cad', 'C$');
    renderPriceCard(pricesEl, 'CAD FOIL 401', card.price_401_cad_foil, 'cad-foil', 'C$');

    // Price charts — shared X axis: union of dates from both series, last 14 days.
    const sharedDates = buildSharedDateRange(priceHistory, priceHistory401, 14);
    ChartModule.render(projectSeries(priceHistory, sharedDates));
    ChartModule.render401(projectSeries(priceHistory401, sharedDates));

    // Scroll modal to top
    document.getElementById('card-modal').scrollTop = 0;
    const infoCol = document.querySelector('.modal-info-col');
    if (infoCol) infoCol.scrollTop = 0;

    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    ChartModule.destroy('price-chart-container');
    ChartModule.destroy('price-chart-401-container');
  }

  function addStat(container, label, value) {
    const chip = document.createElement('div');
    chip.className = 'stat-chip';
    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'stat-value';
    valueEl.textContent = value;
    chip.appendChild(labelEl);
    chip.appendChild(valueEl);
    container.appendChild(chip);
  }

  function formatFinishes(card) {
    const finishes = cleanArrayString(card.finishes);
    if (finishes) return finishes;
    const parts = [];
    if (card.nonfoil) parts.push('Nonfoil');
    if (card.foil) parts.push('Foil');
    return parts.join(', ') || 'Nonfoil';
  }

  function cleanArrayString(val) {
    if (!val) return '';
    // Turn ["nonfoil", "foil"] into "Nonfoil, Foil"
    try {
      const arr = JSON.parse(val.replace(/'/g, '"'));
      if (Array.isArray(arr)) {
        return arr.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
      }
    } catch {}
    return val;
  }

  // Union of dates from both price-history arrays, sorted, trimmed to the most recent `maxDays`.
  // Ensures both modal charts share the same X-axis window.
  function buildSharedDateRange(h1, h2, maxDays) {
    const all = new Set();
    h1.forEach(p => { if (p.date) all.add(p.date); });
    h2.forEach(p => { if (p.date) all.add(p.date); });
    const sorted = [...all].sort();
    return sorted.slice(-maxDays);
  }

  // Reindex a price-history series onto the given date list. Missing dates yield
  // a `{date}` stub so Chart.js (with spanGaps) renders a gap at that x tick.
  function projectSeries(hist, dates) {
    const byDate = new Map(hist.map(p => [p.date, p]));
    return dates.map(d => byDate.get(d) || { date: d });
  }

  function renderPriceCard(container, label, price, type, currency = '$') {
    const card = document.createElement('div');
    card.className = 'price-card';
    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    const hasPrice = price !== null && price !== undefined && price !== '' && !Number.isNaN(parseFloat(price));
    valueEl.className = `value ${hasPrice ? type : 'no-data'}`;
    valueEl.textContent = hasPrice ? `${currency}${parseFloat(price).toFixed(2)}` : '--';
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    container.appendChild(card);
  }

  return { init, open, close };
})();
