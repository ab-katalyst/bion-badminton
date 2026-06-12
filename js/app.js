/**
 * Bion Badminton Tournament - Public Scoreboard App
 */

(function() {
  'use strict';

  const TU = window.TournamentUtils;

  // ===== State =====
  let state = {
    teams: [],
    matches: [],
    config: {}
  };
  let pollInterval = null;
  let lastSavedAt = null;
  let matchesStage = 'group'; // active sub-tab in matches: group | semi | final

  // ===== DOM refs =====
  const views = {
    live: document.getElementById('view-live'),
    standings: document.getElementById('view-standings'),
    matches: document.getElementById('view-matches')
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
      if (!Array.isArray(data.teams) || !Array.isArray(data.matches)) {
        throw new Error('Invalid data format from server');
      }
      state = data;
      lastSavedAt = new Date();
      updateTimestamp();
    } catch (err) {
      console.error('Load error:', err);
      TU.showToast('Failed to refresh scores', 'error');
    } finally {
      renderCurrentView();
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

  // ===== Knockout Resolution =====
  function getKnockoutTeams() {
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))];
    const adv = state.config.teamsToAdvance ?? 2;
    const resolved = {};
    const minPts = TU.getMinPoints('group', state.config);

    groups.forEach(g => {
      const standings = TU.computeStandings(g, state.teams, state.matches, minPts);
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
        if (!match.team1Id) m.team1Id = resolvedTeams['A1']?.id || '';
        if (!match.team2Id) m.team2Id = resolvedTeams['B2']?.id || '';
      } else if (match.slot === 'sf2') {
        if (!match.team1Id) m.team1Id = resolvedTeams['B1']?.id || '';
        if (!match.team2Id) m.team2Id = resolvedTeams['A2']?.id || '';
      }
    }
    if (match.stage === 'final') {
      const sf1 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf1');
      const sf2 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf2');
      if (sf1 && sf1.status === 'completed') {
        const w1 = TU.matchWinner(sf1, state.config);
        if (w1 && !m.team1Id) m.team1Id = w1;
      }
      if (sf2 && sf2.status === 'completed') {
        const w2 = TU.matchWinner(sf2, state.config);
        if (w2 && !m.team2Id) m.team2Id = w2;
      }
    }
    if (match.stage === 'third') {
      const sf1 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf1');
      const sf2 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf2');
      if (sf1 && sf1.status === 'completed') {
        const w1 = TU.matchWinner(sf1, state.config);
        if (w1 && !m.team1Id) {
          m.team1Id = (w1 === sf1.team1Id) ? sf1.team2Id : sf1.team1Id;
        }
      }
      if (sf2 && sf2.status === 'completed') {
        const w2 = TU.matchWinner(sf2, state.config);
        if (w2 && !m.team2Id) {
          m.team2Id = (w2 === sf2.team1Id) ? sf2.team2Id : sf2.team1Id;
        }
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
      case 'matches': renderMatches(); break;
    }
  }

  function renderLive() {
    const container = document.getElementById('live-matches');

    // Check if tournament is over (final completed)
    const finalMatch = state.matches.find(m => m.stage === 'final');
    if (finalMatch && finalMatch.status === 'completed') {
      const winnerId = TU.matchWinner(finalMatch, state.config);
      const winner = getTeam(winnerId);
      const runnerUpId = winnerId === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id;
      const runnerUp = getTeam(runnerUpId);
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:28px;border:2px solid var(--accent);background:linear-gradient(135deg,#fff8e1 0%,#ffffff 100%)">
          <div style="font-size:2rem;margin-bottom:8px">🏆</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--primary-dark)">Tournament Ended!</div>
          <div style="font-size:0.9rem;color:var(--text-secondary);margin-top:8px">Winner</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent);margin-top:4px">${TU.escapeHtml(winner.name)}</div>
          ${runnerUp.name ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px">Runner-up: ${TU.escapeHtml(runnerUp.name)}</div>` : ''}
        </div>
      `;
      return;
    }

    const live = state.matches.filter(m => m.status === 'live');

    if (live.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🏸</div>
          <p>No matches currently in progress.</p>
          <p class="mt-2" style="font-size:0.85rem">Check the Matches tab for upcoming matches.</p>
        </div>`;
      return;
    }

    const resolved = getKnockoutTeams();
    container.innerHTML = live.map(m => renderMatchCard(resolveKnockoutMatch(m, resolved), true)).join('');
  }

  function renderStandings() {
    const container = document.getElementById('standings-content');
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))].sort();

    if (groups.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>No teams or groups yet.</p></div>`;
      return;
    }

    // Knockout bracket section shown first in standings
    let knockoutHtml = '';
    const resolved = getKnockoutTeams();
    const semis = state.matches.filter(m => m.stage === 'semi').sort((a, b) => (a.slot || '').localeCompare(b.slot || ''));
    const finals = state.matches.filter(m => m.stage === 'final');
    const koPts = TU.getMinPoints('semi', state.config);

    if (semis.length > 0 || finals.length > 0) {
      knockoutHtml += '<div class="section-title">Knockout Stage</div>';
      knockoutHtml += '<div class="bracket">';

      if (finals.length > 0) {
        knockoutHtml += `
          <div class="bracket-round">
            <div class="bracket-round-title">Final (Best of 3, ${koPts} pts)</div>
            ${finals.map(m => renderBracketMatch(resolveKnockoutMatch(m, resolved), 'final')).join('')}
          </div>
        `;
      }

      if (semis.length > 0) {
        knockoutHtml += `
          <div class="bracket-round">
            <div class="bracket-round-title">Semi-Finals (Best of 3, ${koPts} pts)</div>
            ${semis.map(m => renderBracketMatch(resolveKnockoutMatch(m, resolved), 'sf')).join('')}
          </div>
        `;
      }

      knockoutHtml += '</div>';
      knockoutHtml += '<div style="height:16px"></div>';
    }

    // Group tables shown below knockout
    const grpPts = TU.getMinPoints('group', state.config);
    let groupsHtml = '<div class="section-title">Group Standings</div>';
    groupsHtml += groups.map(g => {
      const rows = TU.computeStandings(g, state.teams, state.matches, grpPts);
      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Group ${TU.escapeHtml(g)} (Best of 3, ${grpPts} pts)</div>
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
                  <th style="text-align:center">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r, i) => `
                  <tr>
                    <td><span class="rank ${i < (state.config.teamsToAdvance ?? 2) && rows.some(x => x.mp > 0) ? 'top' : ''}">${i + 1}</span></td>
                    <td>
                      <div class="list-item-title">${TU.escapeHtml(r.team.name)}</div>
                    </td>
                    <td style="text-align:center">${r.mp}</td>
                    <td style="text-align:center">${r.w}</td>
                    <td style="text-align:center">${r.l}</td>
                    <td style="text-align:center;font-weight:700">${r.pts}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = knockoutHtml + groupsHtml;
  }

  function renderMatches() {
    const container = document.getElementById('matches-content');

    if (state.matches.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>No matches scheduled yet.</p></div>`;
      return;
    }

    // Interleave group matches so teams don't play back-to-back within the same group
    const allGroup = state.matches.filter(m => m.stage === 'group');
    const liveGroup = allGroup.filter(m => m.status === 'live').sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
    const completedGroup = allGroup.filter(m => m.status === 'completed').sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));

    // Round-robin interleave scheduled matches by group
    const byGroup = {};
    allGroup.filter(m => m.status === 'scheduled').forEach(m => {
      const g = m.group || '';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(m);
    });
    Object.values(byGroup).forEach(arr => arr.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')));

    const scheduledGroup = [];
    const groupKeys = Object.keys(byGroup);
    let idx = 0;
    while (groupKeys.some(k => byGroup[k].length > 0)) {
      const k = groupKeys[idx % groupKeys.length];
      if (byGroup[k].length > 0) scheduledGroup.push(byGroup[k].shift());
      idx++;
    }

    const groupMatches = [...liveGroup, ...scheduledGroup, ...completedGroup];
    const semiMatches = state.matches.filter(m => m.stage === 'semi').sort((a, b) => {
      const order = { live: 0, scheduled: 1, completed: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (a.slot || '').localeCompare(b.slot || '');
    });
    const finalMatches = state.matches.filter(m => m.stage === 'final').sort((a, b) => {
      const order = { live: 0, scheduled: 1, completed: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return 0;
    });

    // Default to most advanced stage that has matches
    if (matchesStage === 'final' && finalMatches.length === 0) matchesStage = semiMatches.length > 0 ? 'semi' : 'group';
    if (matchesStage === 'semi' && semiMatches.length === 0) matchesStage = 'group';

    let html = '';

    // Stage pills
    html += '<div class="sub-nav" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    if (groupMatches.length > 0) {
      html += `<button class="btn btn-sm ${matchesStage === 'group' ? 'btn-primary' : ''}" data-matches-stage="group">Group Stage (${groupMatches.length})</button>`;
    }
    if (semiMatches.length > 0) {
      html += `<button class="btn btn-sm ${matchesStage === 'semi' ? 'btn-primary' : ''}" data-matches-stage="semi">Semi-Finals (${semiMatches.length})</button>`;
    }
    if (finalMatches.length > 0) {
      html += `<button class="btn btn-sm ${matchesStage === 'final' ? 'btn-primary' : ''}" data-matches-stage="final">Final (${finalMatches.length})</button>`;
    }
    html += '</div>';

    let matchesToShow = [];
    if (matchesStage === 'group') matchesToShow = groupMatches;
    if (matchesStage === 'semi') matchesToShow = semiMatches;
    if (matchesStage === 'final') matchesToShow = finalMatches;

    const resolved = getKnockoutTeams();
    html += matchesToShow.map(m => renderMatchCard(resolveKnockoutMatch(m, resolved), false)).join('');

    container.innerHTML = html;

    container.querySelectorAll('[data-matches-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        matchesStage = btn.dataset.matchesStage;
        renderMatches();
      });
    });
  }

  function renderMatchCard(m, isLiveView) {
    const t1 = getTeam(m.team1Id);
    const t2 = getTeam(m.team2Id);
    const winner = m.status === 'completed' ? TU.matchWinner(m, state.config) : null;
    const summary = TU.matchSummary(m, state.config);

    let statusBadge = '';
    if (m.status === 'scheduled') statusBadge = '<span class="badge badge-scheduled">Scheduled</span>';
    if (m.status === 'live') statusBadge = '<span class="badge badge-live">Live</span>';
    if (m.status === 'completed') statusBadge = '<span class="badge badge-completed">Finished</span>';

    let metaParts = [];
    if (m.stage === 'group') metaParts.push(`Group ${TU.escapeHtml(m.group)}`);
    if (m.stage === 'semi') metaParts.push('Semi-Final');
    if (m.stage === 'final') metaParts.push('Final');
    if (m.stage === 'third') metaParts.push('3rd Place');
    if (m.scheduledTime) metaParts.push(TU.escapeHtml(m.scheduledTime));
    if (m.court) metaParts.push(`Court ${TU.escapeHtml(m.court)}`);

    let metaText = metaParts.join(' · ');
    if (summary) metaText += (metaText ? ' · ' : '') + summary;

    const cardClass = isLiveView ? 'card live-card' : 'card';

    return `
      <div class="${cardClass}" data-match-id="${m.id}">
        <div class="card-header">
          <div class="card-meta">${metaText || '&nbsp;'}</div>
          ${!isLiveView ? statusBadge : ''}
        </div>
        <div class="match-teams">
          <div class="team-block ${winner === m.team1Id ? 'winner' : winner === m.team2Id ? 'loser' : ''}">
            <div class="team-name" style="${winner === m.team1Id ? 'font-weight:700' : ''}">${TU.escapeHtml(t1.name)}</div>
          </div>
          <div class="vs">VS</div>
          <div class="team-block ${winner === m.team2Id ? 'winner' : winner === m.team1Id ? 'loser' : ''}">
            <div class="team-name" style="${winner === m.team2Id ? 'font-weight:700' : ''}">${TU.escapeHtml(t2.name)}</div>
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
    const winner = m.status === 'completed' ? TU.matchWinner(m, state.config) : null;
    const summary = TU.matchSummary(m, state.config);

    const t1Name = m.team1Id ? t1.name : (m.slot === 'sf1' ? 'A1' : m.slot === 'sf2' ? 'B1' : m.stage === 'final' ? 'Winner SF1' : 'TBD');
    const t2Name = m.team2Id ? t2.name : (m.slot === 'sf1' ? 'B2' : m.slot === 'sf2' ? 'A2' : m.stage === 'final' ? 'Winner SF2' : 'TBD');

    const t1Class = winner === m.team1Id ? 'bracket-team winner' : 'bracket-team';
    const t2Class = winner === m.team2Id ? 'bracket-team winner' : 'bracket-team';

    const timeText = m.scheduledTime ? TU.escapeHtml(m.scheduledTime) : 'TBD';
    const courtText = m.court ? ` · Court ${TU.escapeHtml(m.court)}` : '';

    return `
      <div class="bracket-match ${cls}">
        <div class="bracket-teams">
          <div class="${t1Class} ${!m.team1Id || String(m.team1Id).startsWith('TBD') ? 'placeholder' : ''}">${TU.escapeHtml(t1Name)}</div>
          <div class="bracket-vs">VS</div>
          <div class="${t2Class} ${!m.team2Id || String(m.team2Id).startsWith('TBD') ? 'placeholder' : ''}">${TU.escapeHtml(t2Name)}</div>
        </div>
        ${summary ? `<div class="bracket-meta" style="font-weight:700;color:var(--primary)">${summary}</div>` : `<div class="bracket-meta">${timeText}${courtText}</div>`}
      </div>
    `;
  }

  // ===== Start =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
