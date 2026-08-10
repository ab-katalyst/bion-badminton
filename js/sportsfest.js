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
  // "Mixed Doubles · Mixed" reads badly — the format already says it.
  const parts = ev.format.includes(g) ? [ev.format] : [ev.format, g];
  return parts.filter(Boolean).join(' · ');
}

const players = (w) =>
  w.players
    .map((p) => `<div class="player"><span>${esc(p.name)}</span>${p.flat ? `<em class="flat">${esc(p.flat)}</em>` : ''}</div>`)
    .join('');

function cardHTML(ev) {
  // The photo links to itself so the uncropped frame is one tap away.
  const plate = ev.photo
    ? `<a href="${esc(ev.photo)}" target="_blank" rel="noopener" aria-label="Open the full ${esc(ev.sport)} finalists photo">
        <img src="${esc(ev.photo)}" alt="Finalists of ${esc(ev.sport)} ${esc(subtitle(ev))}" loading="lazy" decoding="async">
      </a>`
    : '';
  const rows = ev.winners
    .map(
      (w) => `<li class="result">
        <span class="medal${w.place === 2 ? ' silver' : ''}">${w.place}</span>
        <div>${players(w)}</div>
      </li>`
    )
    .join('');
  return `<article class="card">
    <div class="plate ${ev.photo ? 'plate--photo' : 'plate--blank'}">${plate}
      <div class="plate-label">
        <h3>${esc(ev.sport)}</h3>
        ${subtitle(ev) ? `<p>${esc(subtitle(ev))}</p>` : ''}
      </div>
    </div>
    <ol class="results">${rows}</ol>
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

function renderTally(el, events) {
  const { rows, unlisted } = towerTally(events);
  const pips = (n, cls) => `<i class="pip${cls}"></i>`.repeat(n);
  el.innerHTML = `
    <div class="tally-head">
      <p class="eyebrow">Medals by tower</p>
      ${unlisted ? `<p class="tally-note">${unlisted} finalists have no flat number on record and are not counted.</p>` : ''}
    </div>
    <div class="tally-rows">
      ${rows
        .map(
          (r) => `<div class="tally-row">
            <span class="tower">${r.tower}</span>
            <span class="tally-count">${r.gold} gold · ${r.silver} silver</span>
            <div class="pips">${pips(r.gold, '')}${pips(r.silver, ' silver')}</div>
          </div>`
        )
        .join('')}
    </div>`;
}

function init(data) {
  const tabsEl = document.getElementById('tabs');
  const headEl = document.getElementById('panel-head');
  const gridEl = document.getElementById('grid');

  // A category with no events yet — Fun Events today — gets no tab.
  const cats = data.categories
    .map((c) => ({ ...c, events: data.events.filter((e) => e.category === c.id) }))
    .filter((c) => c.events.length);

  document.getElementById('event-count').textContent = data.events.length;
  renderTally(document.getElementById('tally'), data.events);

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
    tabsEl.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.cat === cat.id));
    headEl.innerHTML = `<h2>${esc(cat.name)}</h2><p class="eyebrow">${esc(cat.badge)}</p>`;
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
