const ChartModule = (() => {
  let chartInstance = null;

  function render(priceHistory) {
    const container = document.getElementById('price-chart-container');
    container.innerHTML = '';

    const hasAnyPrice = priceHistory.some(p => p.usd || p.usd_foil || p.usd_etched);

    if (!hasAnyPrice || priceHistory.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-price-data';
      msg.textContent = 'No price history available';
      container.appendChild(msg);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'price-chart';
    container.appendChild(canvas);

    const labels = priceHistory.map(p => p.date);

    const datasets = [];

    const usdData = priceHistory.map(p => p.usd ? parseFloat(p.usd) : null);
    if (usdData.some(v => v !== null)) {
      datasets.push({
        label: 'USD',
        data: usdData,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        pointBackgroundColor: '#4ade80',
        tension: 0.3,
        pointRadius: 4,
        spanGaps: true,
      });
    }

    const foilData = priceHistory.map(p => p.usd_foil ? parseFloat(p.usd_foil) : null);
    if (foilData.some(v => v !== null)) {
      datasets.push({
        label: 'Foil',
        data: foilData,
        borderColor: '#c084fc',
        backgroundColor: 'rgba(192, 132, 252, 0.1)',
        pointBackgroundColor: '#c084fc',
        tension: 0.3,
        pointRadius: 4,
        spanGaps: true,
      });
    }

    const etchedData = priceHistory.map(p => p.usd_etched ? parseFloat(p.usd_etched) : null);
    if (etchedData.some(v => v !== null)) {
      datasets.push({
        label: 'Etched',
        data: etchedData,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        pointBackgroundColor: '#60a5fa',
        tension: 0.3,
        pointRadius: 4,
        spanGaps: true,
      });
    }

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
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
                return `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`;
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
              callback: val => `$${val}`,
            },
            grid: { color: 'rgba(42, 42, 74, 0.5)' },
            beginAtZero: true,
          },
        },
      },
    });
  }

  function destroy() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  return { render, destroy };
})();
