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

    // Stats chips
    const statsEl = document.getElementById('modal-stats');
    statsEl.innerHTML = '';
    addStat(statsEl, 'Rarity', card.rarity, `rarity-badge rarity-${card.rarity}`);
    if (card.cmc) addStat(statsEl, 'CMC', card.cmc);
    if (card.power || card.toughness) addStat(statsEl, 'P/T', `${card.power}/${card.toughness}`);
    if (card.loyalty) addStat(statsEl, 'Loyalty', card.loyalty);
    if (card.color_identity.length) addStat(statsEl, 'Colors', card.color_identity.join(', '));
    if (card.keywords) addStat(statsEl, 'Keywords', card.keywords);
    if (card.layout) addStat(statsEl, 'Layout', card.layout);
    if (card.full_art) addStat(statsEl, 'Full Art', 'Yes');
    addStat(statsEl, 'Finishes', card.finishes || (card.foil ? 'Foil' : 'Nonfoil'));

    // Links
    const linksEl = document.getElementById('modal-links');
    linksEl.innerHTML = '';

    if (card.scryfall_uri) {
      const a = document.createElement('a');
      a.className = 'modal-link';
      a.href = card.scryfall_uri;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '\u{1F50D} Scryfall';
      linksEl.appendChild(a);
    }

    if (card.tcgplayer_id) {
      const a = document.createElement('a');
      a.className = 'modal-link';
      a.href = `https://www.tcgplayer.com/product/${card.tcgplayer_id}/`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '\u{1F6D2} TCGplayer';
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

    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    ChartModule.destroy();
  }

  function addStat(container, label, value, badgeClass) {
    const chip = document.createElement('div');
    chip.className = 'stat-chip';
    if (badgeClass) {
      chip.innerHTML = `<strong>${label}:</strong> <span class="${badgeClass}">${value}</span>`;
    } else {
      chip.innerHTML = `<strong>${label}:</strong> ${value}`;
    }
    container.appendChild(chip);
  }

  function renderPriceCard(container, label, price, type) {
    const card = document.createElement('div');
    card.className = 'price-card';
    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = `value ${type}`;
    valueEl.textContent = price ? `$${parseFloat(price).toFixed(2)}` : '--';
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    container.appendChild(card);
  }

  return { init, open, close };
})();
