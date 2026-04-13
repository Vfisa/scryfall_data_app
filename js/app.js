const App = (() => {
  let allCards = [];
  let totalCount = 0;
  let analyticsRendered = false;

  async function init() {
    try {
      const { cards, priceHistoryMap, filterOptions } = await DataModule.load();
      allCards = cards;
      totalCount = cards.length;

      FiltersModule.init(filterOptions, onFilterChange);
      GridModule.init(onCardClick);
      ModalModule.init();
      AnalyticsModule.init(cards, priceHistoryMap, filterOptions);

      // Sort control
      document.getElementById('sort-select').addEventListener('change', e => {
        GridModule.setSort(e.target.value);
        refresh();
      });

      // Search input
      document.getElementById('search-input').addEventListener('input', () => {
        clearTimeout(App._searchTimer);
        App._searchTimer = setTimeout(refresh, 200);
      });

      // Tab switching
      initTabs();

      refresh();
      hideLoading();
    } catch (err) {
      console.error('Failed to load data:', err);
      document.getElementById('loading-overlay').innerHTML =
        `<p style="color: #d4451a;">Failed to load card data. Please verify the app is running inside Keboola Data Apps with a valid storage token.</p>`;
    }
  }

  function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const browseControls = document.querySelector('.header-controls');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Update buttons
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update pages
        document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        // Show/hide browse-specific controls
        const isBrowse = tab === 'browse';
        browseControls.style.display = isBrowse ? 'flex' : 'none';
        document.getElementById('card-count').style.display = isBrowse ? 'inline' : 'none';

        // Render analytics on first visit (deferred for performance)
        if (tab === 'analytics' && !analyticsRendered) {
          analyticsRendered = true;
          // Small delay to let the tab show before heavy rendering
          requestAnimationFrame(() => AnalyticsModule.render());
        }
      });
    });
  }

  function refresh() {
    const searchTerm = document.getElementById('search-input').value.trim();
    const filtered = FiltersModule.filterCards(allCards, searchTerm);
    GridModule.render(filtered, totalCount);
  }

  function onFilterChange() {
    refresh();
  }

  function onCardClick(card) {
    ModalModule.open(card);
  }

  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 400);
  }

  return { init, _searchTimer: null };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
