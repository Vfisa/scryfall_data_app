const Analytics401Module = (() => {
  let allCards = [];
  let filterOptions = {};
  let charts = {};
  let initialized = false;
  let valuableSortKey = 'price';
  let valuableSortDir = 'desc';

  const CURRENCY = 'C$';
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic'];
  const RARITY_COLORS = {
    common: '#71717a', uncommon: '#94a3b8', rare: '#d4a932', mythic: '#ef4444',
  };
  const SET_COLORS = ['#6ea8fe', '#a855f7', '#f97316', '#4ade80', '#f43f5e', '#06b6d4'];

  function init(cards, options) {
    // Only include cards that are in the 401 dataset.
    allCards = cards.filter(c => c.has_401);

    // Sets present in the 401 subset only.
    const setsIn401 = new Set();
    allCards.forEach(c => { if (c.set_name) setsIn401.add(c.set_name); });
    filterOptions = {
      ...options,
      sets: [...setsIn401].sort(),
    };

    const setSelect = document.getElementById('af401-set');
    filterOptions.sets.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      setSelect.appendChild(opt);
    });

    document.querySelectorAll('#af401-price-type input').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('#af401-price-type label').forEach(l => l.classList.remove('active'));
        r.closest('label').classList.add('active');
        render();
      });
    });
    document.getElementById('af401-min-price').addEventListener('input', debounce(render, 300));
    document.getElementById('af401-set').addEventListener('change', render);
    document.getElementById('af401-rarity').addEventListener('change', render);

    document.querySelectorAll('#af401-include-toggles .af-toggle').forEach(btn => {
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
    renderMarketValueTrend(cards, opts);
    renderMovers(cards, opts);
    renderDistribution(cards, opts);
    renderTrendByRarity(opts);
    renderTrendBySet(opts);
    renderRarityDonut(cards, opts);
    renderRarityBar(cards, opts);
    renderValuableTable(cards, opts);
  }

  function getFilterOpts() {
    const priceType = document.querySelector('#af401-price-type input:checked').value;
    const includes = {};
    document.querySelectorAll('#af401-include-toggles .af-toggle').forEach(btn => {
      includes[btn.dataset.key] = btn.classList.contains('active');
    });
    return {
      priceType,
      priceField: priceType === 'cad' ? 'price_401_cad' : 'price_401_cad_foil',
      snapshotField: priceType === 'cad' ? 'cad' : 'cad_foil',
      minPrice: parseFloat(document.getElementById('af401-min-price').value) || 0,
      set: document.getElementById('af401-set').value,
      rarity: document.getElementById('af401-rarity').value,
      includes,
    };
  }

  function filterCards(opts) {
    return allCards.filter(c => {
      if (opts.set && c.set_name !== opts.set) return false;
      if (opts.rarity && c.rarity !== opts.rarity) return false;

      const inc = opts.includes;
      if (!inc.japanese && c.lang === 'ja') return false;
      if (!inc.borderless && c.border_color === 'borderless') return false;
      if (!inc.fullArt && c.full_art) return false;
      if (!inc.foil && c.foil && !c.nonfoil) return false;
      if (!inc.regular) {
        const isSpecial = c.lang === 'ja' || c.border_color === 'borderless' || c.full_art || (c.foil && !c.nonfoil);
        if (!isSpecial) return false;
      }

      return true;
    });
  }

  function getPrice(card, opts) {
    const v = card[opts.priceField];
    return v === null || v === undefined ? 0 : parseFloat(v) || 0;
  }

  function getPricedCards(cards, opts) {
    return cards.filter(c => getPrice(c, opts) >= opts.minPrice && getPrice(c, opts) > 0);
  }

  function getHistory(card) {
    return DataModule.getPriceHistory401(card);
  }

  function getLatestPrice(card, opts) {
    const hist = getHistory(card);
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = hist[i][opts.snapshotField];
      const n = v === null || v === undefined ? 0 : parseFloat(v) || 0;
      if (n > 0) return n;
    }
    return getPrice(card, opts);
  }

  function getPriceChange(card, opts) {
    const hist = getHistory(card);
    if (hist.length < 2) return null;

    let curr = 0, prev = 0, foundCurr = false;
    for (let i = hist.length - 1; i >= 0; i--) {
      const v = hist[i][opts.snapshotField];
      const n = v === null || v === undefined ? 0 : parseFloat(v) || 0;
      if (n > 0 && !foundCurr) { curr = n; foundCurr = true; }
      else if (n > 0 && foundCurr) { prev = n; break; }
    }

    if (prev === 0 || curr === 0) return null;
    if (prev === curr) return { prev, curr, change: 0, pct: 0 };

    const change = curr - prev;
    const pct = (change / prev) * 100;
    return { prev, curr, change, pct };
  }

  function getSnapshotDates() {
    return DataModule.getSnapshotDates401();
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

    const container = document.getElementById('market-overview-401');
    container.innerHTML = '';
    const stats = [
      { label: 'Cards Tracked', value: priced.length.toLocaleString(), cls: '' },
      { label: 'Total Market Value', value: `${CURRENCY}${total.toFixed(2)}`, cls: '' },
      { label: 'Average Price', value: `${CURRENCY}${avg.toFixed(2)}`, cls: '' },
      { label: 'Median Price', value: `${CURRENCY}${median.toFixed(2)}`, cls: '' },
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

  // ===== Section 1b: Total Market Value Over Time =====
  function renderMarketValueTrend(cards, opts) {
    const snapDates = getSnapshotDates();
    const canvas = document.getElementById('chart-market-value-trend-401');
    if (!canvas) return;
    if (snapDates.length < 1) {
      destroyChart('trendMarketValue');
      return;
    }

    const totals = snapDates.map(date => {
      let sum = 0;
      cards.forEach(c => {
        const hist = getHistory(c);
        const snap = hist.find(h => h.date === date);
        if (snap) {
          const v = snap[opts.snapshotField];
          const n = v === null || v === undefined ? 0 : parseFloat(v) || 0;
          if (n >= opts.minPrice) sum += n;
        }
      });
      return Math.round(sum * 100) / 100;
    });

    destroyChart('trendMarketValue');
    charts.trendMarketValue = new Chart(canvas, {
      type: 'line',
      data: {
        labels: snapDates,
        datasets: [{
          label: 'Total Market Value',
          data: totals,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.15)',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          spanGaps: true,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: scaleDef(),
          y: {
            ...scaleDef(), beginAtZero: true,
            ticks: { ...scaleDef().ticks, callback: v => `${CURRENCY}${Number(v).toLocaleString()}` },
          },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: { display: false },
          tooltip: {
            ...chartDefaults().plugins.tooltip,
            callbacks: {
              label: ctx => `Total: ${CURRENCY}${Number(ctx.parsed.y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
          },
        },
      },
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

    document.getElementById('top-gainers-401').innerHTML = buildMoversTable(gainers, true);
    document.getElementById('top-losers-401').innerHTML = buildMoversTable(losers, false);

    document.querySelectorAll('#top-gainers-401 .mover-name-link, #top-losers-401 .mover-name-link').forEach(el => {
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
        <td class="mover-prices">${CURRENCY}${m.prev.toFixed(2)} &rarr; ${CURRENCY}${m.curr.toFixed(2)}</td>
        <td class="mover-change ${cls}">${sign}${CURRENCY}${m.change.toFixed(2)}<br><small>${sign}${m.pct.toFixed(1)}%</small></td>
      </tr>`;
    }).join('');
    return `<table class="movers-table"><tbody>${rows}</tbody></table>`;
  }

  // ===== Section 3: Price Distribution =====
  function renderDistribution(cards, opts) {
    const buckets = [
      { label: `${CURRENCY}0-${CURRENCY}1`, min: 0, max: 1 },
      { label: `${CURRENCY}1-${CURRENCY}2`, min: 1, max: 2 },
      { label: `${CURRENCY}2-${CURRENCY}5`, min: 2, max: 5 },
      { label: `${CURRENCY}5-${CURRENCY}10`, min: 5, max: 10 },
      { label: `${CURRENCY}10-${CURRENCY}25`, min: 10, max: 25 },
      { label: `${CURRENCY}25-${CURRENCY}50`, min: 25, max: 50 },
      { label: `${CURRENCY}50+`, min: 50, max: Infinity },
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
    charts.distribution = new Chart(document.getElementById('chart-distribution-401'), {
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
            const v = snap[opts.snapshotField];
            const n = v === null || v === undefined ? 0 : parseFloat(v) || 0;
            if (n >= opts.minPrice) prices.push(n);
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
    charts.trendRarity = new Chart(document.getElementById('chart-trend-rarity-401'), {
      type: 'line',
      data: { labels: snapDates, datasets },
      options: {
        ...chartDefaults(),
        scales: { x: scaleDef(), y: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `${CURRENCY}${v}` } } },
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
            const v = snap[opts.snapshotField];
            const n = v === null || v === undefined ? 0 : parseFloat(v) || 0;
            if (n >= opts.minPrice) prices.push(n);
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
    charts.trendSet = new Chart(document.getElementById('chart-trend-set-401'), {
      type: 'line',
      data: { labels: snapDates, datasets },
      options: {
        ...chartDefaults(),
        scales: { x: scaleDef(), y: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `${CURRENCY}${v}` } } },
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
    charts.rarityDonut = new Chart(document.getElementById('chart-rarity-donut-401'), {
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
            callbacks: { label: ctx => `${ctx.label}: ${CURRENCY}${ctx.parsed.toFixed(2)}` },
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
    charts.rarityBar = new Chart(document.getElementById('chart-rarity-bar-401'), {
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
        scales: { x: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `${CURRENCY}${v}` } }, y: scaleDef() },
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
    const container = document.getElementById('valuable-table-wrap-401');
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
        changeHtml = `<span class="mover-change ${cls}">${sign}${CURRENCY}${item.change.change.toFixed(2)}</span>`;
      }
      const img = c.image_small || '';
      const cardIdx = allCards.indexOf(c);
      const url401 = opts.priceType === 'cad_foil' ? (c.url_401_foil || c.url_401) : (c.url_401 || c.url_401_foil);
      const link401 = url401 ? `<a href="${url401}" target="_blank" class="vt-link">401</a>` : '';
      const scry = c.scryfall_uri ? `<a href="${c.scryfall_uri}" target="_blank" class="vt-link">Scry</a>` : '';
      return `<tr>
        <td class="vt-rank">${i + 1}</td>
        <td><img class="mover-thumb" src="${img}" alt="" loading="lazy"></td>
        <td><a href="#" class="vt-name-link" data-card-idx="${cardIdx}">${c.name}</a></td>
        <td>${c.set_name}</td>
        <td><span class="rarity-badge rarity-${c.rarity}">${c.rarity}</span></td>
        <td class="vt-price">${CURRENCY}${item.price.toFixed(2)}</td>
        <td>${changeHtml}</td>
        <td>${scry} ${link401}</td>
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

    container.querySelectorAll('.vt-name-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const idx = parseInt(el.dataset.cardIdx);
        if (!isNaN(idx) && allCards[idx]) ModalModule.open(allCards[idx]);
      });
    });
  }

  // ===== Helpers =====
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
