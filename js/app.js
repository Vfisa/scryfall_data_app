const App = (() => {
  let allCards = [];
  let totalCount = 0;

  async function init() {
    try {
      const { cards, filterOptions } = await DataModule.load();
      allCards = cards;
      totalCount = cards.length;

      FiltersModule.init(filterOptions, onFilterChange);
      GridModule.init(onCardClick);
      ModalModule.init();

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

      refresh();
      hideLoading();
    } catch (err) {
      console.error('Failed to load data:', err);
      document.getElementById('loading-overlay').innerHTML =
        `<p style="color: #d4451a;">Failed to load card data. Please verify the app is running inside Keboola Data Apps with a valid storage token.</p>`;
    }
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
