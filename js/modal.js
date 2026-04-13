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

    // Links (under image)
    const linksEl = document.getElementById('modal-links');
    linksEl.innerHTML = '';

    if (card.scryfall_uri) {
      const a = document.createElement('a');
      a.className = 'modal-link';
      a.href = card.scryfall_uri;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Scryfall';
      linksEl.appendChild(a);
    }

    if (card.tcgplayer_id) {
      const a = document.createElement('a');
      a.className = 'modal-link';
      a.href = `https://www.tcgplayer.com/product/${card.tcgplayer_id}/`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'TCGplayer';
      linksEl.appendChild(a);
    }

    // Current prices
    const pricesEl = document.getElementById('modal-prices');
    pricesEl.innerHTML = '';
    renderPriceCard(pricesEl, 'USD', card.prices_usd, 'usd');
    renderPriceCard(pricesEl, 'Foil', card.prices_usd_foil, 'foil');
    renderPriceCard(pricesEl, 'Etched', card.prices_usd_etched, 'etched');

    // Price chart
    ChartModule.render(priceHistory);

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
    ChartModule.destroy();
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

  function renderPriceCard(container, label, price, type) {
    const card = document.createElement('div');
    card.className = 'price-card';
    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = `value ${price ? type : 'no-data'}`;
    valueEl.textContent = price ? `$${parseFloat(price).toFixed(2)}` : '--';
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    container.appendChild(card);
  }

  return { init, open, close };
})();
