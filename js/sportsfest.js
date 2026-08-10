/* BION SportsFest '26 — renders results from data/sportsfest26.json */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Kids and juniors compete as boys/girls, adults as men/women.
function genderLabel(gender, category) {
  if (gender === 'mixed') return 'Mixed';
  const junior = category === 'kids' || category === 'juniors';
  if (gender === 'male') return junior ? 'Boys' : 'Men';
  if (gender === 'female') return junior ? 'Girls' : 'Women';
  return '';
}

function subtitle(ev) {
  const g = genderLabel(ev.gender, ev.category);
  const parts = [ev.format, ev.age];
  // "Mixed Doubles · Mixed" reads badly — the format already says it.
  if (!ev.format.includes(g)) parts.push(g);
  return parts.filter(Boolean).join(' · ');
}

const players = (w) =>
  w.players
    .map((p) => `<div class="player"><span>${esc(p.name)}</span>${p.flat ? `<em class="flat">${esc(p.flat)}</em>` : ''}</div>`)
    .join('');

const ICONS = {
  Date: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M6.5 2.5v4M13.5 2.5v4"/>',
  Time: '<circle cx="10" cy="10" r="7.5"/><path d="M10 5.5V10l3 2"/>',
  Venue: '<path d="M10 18s6-5.2 6-9.4A6 6 0 0 0 4 8.6C4 12.8 10 18 10 18Z"/><circle cx="10" cy="8.5" r="2.2"/>',
};

const icon = (k) =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    ICONS[k] || ICONS.Date
  }</svg>`;

const fixtureHTML = (schedule) =>
  `<div class="fixture">${Object.entries(schedule)
    .map(
      ([k, v]) => `<div>${icon(k)}<div><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p></div></div>`
    )
    .join('')}</div>`;

function cardHTML(ev) {
  const plate = ev.photo
    ? `<img src="${esc(ev.photo)}" alt="Finalists of ${esc(ev.sport)} ${esc(subtitle(ev))}" loading="lazy" decoding="async">`
    : '';
  const rows = ev.winners
    .map(
      (w) => `<li class="result">
        <span class="medal${w.place === 2 ? ' silver' : ''}">${w.place}</span>
        <div>${players(w)}</div>
      </li>`
    )
    .join('');
  // Not played yet — the plate alone is the card, no empty results list.
  return `<article class="card">
    <div class="plate ${ev.photo ? 'plate--photo' : 'plate--blank'}">${plate}
      <div class="plate-label">
        <h3>${esc(ev.sport)}</h3>
        ${subtitle(ev) ? `<p>${esc(subtitle(ev))}</p>` : ''}
      </div>
    </div>
    ${rows ? `<ol class="results">${rows}</ol>` : ''}
  </article>`;
}

// Medal count per tower, read off the flat number's leading letter.
function towerTally(events) {
  const towers = {};
  let unlisted = 0;
  for (const ev of events) {
    for (const w of ev.winners) {
      for (const p of w.players) {
        const tower = (p.flat || '').trim().charAt(0).toUpperCase();
        if (!/[A-Z]/.test(tower)) { unlisted++; continue; }
        towers[tower] = towers[tower] || { tower, gold: 0, silver: 0 };
        towers[tower][w.place === 1 ? 'gold' : 'silver']++;
      }
    }
  }
  const rows = Object.values(towers).sort(
    (a, b) => b.gold - a.gold || b.silver - a.silver || a.tower.localeCompare(b.tower)
  );
  return { rows, unlisted };
}

function renderTally(el, noteEl, events) {
  const { rows, unlisted } = towerTally(events);
  el.innerHTML = `
    <p class="eyebrow">Medals by tower</p>
    <div class="tally-rows">
      ${rows
        .map(
          (r) => `<div class="tally-row">
            <span class="tower">${r.tower}</span>
            <span class="tally-total">${r.gold + r.silver}</span>
            <span class="tally-count"><span class="g">${r.gold} gold</span> · <span class="s">${r.silver} silver</span></span>
          </div>`
        )
        .join('')}
    </div>`;
  if (noteEl && unlisted) {
    noteEl.textContent = `The tower tally leaves out ${unlisted} finalists who have no flat number on record.`;
  }
}

function init(data) {
  const tabsEl = document.getElementById('tabs');
  const headEl = document.getElementById('panel-head');
  const gridEl = document.getElementById('grid');

  // A category with no events yet — Fun Events today — gets no tab.
  const cats = data.categories
    .map((c) => ({ ...c, events: data.events.filter((e) => e.category === c.id) }))
    .filter((c) => c.events.length);

  renderTally(document.getElementById('tally'), document.getElementById('tally-note'), data.events);

  tabsEl.innerHTML = cats
    .map(
      (c, i) =>
        `<button class="tab" role="tab" id="tab-${c.id}" aria-controls="panel" aria-selected="${i === 0}" data-cat="${c.id}">${esc(
          c.name
        )} <b>${c.events.length}</b></button>`
    )
    .join('');

  function show(id, push) {
    const cat = cats.find((c) => c.id === id) || cats[0];
    tabsEl.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.cat === cat.id;
      b.setAttribute('aria-selected', on);
      // The bar scrolls sideways on phones — keep the active tab in view.
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    // The tab bar already names the category — don't repeat it here.
    headEl.innerHTML =
      `<p class="eyebrow">${esc(cat.badge)} · ${cat.events.length} events</p>` +
      (cat.schedule ? fixtureHTML(cat.schedule) : '') +
      (cat.note ? `<p class="panel-note">${esc(cat.note)}</p>` : '');
    gridEl.innerHTML = cat.events.map(cardHTML).join('');
    gridEl.querySelectorAll('.card').forEach((el, i) => (el.style.animationDelay = Math.min(i * 35, 350) + 'ms'));
    if (push) history.replaceState(null, '', '#' + cat.id);
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) show(btn.dataset.cat, true);
  });

  show(location.hash.slice(1), false);
}

fetch('data/sportsfest26.json')
  .then((r) => r.json())
  .then(init)
  .catch(() => {
    document.getElementById('grid').innerHTML =
      '<p>Results could not be loaded. Refresh the page to try again.</p>';
  });
