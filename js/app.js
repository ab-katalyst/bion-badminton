/**
 * Bion Badminton Tournament - Public Scoreboard App
 */

(function() {
  'use strict';

  // ===== State =====
  let state = {
    teams: [],
    matches: [],
    config: {}
  };
  let pollInterval = null;
  let lastSavedAt = null;

  // ===== DOM refs =====
  const views = {
    live: document.getElementById('view-live'),
    standings: document.getElementById('view-standings'),
    schedule: document.getElementById('view-schedule'),
    bracket: document.getElementById('view-bracket')
  };

  // ===== Init =====
  async function init() {
    setupNavigation();
    await loadData();
    startPolling();
  }

  function setupNavigation() {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(views).forEach(el => el.classList.remove('active'));
        views[view].classList.add('active');
        renderView(view);
      });
    });
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadData, 10000); // poll every 10s
  }

  // ===== Data =====
  async function loadData() {
    try {
      const url = CONFIG.APPS_SCRIPT_URL + '?t=' + Date.now();
      const resp = await fetch(url, { method: 'GET' });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      state = data;
      lastSavedAt = new Date();
      updateTimestamp();
      renderCurrentView();
    } catch (err) {
      console.error('Load error:', err);
      showToast('Failed to refresh scores', 'error');
    }
  }

  function updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el && lastSavedAt) {
      el.textContent = 'Updated: ' + lastSavedAt.toLocaleTimeString();
    }
  }

  function getTeam(id) {
    return state.teams.find(t => t.id === id) || { name: '?', players: '' };
  }

  function getGroupTeams(group) {
    return state.teams.filter(t => t.group === group).sort((a, b) => a.name.localeCompare(b.name));
  }

  function getGroupMatches(group) {
    return state.matches.filter(m => m.stage === 'group' && m.group === group);
  }

  // ===== Standings Logic =====
  function computeStandings(group) {
    const teams = getGroupTeams(group);
    const matches = getGroupMatches(group).filter(m => m.status === 'completed');

    const stats = {};
    teams.forEach(t => {
      stats[t.id] = {
        team: t,
        mp: 0, w: 0, l: 0,
        gw: 0, gl: 0, gd: 0,
        pts: 0
      };
    });

    matches.forEach(m => {
      if (!stats[m.team1Id] || !stats[m.team2Id]) return;
      const s1 = stats[m.team1Id];
      const s2 = stats[m.team2Id];

      const g1w = gamesWon(m.scores, 1);
      const g2w = gamesWon(m.scores, 2);

      s1.mp++; s2.mp++;
      s1.gw += g1w; s2.gw += g2w;
      s1.gl += g2w; s2.gl += g1w;

      if (g1w > g2w) {
        s1.w++; s1.pts += 2;
        s2.l++; s2.pts += 1;
      } else {
        s2.w++; s2.pts += 2;
        s1.l++; s1.pts += 1;
      }
    });

    const rows = Object.values(stats);
    rows.forEach(r => { r.gd = r.gw - r.gl; });

    rows.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gw - a.gw;
    });

    return rows;
  }

  function gamesWon(scores, teamNum) {
    if (!scores || !Array.isArray(scores)) return 0;
    let wins = 0;
    scores.forEach(game => {
      if (!game) return;
      const [s1, s2] = game;
      if (teamNum === 1 && s1 > s2) wins++;
      if (teamNum === 2 && s2 > s1) wins++;
    });
    return wins;
  }

  function matchWinner(match) {
    if (!match.scores) return null;
    const g1 = gamesWon(match.scores, 1);
    const g2 = gamesWon(match.scores, 2);
    if (g1 > g2) return match.team1Id;
    if (g2 > g1) return match.team2Id;
    return null;
  }

  function matchSummary(match) {
    const g1 = gamesWon(match.scores, 1);
    const g2 = gamesWon(match.scores, 2);
    if (g1 === 0 && g2 === 0) return '';
    return `${g1}-${g2}`;
  }

  // ===== Knockout Resolution =====
  function getKnockoutTeams() {
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))];
    const adv = state.config.teamsToAdvance || 2;
    const resolved = {};

    groups.forEach(g => {
      const standings = computeStandings(g);
      standings.slice(0, adv).forEach((row, idx) => {
        resolved[`${g}${idx + 1}`] = row.team;
      });
    });

    return resolved;
  }

  function resolveKnockoutMatch(match, resolvedTeams) {
    const m = { ...match };
    if (match.stage === 'semi') {
      if (match.slot === 'sf1') {
        m.team1Id = resolvedTeams['A1']?.id || m.team1Id;
        m.team2Id = resolvedTeams['B2']?.id || m.team2Id;
      } else if (match.slot === 'sf2') {
        m.team1Id = resolvedTeams['B1']?.id || m.team1Id;
        m.team2Id = resolvedTeams['A2']?.id || m.team2Id;
      }
    }
    if (match.stage === 'final') {
      const sf1 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf1');
      const sf2 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf2');
      if (sf1 && sf1.status === 'completed') {
        const w1 = matchWinner(sf1);
        if (w1) m.team1Id = w1;
      }
      if (sf2 && sf2.status === 'completed') {
        const w2 = matchWinner(sf2);
        if (w2) m.team2Id = w2;
      }
    }
    if (match.stage === 'third') {
      const sf1 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf1');
      const sf2 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf2');
      if (sf1 && sf1.status === 'completed') {
        const w1 = matchWinner(sf1);
        if (w1 && w1 === sf1.team1Id) m.team1Id = sf1.team2Id;
        else if (w1) m.team1Id = sf1.team1Id;
      }
      if (sf2 && sf2.status === 'completed') {
        const w2 = matchWinner(sf2);
        if (w2 && w2 === sf2.team1Id) m.team2Id = sf2.team2Id;
        else if (w2) m.team2Id = sf2.team1Id;
      }
    }
    return m;
  }

  // ===== Rendering =====
  function renderCurrentView() {
    const active = document.querySelector('.nav-btn.active');
    if (active) renderView(active.dataset.view);
  }

  function renderView(view) {
    switch (view) {
      case 'live': renderLive(); break;
      case 'standings': renderStandings(); break;
      case 'schedule': renderSchedule(); break;
      case 'bracket': renderBracket(); break;
    }
  }

  function renderLive() {
    const container = document.getElementById('live-matches');
    const live = state.matches.filter(m => m.status === 'live');

    if (live.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🏸</div>
          <p>No matches currently in progress.</p>
          <p class="mt-2" style="font-size:0.85rem">Check the Schedule tab for upcoming matches.</p>
        </div>`;
      return;
    }

    container.innerHTML = live.map(m => renderMatchCard(m, true)).join('');
  }

  function renderStandings() {
    const container = document.getElementById('standings-content');
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))].sort();

    if (groups.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>No teams or groups yet.</p></div>`;
      return;
    }

    container.innerHTML = groups.map(g => {
      const rows = computeStandings(g);
      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Group ${g}</div>
            <div class="card-meta">${rows.filter(r => r.mp > 0).length} of ${rows.length} teams played</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width:30px">#</th>
                  <th>Team</th>
                  <th style="text-align:center">MP</th>
                  <th style="text-align:center">W</th>
                  <th style="text-align:center">L</th>
                  <th style="text-align:center">GW</th>
                  <th style="text-align:center">GL</th>
                  <th style="text-align:center">GD</th>
                  <th style="text-align:center">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r, i) => `
                  <tr>
                    <td><span class="rank ${i < (state.config.teamsToAdvance || 2) ? 'top' : ''}">${i + 1}</span></td>
                    <td>
                      <div class="list-item-title">${escapeHtml(r.team.name)}</div>
                      <div class="list-item-meta">${escapeHtml(r.team.players || '')}</div>
                    </td>
                    <td style="text-align:center">${r.mp}</td>
                    <td style="text-align:center">${r.w}</td>
                    <td style="text-align:center">${r.l}</td>
                    <td style="text-align:center">${r.gw}</td>
                    <td style="text-align:center">${r.gl}</td>
                    <td style="text-align:center;font-weight:600;${r.gd > 0 ? 'color:var(--win)' : r.gd < 0 ? 'color:var(--loss)' : ''}">${r.gd > 0 ? '+' : ''}${r.gd}</td>
                    <td style="text-align:center;font-weight:700">${r.pts}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSchedule() {
    const container = document.getElementById('schedule-content');
    const matches = [...state.matches].sort((a, b) => {
      // Sort: live first, then scheduled by time, then completed last
      const order = { live: 0, scheduled: 1, completed: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });

    if (matches.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>No matches scheduled yet.</p></div>`;
      return;
    }

    container.innerHTML = matches.map(m => renderMatchCard(m, false)).join('');
  }

  function renderBracket() {
    const container = document.getElementById('bracket-content');
    const resolved = getKnockoutTeams();

    const semis = state.matches.filter(m => m.stage === 'semi').sort((a, b) => (a.slot || '').localeCompare(b.slot || ''));
    const finals = state.matches.filter(m => m.stage === 'final');
    const thirds = state.matches.filter(m => m.stage === 'third');

    if (semis.length === 0 && finals.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div><p>Knockout stage matches will appear here once group stage is complete.</p></div>`;
      return;
    }

    let html = '<div class="bracket">';

    if (semis.length > 0) {
      html += `
        <div class="bracket-round">
          <div class="bracket-round-title">Semi-Finals (Best of 3, 21 pts)</div>
          ${semis.map(m => renderBracketMatch(resolveKnockoutMatch(m, resolved), 'sf')).join('')}
        </div>
      `;
    }

    if (thirds.length > 0) {
      html += `
        <div class="bracket-round">
          <div class="bracket-round-title">3rd Place Match</div>
          ${thirds.map(m => renderBracketMatch(resolveKnockoutMatch(m, resolved), 'third')).join('')}
        </div>
      `;
    }

    if (finals.length > 0) {
      html += `
        <div class="bracket-round">
          <div class="bracket-round-title">Final (Best of 3, 21 pts)</div>
          ${finals.map(m => renderBracketMatch(resolveKnockoutMatch(m, resolved), 'final')).join('')}
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderMatchCard(m, isLiveView) {
    const t1 = getTeam(m.team1Id);
    const t2 = getTeam(m.team2Id);
    const winner = m.status === 'completed' ? matchWinner(m) : null;
    const summary = matchSummary(m);

    let statusBadge = '';
    if (m.status === 'scheduled') statusBadge = '<span class="badge badge-scheduled">Scheduled</span>';
    if (m.status === 'live') statusBadge = '<span class="badge badge-live">Live</span>';
    if (m.status === 'completed') statusBadge = '<span class="badge badge-completed">Finished</span>';

    let metaParts = [];
    if (m.stage === 'group') metaParts.push(`Group ${m.group}`);
    if (m.stage === 'semi') metaParts.push('Semi-Final');
    if (m.stage === 'final') metaParts.push('Final');
    if (m.stage === 'third') metaParts.push('3rd Place');
    if (m.scheduledTime) metaParts.push(m.scheduledTime);
    if (m.court) metaParts.push(`Court ${m.court}`);

    const cardClass = isLiveView ? 'card live-card' : 'card';

    return `
      <div class="${cardClass}" data-match-id="${m.id}">
        <div class="card-header">
          <div class="card-meta">${metaParts.join(' · ')} · ${summary || statusBadge}</div>
          ${m.status !== 'completed' ? statusBadge : ''}
        </div>
        <div class="match-teams">
          <div class="team-block ${winner === m.team1Id ? 'winner' : winner === m.team2Id ? 'loser' : ''}">
            <div class="team-name">${escapeHtml(t1.name)}</div>
            <div class="team-players">${escapeHtml(t1.players || '')}</div>
          </div>
          <div class="vs">VS</div>
          <div class="team-block ${winner === m.team2Id ? 'winner' : winner === m.team1Id ? 'loser' : ''}">
            <div class="team-name">${escapeHtml(t2.name)}</div>
            <div class="team-players">${escapeHtml(t2.players || '')}</div>
          </div>
        </div>
        ${renderScores(m)}
      </div>
    `;
  }

  function renderScores(m) {
    if (!m.scores || m.scores.length === 0) return '';
    const games = m.scores.filter(g => g && (g[0] > 0 || g[1] > 0));
    if (games.length === 0) return '';

    return `
      <div class="scores">
        ${games.map((g, i) => {
          const isCurrent = m.status === 'live' && i === games.length - 1;
          return `
            <div class="score-pill ${isCurrent ? 'current' : ''}">
              <div class="label">G${i + 1}</div>
              <div class="value">${g[0]}-${g[1]}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderBracketMatch(m, cls) {
    const t1 = getTeam(m.team1Id);
    const t2 = getTeam(m.team2Id);
    const winner = m.status === 'completed' ? matchWinner(m) : null;
    const summary = matchSummary(m);

    const t1Name = m.team1Id ? t1.name : (m.slot === 'sf1' ? 'A1' : m.slot === 'sf2' ? 'B1' : m.stage === 'final' ? 'Winner SF1' : 'TBD');
    const t2Name = m.team2Id ? t2.name : (m.slot === 'sf1' ? 'B2' : m.slot === 'sf2' ? 'A2' : m.stage === 'final' ? 'Winner SF2' : 'TBD');

    const t1Class = winner === m.team1Id ? 'bracket-team winner' : 'bracket-team';
    const t2Class = winner === m.team2Id ? 'bracket-team winner' : 'bracket-team';

    return `
      <div class="bracket-match ${cls}">
        <div class="bracket-teams">
          <div class="${t1Class} ${!m.team1Id || m.team1Id.startsWith('TBD') ? 'placeholder' : ''}">${escapeHtml(t1Name)}</div>
          <div class="bracket-vs">VS</div>
          <div class="${t2Class} ${!m.team2Id || m.team2Id.startsWith('TBD') ? 'placeholder' : ''}">${escapeHtml(t2Name)}</div>
        </div>
        ${summary ? `<div class="bracket-meta" style="font-weight:700;color:var(--primary)">${summary}</div>` : `<div class="bracket-meta">${m.scheduledTime || 'TBD'}${m.court ? ' · Court ' + m.court : ''}</div>`}
      </div>
    `;
  }

  // ===== Utilities =====
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function createToastContainer() {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  }

  // ===== Start =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
