const AnalyticsModule = (() => {
  let allCards = [];
  let priceHistoryMap = null;
  let filterOptions = {};
  let charts = {};
  let initialized = false;

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
    return {
      priceType,
      priceField: priceType === 'usd' ? 'prices_usd' : priceType === 'foil' ? 'prices_usd_foil' : 'prices_usd_etched',
      snapshotField: priceType === 'usd' ? 'usd' : priceType === 'foil' ? 'usd_foil' : 'usd_etched',
      minPrice: parseFloat(document.getElementById('af-min-price').value) || 0,
      set: document.getElementById('af-set').value,
      rarity: document.getElementById('af-rarity').value,
    };
  }

  function filterCards(opts) {
    return allCards.filter(c => {
      if (opts.set && c.set_name !== opts.set) return false;
      if (opts.rarity && c.rarity !== opts.rarity) return false;
      return true;
    });
  }

  function getPrice(card, opts) {
    return parseFloat(card[opts.priceField]) || 0;
  }

  function getPricedCards(cards, opts) {
    return cards.filter(c => getPrice(c, opts) >= opts.minPrice);
  }

  // ===== Section 1: Market Overview =====
  function renderOverview(cards, opts) {
    const priced = getPricedCards(cards, opts);
    const prices = priced.map(c => getPrice(c, opts)).sort((a, b) => a - b);
    const total = prices.reduce((s, p) => s + p, 0);
    const avg = prices.length ? total / prices.length : 0;
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

    // Compute rising/falling/stable
    let rising = 0, falling = 0, stable = 0;
    priced.forEach(c => {
      const hist = getHistory(c);
      if (hist.length < 2) { stable++; return; }
      const prev = parseFloat(hist[hist.length - 2][opts.snapshotField]) || 0;
      const curr = parseFloat(hist[hist.length - 1][opts.snapshotField]) || 0;
      if (curr > prev) rising++;
      else if (curr < prev) falling++;
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
      const hist = getHistory(c);
      if (hist.length < 2) return;
      const prev = parseFloat(hist[hist.length - 2][opts.snapshotField]) || 0;
      const curr = parseFloat(hist[hist.length - 1][opts.snapshotField]) || 0;
      if (prev < opts.minPrice && curr < opts.minPrice) return;
      const change = curr - prev;
      const pct = prev > 0 ? (change / prev) * 100 : (curr > 0 ? 100 : 0);
      movers.push({ card: c, prev, curr, change, pct });
    });

    movers.sort((a, b) => b.pct - a.pct);
    const gainers = movers.filter(m => m.change > 0).slice(0, 10);
    const losers = movers.filter(m => m.change < 0).sort((a, b) => a.pct - b.pct).slice(0, 10);

    document.getElementById('top-gainers').innerHTML = buildMoversTable(gainers, true);
    document.getElementById('top-losers').innerHTML = buildMoversTable(losers, false);
  }

  function buildMoversTable(movers, isGain) {
    if (!movers.length) return '<div class="no-data">No data for current filters</div>';
    const rows = movers.map(m => {
      const c = m.card;
      const cls = isGain ? 'gain' : 'loss';
      const sign = isGain ? '+' : '';
      const img = c.image_small || c.image_normal || '';
      return `<tr>
        <td><img class="mover-thumb" src="${img}" alt="" loading="lazy"></td>
        <td><span class="mover-name">${c.name}</span><br><span class="mover-set">${c.set_name} &middot; <span class="rarity-badge rarity-${c.rarity}">${c.rarity}</span></span></td>
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
      const p = getPrice(c, opts);
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

    const datasets = RARITY_ORDER.map((r, i) => {
      const avgByDate = snapDates.map(date => {
        const prices = [];
        allCards.filter(c => c.rarity === r).forEach(c => {
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

    const sets = filterOptions.sets;
    const datasets = sets.map((s, i) => {
      const avgByDate = snapDates.map(date => {
        const prices = [];
        allCards.filter(c => c.set_name === s).forEach(c => {
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
    cards.forEach(c => { const p = getPrice(c, opts); if (p > 0 && totals[c.rarity] !== undefined) totals[c.rarity] += p; });

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
      const p = getPrice(c, opts);
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
    const priced = getPricedCards(cards, opts)
      .sort((a, b) => getPrice(b, opts) - getPrice(a, opts))
      .slice(0, 50);

    const container = document.getElementById('valuable-table-wrap');
    if (!priced.length) { container.innerHTML = '<div class="no-data">No priced cards for current filters</div>'; return; }

    const rows = priced.map((c, i) => {
      const p = getPrice(c, opts);
      const hist = getHistory(c);
      let changeHtml = '<span class="mover-change stable">--</span>';
      if (hist.length >= 2) {
        const prev = parseFloat(hist[hist.length - 2][opts.snapshotField]) || 0;
        const curr = parseFloat(hist[hist.length - 1][opts.snapshotField]) || 0;
        const ch = curr - prev;
        if (ch !== 0) {
          const cls = ch > 0 ? 'gain' : 'loss';
          const sign = ch > 0 ? '+' : '';
          changeHtml = `<span class="mover-change ${cls}">${sign}$${ch.toFixed(2)}</span>`;
        }
      }
      const img = c.image_small || '';
      const tcg = c.tcgplayer_id ? `<a href="https://www.tcgplayer.com/product/${c.tcgplayer_id}/" target="_blank" class="vt-link">TCG</a>` : '';
      const scry = c.scryfall_uri ? `<a href="${c.scryfall_uri}" target="_blank" class="vt-link">Scry</a>` : '';
      return `<tr>
        <td class="vt-rank">${i + 1}</td>
        <td><img class="mover-thumb" src="${img}" alt="" loading="lazy"></td>
        <td><span class="mover-name">${c.name}</span></td>
        <td>${c.set_name}</td>
        <td><span class="rarity-badge rarity-${c.rarity}">${c.rarity}</span></td>
        <td class="vt-price">$${p.toFixed(2)}</td>
        <td>${changeHtml}</td>
        <td>${scry} ${tcg}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table class="valuable-table">
      <thead><tr><th>#</th><th></th><th>Name</th><th>Set</th><th>Rarity</th><th>Price</th><th>Change</th><th>Links</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ===== Section 7: Artist Portfolio =====
  function renderArtists(cards, opts) {
    const artistVal = {};
    cards.forEach(c => {
      const p = getPrice(c, opts);
      if (p > 0 && c.artist) {
        artistVal[c.artist] = (artistVal[c.artist] || 0) + p;
      }
    });
    const sorted = Object.entries(artistVal).sort((a, b) => b[1] - a[1]).slice(0, 15);

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
        scales: { x: { ...scaleDef(), beginAtZero: true, ticks: { ...scaleDef().ticks, callback: v => `$${v}` } }, y: { ...scaleDef(), ticks: { ...scaleDef().ticks, font: { size: 11 } } } },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
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
