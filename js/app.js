const App = (() => {
  let allCards = [];
  let totalCount = 0;
  let analyticsRendered = false;
  let analytics401Rendered = false;

  async function init() {
    try {
      const { cards, priceHistoryMap, filterOptions } = await DataModule.load();
      allCards = cards;
      totalCount = cards.length;

      FiltersModule.init(filterOptions, onFilterChange);
      GridModule.init(onCardClick);
      ModalModule.init();
      AnalyticsModule.init(cards, priceHistoryMap, filterOptions);
      Analytics401Module.init(cards, filterOptions);

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

      // Mobile filter drawer
      initFilterDrawer();

      refresh();
      hideLoading();
    } catch (err) {
      console.error('Failed to load data:', err);
      document.getElementById('loading-overlay').innerHTML =
        `<p style="color: #d4451a;">Failed to load card data. Please verify the app is running inside Keboola Data Apps with a valid storage token.</p>`;
    }
  }

  function initFilterDrawer() {
    const toggle = document.getElementById('filter-drawer-toggle');
    const close = document.getElementById('filter-drawer-close');
    const backdrop = document.getElementById('filter-drawer-backdrop');
    const sidebar = document.getElementById('filters-sidebar');

    if (!toggle || !close || !backdrop || !sidebar) return;

    const open = () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    const hide = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', open);
    close.addEventListener('click', hide);
    backdrop.addEventListener('click', hide);

    // Close drawer when switching to Analytics tab (filters are Browse-only)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', hide);
    });

    // Close drawer with Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) hide();
    });
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

        // Show/hide browse-specific controls (via class, so media queries can override)
        const isBrowse = tab === 'browse';
        document.body.classList.toggle('on-analytics-tab', !isBrowse);

        // Render analytics on first visit (deferred for performance)
        if (tab === 'analytics' && !analyticsRendered) {
          analyticsRendered = true;
          // Small delay to let the tab show before heavy rendering
          requestAnimationFrame(() => AnalyticsModule.render());
        }
        if (tab === '401' && !analytics401Rendered) {
          analytics401Rendered = true;
          requestAnimationFrame(() => Analytics401Module.render());
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
