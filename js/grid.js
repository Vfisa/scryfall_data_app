const GridModule = (() => {
  let currentSort = 'name-asc';
  let onCardClickCallback = null;

  function init(onCardClick) {
    onCardClickCallback = onCardClick;
  }

  function render(cards, totalCount) {
    const grid = document.getElementById('card-grid');
    const countEl = document.getElementById('card-count');
    const sorted = sortCards([...cards], currentSort);

    countEl.textContent = `${sorted.length} of ${totalCount} cards`;

    const fragment = document.createDocumentFragment();

    if (sorted.length === 0) {
      const noResults = document.createElement('div');
      noResults.id = 'no-results';
      noResults.textContent = 'No cards match your filters';
      fragment.appendChild(noResults);
    } else {
      sorted.forEach(card => {
        fragment.appendChild(createTile(card));
      });
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  function createTile(card) {
    const tile = document.createElement('div');
    tile.className = 'card-tile';
    tile.addEventListener('click', () => {
      if (onCardClickCallback) onCardClickCallback(card);
    });

    if (card.image_normal) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = card.image_small || card.image_normal;
      img.alt = card.name;
      img.onerror = () => {
        img.style.display = 'none';
        const ph = document.createElement('div');
        ph.className = 'card-tile-placeholder';
        ph.textContent = card.name;
        tile.insertBefore(ph, tile.firstChild);
      };
      tile.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-tile-placeholder';
      ph.textContent = card.name;
      tile.appendChild(ph);
    }

    // Rarity dot
    const dot = document.createElement('div');
    dot.className = 'rarity-dot';
    dot.style.backgroundColor = getRarityColor(card.rarity);
    tile.appendChild(dot);

    // Price badge
    const price = card.prices_usd || card.prices_usd_foil || card.prices_usd_etched;
    if (price) {
      const badge = document.createElement('div');
      badge.className = 'price-badge';
      badge.textContent = `$${parseFloat(price).toFixed(2)}`;
      tile.appendChild(badge);
    }

    // Hover overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-tile-overlay';

    const nameEl = document.createElement('div');
    nameEl.className = 'card-tile-name';
    nameEl.textContent = card.name;
    overlay.appendChild(nameEl);

    const setEl = document.createElement('div');
    setEl.className = 'card-tile-set';
    setEl.textContent = `${card.set_name} #${card.collector_number}`;
    overlay.appendChild(setEl);

    if (card.mana_cost) {
      const manaEl = document.createElement('div');
      manaEl.className = 'card-tile-mana';
      manaEl.innerHTML = renderManaCost(card.mana_cost, true);
      overlay.appendChild(manaEl);
    }

    tile.appendChild(overlay);
    return tile;
  }

  function getRarityColor(rarity) {
    const colors = {
      common: '#858585',
      uncommon: '#aab8c2',
      rare: '#c9a227',
      mythic: '#d4451a',
    };
    return colors[rarity] || '#858585';
  }

  function renderManaCost(manaCost, small) {
    if (!manaCost) return '';
    const sizeClass = small ? 'mana mana-sm' : 'mana';
    return manaCost.replace(/\{([^}]+)\}/g, (_, symbol) => {
      const s = symbol.toUpperCase();
      let cls = '';
      if ('WUBRGC'.includes(s)) {
        cls = `${sizeClass} mana-${s}`;
      } else {
        cls = `${sizeClass} mana-num`;
      }
      return `<span class="${cls}">${s}</span>`;
    });
  }

  function sortCards(cards, sortKey) {
    switch (sortKey) {
      case 'name-asc':
        return cards.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return cards.sort((a, b) => b.name.localeCompare(a.name));
      case 'price-desc':
        return cards.sort((a, b) => (parseFloat(b.prices_usd) || 0) - (parseFloat(a.prices_usd) || 0));
      case 'price-asc':
        return cards.sort((a, b) => (parseFloat(a.prices_usd) || 0) - (parseFloat(b.prices_usd) || 0));
      case 'price-401-desc':
        return cards.sort((a, b) => (parseFloat(b.price_401_cad) || 0) - (parseFloat(a.price_401_cad) || 0));
      case 'price-401-asc':
        return cards.sort((a, b) => (parseFloat(a.price_401_cad) || 0) - (parseFloat(b.price_401_cad) || 0));
      case 'rarity':
        const order = { mythic: 0, rare: 1, uncommon: 2, common: 3 };
        return cards.sort((a, b) => (order[a.rarity] ?? 4) - (order[b.rarity] ?? 4));
      case 'collector':
        return cards.sort((a, b) => {
          const setComp = a.set_name.localeCompare(b.set_name);
          if (setComp !== 0) return setComp;
          return (parseInt(a.collector_number) || 0) - (parseInt(b.collector_number) || 0);
        });
      default:
        return cards;
    }
  }

  function setSort(sortKey) {
    currentSort = sortKey;
  }

  return { init, render, setSort, renderManaCost };
})();
