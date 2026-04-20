const ChartModule = (() => {
  const instances = new Map(); // containerId → Chart instance

  // seriesDefs: [{ key, label, color }] — `key` selects the field on each point.
  // currency: '$' | 'C$' — used for tooltip and Y-axis tick labels.
  function renderSeries(containerId, priceHistory, seriesDefs, currency = '$') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const hasAnyPrice = priceHistory.some(p => seriesDefs.some(def => p[def.key] !== null && p[def.key] !== '' && p[def.key] !== undefined));

    if (!hasAnyPrice || priceHistory.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-price-data';
      msg.textContent = 'No price history available';
      container.appendChild(msg);
      destroy(containerId);
      return;
    }

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const labels = priceHistory.map(p => p.date);
    const datasets = [];

    seriesDefs.forEach(def => {
      const data = priceHistory.map(p => {
        const v = p[def.key];
        if (v === null || v === '' || v === undefined) return null;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      });
      if (data.some(v => v !== null)) {
        const hexAlpha = def.color + '1a'; // ~10% opacity
        datasets.push({
          label: def.label,
          data,
          borderColor: def.color,
          backgroundColor: hexAlpha,
          pointBackgroundColor: def.color,
          tension: 0.3,
          pointRadius: 4,
          spanGaps: true,
        });
      }
    });

    destroy(containerId);
    const instance = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#a0a0a0', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#1a1a2e',
            borderColor: '#2a2a4a',
            borderWidth: 1,
            titleColor: '#e0e0e0',
            bodyColor: '#a0a0a0',
            callbacks: {
              label: ctx => {
                if (ctx.parsed.y === null) return null;
                return `${ctx.dataset.label}: ${currency}${ctx.parsed.y.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#6a6a8a', font: { size: 10 } },
            grid: { color: 'rgba(42, 42, 74, 0.5)' },
          },
          y: {
            ticks: {
              color: '#6a6a8a',
              font: { size: 10 },
              callback: val => `${currency}${val}`,
            },
            grid: { color: 'rgba(42, 42, 74, 0.5)' },
            beginAtZero: true,
          },
        },
      },
    });
    instances.set(containerId, instance);
  }

  // Backward-compatible: renders TCGPlayer USD/Foil/Etched into the default container.
  function render(priceHistory) {
    renderSeries(
      'price-chart-container',
      priceHistory,
      [
        { key: 'usd', label: 'USD', color: '#4ade80' },
        { key: 'usd_foil', label: 'Foil', color: '#c084fc' },
        { key: 'usd_etched', label: 'Etched', color: '#60a5fa' },
      ],
      '$'
    );
  }

  function render401(priceHistory) {
    renderSeries(
      'price-chart-401-container',
      priceHistory,
      [
        { key: 'cad', label: 'CAD', color: '#f97316' },
        { key: 'cad_foil', label: 'CAD Foil', color: '#f43f5e' },
      ],
      'C$'
    );
  }

  function destroy(containerId) {
    if (containerId) {
      const inst = instances.get(containerId);
      if (inst) { inst.destroy(); instances.delete(containerId); }
      return;
    }
    instances.forEach(inst => inst.destroy());
    instances.clear();
  }

  return { render, render401, destroy };
})();
