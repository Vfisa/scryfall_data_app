const FiltersModule = (() => {
  let state = {
    sets: [],
    rarities: [],
    colors: [],
    artist: '',
    typeLine: '',
    fullArt: false,
    foil: false,
  };

  let onChangeCallback = null;
  let debounceTimer = null;

  function init(filterOptions, onChange) {
    onChangeCallback = onChange;
    renderSetFilters(filterOptions.sets);
    renderRarityFilters(filterOptions.rarities);
    renderColorToggles();
    renderTextFilters(filterOptions);
    renderToggleFilters();
    renderResetButton();
  }

  function renderSetFilters(sets) {
    const container = document.getElementById('filter-sets');
    container.innerHTML = '';
    sets.forEach(s => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s;
      cb.addEventListener('change', () => {
        state.sets = getCheckedValues(container);
        emitChange();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(s));
      container.appendChild(label);
    });
  }

  function renderRarityFilters(rarities) {
    const container = document.getElementById('filter-rarities');
    container.innerHTML = '';
    rarities.forEach(r => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = r;
      cb.addEventListener('change', () => {
        state.rarities = getCheckedValues(container);
        emitChange();
      });
      label.appendChild(cb);
      const span = document.createElement('span');
      span.className = `rarity-badge rarity-${r}`;
      span.textContent = r;
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  function renderColorToggles() {
    const container = document.getElementById('filter-colors');
    const colors = [
      { code: 'W', label: 'W' },
      { code: 'U', label: 'U' },
      { code: 'B', label: 'B' },
      { code: 'R', label: 'R' },
      { code: 'G', label: 'G' },
      { code: 'C', label: 'C' },
    ];
    container.innerHTML = '';
    colors.forEach(c => {
      const btn = document.createElement('div');
      btn.className = 'color-toggle';
      btn.dataset.color = c.code;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        state.colors = [...container.querySelectorAll('.color-toggle.active')]
          .map(el => el.dataset.color);
        emitChange();
      });
      container.appendChild(btn);
    });
  }

  function renderTextFilters(options) {
    const artistInput = document.getElementById('filter-artist');
    const typeInput = document.getElementById('filter-type');

    const artistList = document.getElementById('artist-list');
    options.artists.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      artistList.appendChild(opt);
    });

    const typeList = document.getElementById('type-list');
    options.typeLines.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      typeList.appendChild(opt);
    });

    artistInput.addEventListener('input', () => {
      state.artist = artistInput.value.trim();
      debouncedChange();
    });

    typeInput.addEventListener('input', () => {
      state.typeLine = typeInput.value.trim();
      debouncedChange();
    });
  }

  function renderToggleFilters() {
    document.getElementById('filter-full-art').addEventListener('change', e => {
      state.fullArt = e.target.checked;
      emitChange();
    });
    document.getElementById('filter-foil').addEventListener('change', e => {
      state.foil = e.target.checked;
      emitChange();
    });
  }

  function renderResetButton() {
    document.getElementById('reset-filters').addEventListener('click', () => {
      state = { sets: [], rarities: [], colors: [], artist: '', typeLine: '', fullArt: false, foil: false };

      document.querySelectorAll('#filter-sets input, #filter-rarities input').forEach(cb => cb.checked = false);
      document.querySelectorAll('.color-toggle').forEach(el => el.classList.remove('active'));
      document.getElementById('filter-artist').value = '';
      document.getElementById('filter-type').value = '';
      document.getElementById('filter-full-art').checked = false;
      document.getElementById('filter-foil').checked = false;
      document.getElementById('search-input').value = '';

      emitChange();
    });
  }

  function getCheckedValues(container) {
    return [...container.querySelectorAll('input:checked')].map(cb => cb.value);
  }

  function debouncedChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emitChange, 200);
  }

  function emitChange() {
    if (onChangeCallback) onChangeCallback(state);
  }

  function filterCards(cards, searchTerm) {
    const search = (searchTerm || '').toLowerCase();
    return cards.filter(card => {
      if (state.sets.length && !state.sets.includes(card.set_name)) return false;
      if (state.rarities.length && !state.rarities.includes(card.rarity)) return false;

      if (state.colors.length) {
        const hasColorless = state.colors.includes('C');
        const selectedMtgColors = state.colors.filter(c => c !== 'C');

        if (hasColorless && selectedMtgColors.length === 0) {
          if (card.color_identity.length > 0) return false;
        } else if (hasColorless) {
          const matchesColors = selectedMtgColors.every(c => card.color_identity.includes(c));
          const isColorless = card.color_identity.length === 0;
          if (!matchesColors && !isColorless) return false;
        } else {
          if (!selectedMtgColors.every(c => card.color_identity.includes(c))) return false;
        }
      }

      if (state.artist && !card.artist.toLowerCase().includes(state.artist.toLowerCase())) return false;
      if (state.typeLine && !card.type_line.toLowerCase().includes(state.typeLine.toLowerCase())) return false;
      if (state.fullArt && !card.full_art) return false;
      if (state.foil && !card.foil) return false;
      if (search && !card.name.toLowerCase().includes(search)) return false;

      return true;
    });
  }

  return { init, filterCards };
})();
