const AnalyticsModule = (() => {
  let allCards = [];
  let priceHistoryMap = null;
  let filterOptions = {};
  let charts = {};
  let initialized = false;
  let valuableSortKey = 'price';
  let valuableSortDir = 'desc';

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];
  const RARITY_COLORS = {
    common: '#71717a', uncommon: '#94a3b8', rare: '#d4a932', mythic: '#ef4444',
  };
  const SET_COLORS = ['#6ea8fe', '#a855f7', '#f97316', '#4ade80', '#f43f5e', '#06b6d4'];

  function init(cards, historyMap, options) {
    allCards = cards;
    priceHistoryMap = historyMap;
    filterOptions = options;

    // Populate set dropdown
    const setSelect = document.getElementById('af-set');
    options.sets.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      setSelect.appendChild(opt);
    });

    // Bind filter changes
    document.querySelectorAll('#af-price-type input').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('#af-price-type label').forEach(l => l.classList.remove('active'));
        r.closest('label').classList.add('active');
        render();
      });
    });
    document.getElementById('af-min-price').addEventListener('input', debounce(render, 300));
    document.getElementById('af-set').addEventListener('change', render);
    document.getElementById('af-rarity').addEventListener('change', render);

    // Include toggles
    document.querySelectorAll('#af-include-toggles .af-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        render();
      });
    });

    initialized = true;
  }

  function render() {
    if (!initialized) return;
    const opts = getFilterOpts();
    const cards = filterCards(opts);

    renderOverview(cards, opts);
    renderMovers(cards, opts);
    renderDistribution(cards, opts);
    renderTrendByRarity(opts);
    renderTrendBySet(opts);
    renderRarityDonut(cards, opts);
    renderRarityBar(cards, opts);
    renderValuableTable(cards, opts);
    renderArtists(cards, opts);
  }

  function getFilterOpts() {
    const priceType = document.querySelector('#af-price-type input:checked').value;
    const includes = {};
    document.querySelectorAll('#af-include-toggles .af-toggle').forEach(btn => {
      includes[btn.dataset.key] = btn.classList.contains('active');
    });
    return {
      priceType,
      priceField: priceType === 'usd' ? 'prices_usd' : priceType === 'foil' ? 'prices_usd_foil' : 'prices_usd_etched',
      snapshotField: priceType === 'usd' ? 'usd' : priceType === 'foil' ? 'usd_foil' : 'usd_etched',
      minPrice: parseFloat(document.getElementById('af-min-price').value) || 0,
      set: document.getElementById('af-set').value,
      rarity: document.getElementById('af-rarity').value,
      includes,
    };
  }

  function filterCards(opts) {
    return allCards.filter(c => {
      if (opts.set && c.set_name !== opts.set) return false;
      if (opts.rarity && c.rarity !== opts.rarity) return false;

      // Include toggles
      const inc = opts.includes;
      const isJapanese = c.lang === 'ja';
      const isBorderless = c.border_color === 'borderless';
      const isFullArt = c.full_art;
      const isFoilOnly = c.foil && !c.nonfoil;
      const isRegular = !isJapanese && !isBorderless && !isFullArt && !isFoilOnly;

      // Card must match at least one active include category
      let included = false;
      if (inc.regular && isRegular) included = true;
      if (inc.fullArt && isFullArt) included = true;
      if (inc.borderless && isBorderless) included = true;
      if (inc.foil && isFoilOnly) included = true;
      if (inc.japanese && isJapanese) included = true;
      if (!included) return false;

      return true;
    });
  }

  function getPrice(card, opts) {
    return parseFloat(card[opts.priceField]) || 0;
  }

  function getPricedCards(cards, opts) {
    return cards.filter(c => getPrice(c, opts) >= opts.minPrice);
  }

  // Get the latest non-zero price from snapshot history, falling back to current card price
  function getLatestPrice(card, opts) {
    const hist = getHistory(card);
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = parseFloat(hist[i][opts.snapshotField]) || 0;
      if (v > 0) return v;
    }
    return getPrice(card, opts);
  }

  // Compute real price change ignoring 0 transitions
  function getPriceChange(card, opts) {
    const hist = getHistory(card);
    if (hist.length < 2) return null;

    // Find latest non-zero and previous non-zero
    let curr = 0, prev = 0, foundCurr = false;
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = parseFloat(hist[i][opts.snapshotField]) || 0;
      if (v > 0 && !foundCurr) { curr = v; foundCurr = true; }
      else if (v > 0 && foundCurr) { prev = v; break; }
    }

    // If either is 0, no valid change
    if (prev === 0 || curr === 0) return null;
    if (prev === curr) return { prev, curr, change: 0, pct: 0 };

    const change = curr - prev;
    const pct = (change / prev) * 100;
    return { prev, curr, change, pct };
  }

  // ===== Section 1: Market Overview =====
  function renderOverview(cards, opts) {
    const priced = getPricedCards(cards, opts);
    const prices = priced.map(c => getLatestPrice(c, opts)).filter(p => p > 0).sort((a, b) => a - b);
    const total = prices.reduce((s, p) => s + p, 0);
    const avg = prices.length ? total / prices.length : 0;
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

    let rising = 0, falling = 0, stable = 0;
    priced.forEach(c => {
      const ch = getPriceChange(c, opts);
      if (!ch) { stable++; return; }
      if (ch.change > 0) rising++;
      else if (ch.change < 0) falling++;
      else stable++;
    });

    const container = document.getElementById('market-overview');
    container.innerHTML = '';
    const stats = [
      { label: 'Cards Tracked', value: priced.length.toLocaleString(), cls: '' },
      { label: 'Total Market Value', value: `$${total.toFixed(2)}`, cls: '' },
      { label: 'Average Price', value: `$${avg.toFixed(2)}`, cls: '' },
      { label: 'Median Price', value: `$${median.toFixed(2)}`, cls: '' },
      { label: 'Rising', value: rising.toLocaleString(), cls: 'stat-green' },
      { label: 'Falling', value: falling.toLocaleString(), cls: 'stat-red' },
      { label: 'Stable', value: stable.toLocaleString(), cls: 'stat-muted' },
    ];
    stats.forEach(s => {
      const card = document.createElement('div');
      card.className = 'overview-card';
      card.innerHTML = `<div class="ov-label">${s.label}</div><div class="ov-value ${s.cls}">${s.value}</div>`;
      container.appendChild(card);
    });
  }

  // ===== Section 2: Top Movers =====
  function renderMovers(cards, opts) {
    const movers = [];
    cards.forEach(c => {
      const ch = getPriceChange(c, opts);
      if (!ch || ch.change === 0) return;
      if (ch.curr < opts.minPrice && ch.prev < opts.minPrice) return;
      movers.push({ card: c, ...ch });
    });

    movers.sort((a, b) => b.pct - a.pct);
    const gainers = movers.filter(m => m.change > 0).slice(0, 10);
    const losers = movers.filter(m => m.change < 0).sort((a, b) => a.pct - b.pct).slice(0, 10);

    document.getElementById('top-gainers').innerHTML = buildMoversTable(gainers, true);
    document.getElementById('top-losers').innerHTML = buildMoversTable(losers, false);

    // Bind click handlers for card names
    document.querySelectorAll('.movers-table .mover-name-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const idx = parseInt(el.dataset.cardIdx);
        if (!isNaN(idx) && allCards[idx]) ModalModule.open(allCards[idx]);
      });
    });
  }

  function buildMoversTable(movers, isGain) {
    if (!movers.length) return '<div class="no-data">No data for current filters</div>';
    const rows = movers.map(m => {
      const c = m.card;
      const cls = isGain ? 'gain' : 'loss';
      const sign = isGain ? '+' : '';
      const img = c.image_small || c.image_normal || '';
      const cardIdx = allCards.indexOf(c);
      return `<tr>
        <td><img class="mover-thumb" src="${img}" alt="" loading="lazy"></td>
        <td><a href="#" class="mover-name-link" data-card-idx="${cardIdx}">${c.name}</a><br><span class="mover-set">${c.set_name} &middot; <span class="rarity-badge rarity-${c.rarity}">${c.rarity}</span></span></td>
        <td class="mover-prices">$${m.prev.toFixed(2)} &rarr; $${m.curr.toFixed(2)}</td>
        <td class="mover-change ${cls}">${sign}$${m.change.toFixed(2)}<br><small>${sign}${m.pct.toFixed(1)}%</small></td>
      </tr>`;
    }).join('');
    return `<table class="movers-table"><tbody>${rows}</tbody></table>`;
  }

  // ===== Section 3: Price Distribution =====
  function renderDistribution(cards, opts) {
    const buckets = [
      { label: '$0-$1', min: 0, max: 1 },
      { label: '$1-$2', min: 1, max: 2 },
      { label: '$2-$5', min: 2, max: 5 },
      { label: '$5-$10', min: 5, max: 10 },
      { label: '$10-$25', min: 10, max: 25 },
      { label: '$25-$50', min: 25, max: 50 },
      { label: '$50+', min: 50, max: Infinity },
    ];
    const data = {};
    RARITY_ORDER.forEach(r => data[r] = new Array(buckets.length).fill(0));

    cards.forEach(c => {
      const p = getLatestPrice(c, opts);
      if (p <= 0) return;
      const idx = buckets.findIndex(b => p >= b.min && p < b.max);
      if (idx >= 0 && data[c.rarity]) data[c.rarity][idx]++;
    });

    destroyChart('distribution');
    charts.distribution = new Chart(document.getElementById('chart-distribution'), {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: RARITY_ORDER.map(r => ({
          label: r.charAt(0).toUpperCase() + r.slice(1),
          data: data[r],
          backgroundColor: RARITY_COLORS[r],
        })),
      },
      options: {
        ...chartDefaults(),
        scales: { x: scaleDef(), y: { ...scaleDef(), beginAtZero: true } },
        plugins: { ...chartDefaults().plugins, legend: legendDef() },
      },
    });
  }

  // ===== Section 4: Trends =====
  function renderTrendByRarity(opts) {
    const snapDates = getSnapshotDates();
    if (snapDates.length < 1) return;

    const filteredCards = filterCards(opts);
    const datasets = RARITY_ORDER.map(r => {
      const avgByDate = snapDates.map(date => {
        const prices = [];
        filteredCards.filter(c => c.rarity === r).forEach(c => {
          const hist = getHistory(c);
          const snap = hist.find(h => h.date === date);
          if (snap) {
            const v = parseFloat(snap[opts.snapshotField]) || 0;
            if (v >= opts.minPrice) prices.push(v);
          }
        });
        return prices.length ? prices.reduce((s, v) => s + v, 0) / prices.length : null;
      });
      return {
        label: r.charAt(0).toUpperCase() + r.slice(1),
        data: avgByDate, borderColor: RARITY_COLORS[r],
        backgroundColor: RARITY_COLORS[r] + '22',
        tension: 0.3, pointRadius: 4, spanGaps: true,
      };
    });

    destroyChart('trendRarity');
    charts.trendRarity = new Chart(document.getElementById('chart-trend-rarity'), {
      type: 'line',
      data: { labels: snapDates, datasets },
      options: {
        ...chartDefaults(),
        scales: { x: scaleDef(), y: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `$${v}` } } },
        plugins: { ...chartDefaults().plugins, legend: legendDef() },
      },
    });
  }

  function renderTrendBySet(opts) {
    const snapDates = getSnapshotDates();
    if (snapDates.length < 1) return;

    const filteredCards = filterCards(opts);
    const sets = filterOptions.sets;
    const datasets = sets.map((s, i) => {
      const avgByDate = snapDates.map(date => {
        const prices = [];
        filteredCards.filter(c => c.set_name === s).forEach(c => {
          const hist = getHistory(c);
          const snap = hist.find(h => h.date === date);
          if (snap) {
            const v = parseFloat(snap[opts.snapshotField]) || 0;
            if (v >= opts.minPrice) prices.push(v);
          }
        });
        return prices.length ? prices.reduce((s, v) => s + v, 0) / prices.length : null;
      });
      return {
        label: s, data: avgByDate,
        borderColor: SET_COLORS[i % SET_COLORS.length],
        backgroundColor: SET_COLORS[i % SET_COLORS.length] + '22',
        tension: 0.3, pointRadius: 4, spanGaps: true,
      };
    });

    destroyChart('trendSet');
    charts.trendSet = new Chart(document.getElementById('chart-trend-set'), {
      type: 'line',
      data: { labels: snapDates, datasets },
      options: {
        ...chartDefaults(),
        scales: { x: scaleDef(), y: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `$${v}` } } },
        plugins: { ...chartDefaults().plugins, legend: legendDef() },
      },
    });
  }

  // ===== Section 5: Rarity Breakdown =====
  function renderRarityDonut(cards, opts) {
    const totals = {};
    RARITY_ORDER.forEach(r => totals[r] = 0);
    cards.forEach(c => { const p = getLatestPrice(c, opts); if (p > 0 && totals[c.rarity] !== undefined) totals[c.rarity] += p; });

    destroyChart('rarityDonut');
    charts.rarityDonut = new Chart(document.getElementById('chart-rarity-donut'), {
      type: 'doughnut',
      data: {
        labels: RARITY_ORDER.map(r => r.charAt(0).toUpperCase() + r.slice(1)),
        datasets: [{
          data: RARITY_ORDER.map(r => Math.round(totals[r] * 100) / 100),
          backgroundColor: RARITY_ORDER.map(r => RARITY_COLORS[r]),
          borderColor: '#1b1b22', borderWidth: 3,
        }],
      },
      options: {
        ...chartDefaults(), cutout: '55%',
        plugins: {
          ...chartDefaults().plugins, legend: legendDef(),
          tooltip: {
            ...chartDefaults().plugins.tooltip,
            callbacks: { label: ctx => `${ctx.label}: $${ctx.parsed.toFixed(2)}` },
          },
        },
      },
    });
  }

  function renderRarityBar(cards, opts) {
    const sums = {}, counts = {};
    RARITY_ORDER.forEach(r => { sums[r] = 0; counts[r] = 0; });
    cards.forEach(c => {
      const p = getLatestPrice(c, opts);
      if (p > 0 && sums[c.rarity] !== undefined) { sums[c.rarity] += p; counts[c.rarity]++; }
    });

    destroyChart('rarityBar');
    charts.rarityBar = new Chart(document.getElementById('chart-rarity-bar'), {
      type: 'bar',
      data: {
        labels: RARITY_ORDER.map(r => r.charAt(0).toUpperCase() + r.slice(1)),
        datasets: [{
          label: 'Avg Price',
          data: RARITY_ORDER.map(r => counts[r] ? Math.round((sums[r] / counts[r]) * 100) / 100 : 0),
          backgroundColor: RARITY_ORDER.map(r => RARITY_COLORS[r]),
          borderRadius: 6,
        }],
      },
      options: {
        ...chartDefaults(), indexAxis: 'y',
        scales: { x: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `$${v}` } }, y: scaleDef() },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  // ===== Section 6: Most Valuable Table =====
  function renderValuableTable(cards, opts) {
    const priced = getPricedCards(cards, opts).map(c => {
      const price = getLatestPrice(c, opts);
      const ch = getPriceChange(c, opts);
      return { card: c, price, change: ch };
    });

    // Sort
    priced.sort((a, b) => {
      let va, vb;
      switch (valuableSortKey) {
        case 'name': va = a.card.name; vb = b.card.name; return valuableSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'set': va = a.card.set_name; vb = b.card.set_name; return valuableSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'rarity':
          const ro = { common: 0, uncommon: 1, rare: 2, mythic: 3 };
          va = ro[a.card.rarity] ?? 0; vb = ro[b.card.rarity] ?? 0;
          return valuableSortDir === 'asc' ? va - vb : vb - va;
        case 'price': va = a.price; vb = b.price; return valuableSortDir === 'asc' ? va - vb : vb - va;
        case 'change':
          va = a.change ? a.change.change : 0; vb = b.change ? b.change.change : 0;
          return valuableSortDir === 'asc' ? va - vb : vb - va;
        default: return 0;
      }
    });

    const top = priced.slice(0, 50);
    const container = document.getElementById('valuable-table-wrap');
    if (!top.length) { container.innerHTML = '<div class="no-data">No priced cards for current filters</div>'; return; }

    const sortIcon = (key) => {
      if (valuableSortKey !== key) return '';
      return valuableSortDir === 'asc' ? ' &#9650;' : ' &#9660;';
    };

    const rows = top.map((item, i) => {
      const c = item.card;
      let changeHtml = '<span class="mover-change stable">--</span>';
      if (item.change && item.change.change !== 0) {
        const cls = item.change.change > 0 ? 'gain' : 'loss';
        const sign = item.change.change > 0 ? '+' : '';
        changeHtml = `<span class="mover-change ${cls}">${sign}$${item.change.change.toFixed(2)}</span>`;
      }
      const img = c.image_small || '';
      const cardIdx = allCards.indexOf(c);
      const tcg = c.tcgplayer_id ? `<a href="https://www.tcgplayer.com/product/${c.tcgplayer_id}/" target="_blank" class="vt-link">TCG</a>` : '';
      const scry = c.scryfall_uri ? `<a href="${c.scryfall_uri}" target="_blank" class="vt-link">Scry</a>` : '';
      return `<tr>
        <td class="vt-rank">${i + 1}</td>
        <td><img class="mover-thumb" src="${img}" alt="" loading="lazy"></td>
        <td><a href="#" class="vt-name-link" data-card-idx="${cardIdx}">${c.name}</a></td>
        <td>${c.set_name}</td>
        <td><span class="rarity-badge rarity-${c.rarity}">${c.rarity}</span></td>
        <td class="vt-price">$${item.price.toFixed(2)}</td>
        <td>${changeHtml}</td>
        <td>${scry} ${tcg}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table class="valuable-table">
      <thead><tr>
        <th>#</th><th></th>
        <th class="vt-sortable" data-sort="name">Name${sortIcon('name')}</th>
        <th class="vt-sortable" data-sort="set">Set${sortIcon('set')}</th>
        <th class="vt-sortable" data-sort="rarity">Rarity${sortIcon('rarity')}</th>
        <th class="vt-sortable" data-sort="price">Price${sortIcon('price')}</th>
        <th class="vt-sortable" data-sort="change">Change${sortIcon('change')}</th>
        <th>Links</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

    // Bind sort clicks
    container.querySelectorAll('.vt-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (valuableSortKey === key) {
          valuableSortDir = valuableSortDir === 'desc' ? 'asc' : 'desc';
        } else {
          valuableSortKey = key;
          valuableSortDir = key === 'name' || key === 'set' ? 'asc' : 'desc';
        }
        renderValuableTable(filterCards(getFilterOpts()), getFilterOpts());
      });
    });

    // Bind card name clicks
    container.querySelectorAll('.vt-name-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const idx = parseInt(el.dataset.cardIdx);
        if (!isNaN(idx) && allCards[idx]) ModalModule.open(allCards[idx]);
      });
    });
  }

  // ===== Section 7: Artist Portfolio =====
  function renderArtists(cards, opts) {
    const artistVal = {};
    cards.forEach(c => {
      const p = getLatestPrice(c, opts);
      if (p > 0 && c.artist) {
        artistVal[c.artist] = (artistVal[c.artist] || 0) + p;
      }
    });
    const sorted = Object.entries(artistVal).sort((a, b) => b[1] - a[1]).slice(0, 20);

    destroyChart('artists');
    charts.artists = new Chart(document.getElementById('chart-artists'), {
      type: 'bar',
      data: {
        labels: sorted.map(([name]) => name),
        datasets: [{
          label: 'Total Portfolio Value',
          data: sorted.map(([, val]) => Math.round(val * 100) / 100),
          backgroundColor: '#d4a93266',
          borderColor: '#d4a932',
          borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        ...chartDefaults(), indexAxis: 'y',
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const artistName = sorted[idx][0];
            switchToBrowseWithArtist(artistName);
          }
        },
        scales: { x: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `$${v}` } }, y: { ...scaleDef(), ticks: { ...scaleDef().ticks, font: { size: 11 } } } },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  function switchToBrowseWithArtist(artistName) {
    // Switch to Browse tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="browse"]').classList.add('active');
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-browse').classList.add('active');
    document.querySelector('.header-controls').style.display = 'flex';
    document.getElementById('card-count').style.display = 'inline';

    // Set artist filter
    FiltersModule.setArtist(artistName);
    window.scrollTo(0, 0);
  }

  // ===== Helpers =====
  function getHistory(card) {
    const key = `${card.set}|${card.collector_number}`;
    return priceHistoryMap.get(key) || [];
  }

  function getSnapshotDates() {
    const dates = new Set();
    priceHistoryMap.forEach(arr => arr.forEach(s => dates.add(s.date)));
    return [...dates].sort();
  }

  function destroyChart(name) {
    if (charts[name]) { charts[name].destroy(); charts[name] = null; }
  }

  function chartDefaults() {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          backgroundColor: '#1b1b22', borderColor: '#2c2c3e', borderWidth: 1,
          titleColor: '#eaeaf0', bodyColor: '#9d9db5',
        },
      },
    };
  }

  function scaleDef() {
    return { ticks: { color: '#5c5c76', font: { size: 11 } }, grid: { color: '#2c2c3e44' } };
  }

  function legendDef() {
    return { labels: { color: '#9d9db5', font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } };
  }

  function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { init, render };
})();
