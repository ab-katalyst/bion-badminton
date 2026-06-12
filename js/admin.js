/**
 * Bion Badminton Tournament - Admin Panel
 */

(function() {
  'use strict';

  let state = {
    teams: [],
    matches: [],
    config: {}
  };

  let isLoggedIn = false;
  let scoresStage = 'group'; // active sub-tab in scores: group | semi | final
  let scoresGroupFilter = ''; // '' = all groups, or 'A', 'B', etc.
  let showCompleted = false; // completed matches collapsed by default

  const COOKIE_NAME = 'bion_admin_auth';
  const COOKIE_MAX_AGE = 3 * 60 * 60; // 3 hours in seconds

  function setAdminCookie() {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
    document.cookie = `${COOKIE_NAME}=1; expires=${expires}; path=/; SameSite=Strict`;
  }

  function checkAdminCookie() {
    return document.cookie.split(';').some(c => c.trim().startsWith(`${COOKIE_NAME}=`));
  }

  function showAdminPanel() {
    isLoggedIn = true;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    loadData().then(() => {
      setupTabs();
      renderAll();
    });
  }

  // ===== Init =====
  function init() {
    // Auto-login if cookie exists (within 3h)
    if (checkAdminCookie()) {
      showAdminPanel();
      return;
    }

    document.getElementById('login-btn').addEventListener('click', doLogin);
    document.getElementById('admin-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  }

  function doLogin() {
    const pw = document.getElementById('admin-password').value;
    if (pw === CONFIG.ADMIN_PASSWORD) {
      setAdminCookie();
      showAdminPanel();
    } else {
      showToast('Wrong password', 'error');
    }
  }

  function setupTabs() {
    const buttons = document.querySelectorAll('.nav-btn');
    const sections = {
      teams: document.getElementById('tab-teams'),
      matches: document.getElementById('tab-matches'),
      scores: document.getElementById('tab-scores'),
      config: document.getElementById('tab-config')
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(sections).forEach(s => s.classList.add('hidden'));
        sections[btn.dataset.tab].classList.remove('hidden');
        renderTab(btn.dataset.tab);
      });
    });
  }

  // ===== Data =====
  async function loadData() {
    try {
      const url = CONFIG.APPS_SCRIPT_URL + '?t=' + Date.now();
      const resp = await fetch(url, { method: 'GET' });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      state = data;
    } catch (err) {
      console.error('Load error:', err);
      showToast('Failed to load data from sheet', 'error');
      // Use defaults if empty
      if (!state.config.tournamentName) {
        state.config = { ...CONFIG.DEFAULTS };
      }
    }
  }

  async function saveData() {
    try {
      showToast('Saving...', 'success');
      const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(state)
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      showToast('Saved successfully!', 'success');
      return true;
    } catch (err) {
      console.error('Save error:', err);
      showToast('Save failed: ' + err.message, 'error');
      return false;
    }
  }

  function genId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4);
  }

  // ===== Render Tabs =====
  function renderAll() {
    renderTab('teams');
    renderTab('matches');
    renderTab('scores');
    renderTab('config');
  }

  function renderTab(tab) {
    switch (tab) {
      case 'teams': renderTeamsTab(); break;
      case 'matches': renderMatchesTab(); break;
      case 'scores': renderScoresTab(); break;
      case 'config': renderConfigTab(); break;
    }
  }

  // ===== TEAMS TAB =====
  function renderTeamsTab() {
    const list = document.getElementById('teams-list');
    const groupSelect = document.getElementById('match-group');
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))].sort();

    // Update group selectors across the admin
    updateGroupOptions(groups);

    if (state.teams.length === 0) {
      list.innerHTML = '<p class="text-center" style="color:var(--text-secondary);padding:20px">No teams yet. Add one below.</p>';
    } else {
      const byGroup = {};
      state.teams.forEach(t => {
        const g = t.group || 'No Group';
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(t);
      });

      list.innerHTML = Object.entries(byGroup).map(([g, teams]) => `
        <div class="mb-3">
          <div style="font-weight:700;font-size:0.9rem;color:var(--primary);margin-bottom:6px;text-transform:uppercase">Group ${g}</div>
          ${teams.map(t => `
            <div class="list-item">
              <div class="list-item-info">
                <div class="list-item-title">${escapeHtml(t.name)}</div>
                <div class="list-item-meta">${escapeHtml(t.players || '')}</div>
              </div>
              <button class="btn btn-danger btn-sm" data-action="delete-team" data-id="${t.id}">Delete</button>
            </div>
          `).join('')}
        </div>
      `).join('');

      list.querySelectorAll('[data-action="delete-team"]').forEach(btn => {
        btn.addEventListener('click', () => deleteTeam(btn.dataset.id));
      });
    }
  }

  function updateGroupOptions(groups) {
    const selects = [
      document.getElementById('team-group'),
      document.getElementById('match-group')
    ];
    selects.forEach(sel => {
      if (!sel) return;
      const current = sel.value;
      const existing = [...sel.options].map(o => o.value).filter(v => v);
      groups.forEach(g => {
        if (!existing.includes(g)) {
          const opt = document.createElement('option');
          opt.value = g;
          opt.textContent = `Group ${g}`;
          sel.appendChild(opt);
        }
      });
    });
  }

  document.getElementById('add-team-btn').addEventListener('click', () => {
    const name = document.getElementById('team-name').value.trim();
    const group = document.getElementById('team-group').value;
    const players = document.getElementById('team-players').value.trim();

    if (!name) {
      showToast('Team name is required', 'error');
      return;
    }

    state.teams.push({
      id: genId('t'),
      name,
      group,
      players
    });

    document.getElementById('team-name').value = '';
    document.getElementById('team-players').value = '';

    renderTeamsTab();
    saveData();
  });

  function deleteTeam(id) {
    if (!confirm('Delete this team? It will also remove them from any matches.')) return;
    state.teams = state.teams.filter(t => t.id !== id);
    state.matches = state.matches.filter(m => m.team1Id !== id && m.team2Id !== id);
    renderTeamsTab();
    renderMatchesTab();
    renderScoresTab();
    saveData();
  }

  // ===== MATCHES TAB =====
  function renderMatchesTab() {
    const list = document.getElementById('matches-list');

    // Update team dropdowns
    updateTeamDropdowns();

    if (state.matches.length === 0) {
      list.innerHTML = '<p class="text-center" style="color:var(--text-secondary);padding:20px">No matches yet. Add one below or generate round-robin.</p>';
    } else {
      const byStage = { group: [], semi: [], final: [], third: [] };
      state.matches.forEach(m => {
        if (byStage[m.stage]) byStage[m.stage].push(m);
        else byStage.group.push(m);
      });

      list.innerHTML = Object.entries(byStage).filter(([_, arr]) => arr.length > 0).map(([stage, matches]) => {
        const stageLabel = { group: 'Group Stage', semi: 'Semi-Finals', final: 'Final', third: '3rd Place' }[stage];
        return `
          <div class="mb-3">
            <div style="font-weight:700;font-size:0.9rem;color:var(--primary);margin-bottom:6px;text-transform:uppercase">${stageLabel}</div>
            ${matches.map(m => {
              const t1 = state.teams.find(t => t.id === m.team1Id);
              const t2 = state.teams.find(t => t.id === m.team2Id);
              return `
                <div class="list-item">
                  <div class="list-item-info">
                    <div class="list-item-title">${escapeHtml(t1?.name || '?')} vs ${escapeHtml(t2?.name || '?')}</div>
                    <div class="list-item-meta">${m.scheduledTime || ''}${m.court ? ' · Court ' + m.court : ''} · ${m.status}</div>
                  </div>
                  <button class="btn btn-danger btn-sm" data-action="delete-match" data-id="${m.id}">Delete</button>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }).join('');

      list.querySelectorAll('[data-action="delete-match"]').forEach(btn => {
        btn.addEventListener('click', () => deleteMatch(btn.dataset.id));
      });
    }
  }

  function updateTeamDropdowns() {
    const selects = [
      document.getElementById('match-team1'),
      document.getElementById('match-team2')
    ];
    selects.forEach(sel => {
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">-- Select Team --</option>';
      state.teams.sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (Group ${t.group || '?'})`;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    });
  }

  // Stage selector toggles group selector
  document.getElementById('match-stage').addEventListener('change', e => {
    const isGroup = e.target.value === 'group';
    document.getElementById('match-group-wrap').style.display = isGroup ? 'flex' : 'none';
  });

  document.getElementById('add-match-btn').addEventListener('click', () => {
    const stage = document.getElementById('match-stage').value;
    const group = stage === 'group' ? document.getElementById('match-group').value : '';
    const team1Id = document.getElementById('match-team1').value;
    const team2Id = document.getElementById('match-team2').value;
    const time = document.getElementById('match-time').value;
    const court = document.getElementById('match-court').value;

    if (!team1Id || !team2Id) {
      showToast('Select both teams', 'error');
      return;
    }
    if (team1Id === team2Id) {
      showToast('Teams must be different', 'error');
      return;
    }

    let slot = '';
    if (stage === 'semi') {
      const existing = state.matches.filter(m => m.stage === 'semi').length;
      slot = existing === 0 ? 'sf1' : 'sf2';
    }
    if (stage === 'final') slot = 'final';
    if (stage === 'third') slot = 'third';

    state.matches.push({
      id: genId('m'),
      stage,
      group,
      team1Id,
      team2Id,
      scores: [[0, 0], [0, 0], [0, 0]],
      status: 'scheduled',
      scheduledTime: time,
      court,
      slot
    });

    document.getElementById('match-team1').value = '';
    document.getElementById('match-team2').value = '';
    document.getElementById('match-time').value = '';

    renderMatchesTab();
    renderScoresTab();
    saveData();
  });

  document.getElementById('generate-rr-btn').addEventListener('click', () => {
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))];
    if (groups.length === 0) {
      showToast('Add teams to groups first', 'error');
      return;
    }

    let added = 0;
    groups.forEach(g => {
      const teams = state.teams.filter(t => t.group === g);
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          // Avoid duplicate matches
          const exists = state.matches.some(m =>
            m.stage === 'group' && m.group === g &&
            ((m.team1Id === teams[i].id && m.team2Id === teams[j].id) ||
             (m.team1Id === teams[j].id && m.team2Id === teams[i].id))
          );
          if (!exists) {
            state.matches.push({
              id: genId('m'),
              stage: 'group',
              group: g,
              team1Id: teams[i].id,
              team2Id: teams[j].id,
              scores: [[0, 0], [0, 0], [0, 0]],
              status: 'scheduled',
              scheduledTime: '',
              court: '',
              slot: ''
            });
            added++;
          }
        }
      }
    });

    showToast(`Generated ${added} round-robin matches`, 'success');
    renderMatchesTab();
    renderScoresTab();
    saveData();
  });

  document.getElementById('setup-knockout-btn').addEventListener('click', () => {
    const groups = [...new Set(state.teams.map(t => t.group).filter(Boolean))].sort();
    const adv = state.config.teamsToAdvance || 2;

    // Resolve top teams from each group
    const standings = {};
    groups.forEach(g => {
      const teamsInGroup = state.teams.filter(t => t.group === g);
      const matchesInGroup = state.matches.filter(m => m.stage === 'group' && m.group === g && m.status === 'completed');
      const stats = {};
      teamsInGroup.forEach(t => {
        stats[t.id] = { team: t, mp: 0, w: 0, l: 0, gw: 0, gl: 0, pts: 0 };
      });
      matchesInGroup.forEach(m => {
        if (!stats[m.team1Id] || !stats[m.team2Id]) return;
        const minPts = getMinPoints('group');
        const g1w = gamesWon(m.scores, 1, minPts);
        const g2w = gamesWon(m.scores, 2, minPts);
        stats[m.team1Id].mp++; stats[m.team2Id].mp++;
        stats[m.team1Id].gw += g1w; stats[m.team2Id].gw += g2w;
        stats[m.team1Id].gl += g2w; stats[m.team2Id].gl += g1w;
        if (g1w > g2w) { stats[m.team1Id].w++; stats[m.team1Id].pts += 2; stats[m.team2Id].l++; stats[m.team2Id].pts += 1; }
        else { stats[m.team2Id].w++; stats[m.team2Id].pts += 2; stats[m.team1Id].l++; stats[m.team1Id].pts += 1; }
      });
      const rows = Object.values(stats);
      rows.forEach(r => r.gd = r.gw - r.gl);
      rows.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gw - a.gw;
      });
      standings[g] = rows;
    });

    // Create/update semi-finals
    const sf1 = state.matches.find(m => m.stage === 'semi' && m.slot === 'sf1');
    const sf2 = state.matches.find(m => m.stage === 'semi' && m.slot === 'sf2');

    const a1 = standings['A']?.[0]?.team;
    const a2 = standings['A']?.[1]?.team;
    const b1 = standings['B']?.[0]?.team;
    const b2 = standings['B']?.[1]?.team;

    if (!sf1 && a1 && b2) {
      state.matches.push({ id: genId('m'), stage: 'semi', group: '', team1Id: a1.id, team2Id: b2.id, scores: [[0,0],[0,0],[0,0]], status: 'scheduled', scheduledTime: '', court: '', slot: 'sf1' });
    }
    if (!sf2 && b1 && a2) {
      state.matches.push({ id: genId('m'), stage: 'semi', group: '', team1Id: b1.id, team2Id: a2.id, scores: [[0,0],[0,0],[0,0]], status: 'scheduled', scheduledTime: '', court: '', slot: 'sf2' });
    }

    // Create final placeholder (will resolve dynamically)
    const final = state.matches.find(m => m.stage === 'final');
    if (!final) {
      state.matches.push({ id: genId('m'), stage: 'final', group: '', team1Id: '', team2Id: '', scores: [[0,0],[0,0],[0,0]], status: 'scheduled', scheduledTime: '', court: '', slot: 'final' });
    }

    // Create 3rd place placeholder
    const third = state.matches.find(m => m.stage === 'third');
    if (!third) {
      state.matches.push({ id: genId('m'), stage: 'third', group: '', team1Id: '', team2Id: '', scores: [[0,0],[0,0],[0,0]], status: 'scheduled', scheduledTime: '', court: '', slot: 'third' });
    }

    showToast('Knockout stage created/updated', 'success');
    renderMatchesTab();
    renderScoresTab();
    saveData();
  });

  function deleteMatch(id) {
    if (!confirm('Delete this match?')) return;
    state.matches = state.matches.filter(m => m.id !== id);
    renderMatchesTab();
    renderScoresTab();
    saveData();
  }

  // ===== SCORES TAB =====
  function renderScoresTab() {
    const container = document.getElementById('scores-list');

    if (state.matches.length === 0) {
      container.innerHTML = '<p class="text-center" style="color:var(--text-secondary);padding:20px">No matches to score.</p>';
      return;
    }

    const groupMatches = state.matches.filter(m => m.stage === 'group').sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
    const semiMatches = state.matches.filter(m => m.stage === 'semi').sort((a, b) => (a.slot || '').localeCompare(b.slot || ''));
    const finalMatches = state.matches.filter(m => m.stage === 'final');

    // Default to most advanced stage that has matches
    if (scoresStage === 'final' && finalMatches.length === 0) scoresStage = semiMatches.length > 0 ? 'semi' : 'group';
    if (scoresStage === 'semi' && semiMatches.length === 0) scoresStage = 'group';

    let html = '';

    // Sub-nav pills for stage
    html += '<div class="sub-nav" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    if (groupMatches.length > 0) {
      html += `<button class="btn btn-sm ${scoresStage === 'group' ? 'btn-primary' : ''}" data-scores-stage="group">Group Stage (${groupMatches.length})</button>`;
    }
    if (semiMatches.length > 0) {
      html += `<button class="btn btn-sm ${scoresStage === 'semi' ? 'btn-primary' : ''}" data-scores-stage="semi">Semi-Finals (${semiMatches.length})</button>`;
    }
    if (finalMatches.length > 0) {
      html += `<button class="btn btn-sm ${scoresStage === 'final' ? 'btn-primary' : ''}" data-scores-stage="final">Final (${finalMatches.length})</button>`;
    }
    html += '</div>';

    // Helper to split and render matches
    function renderMatchSection(matches, label, suffix = '') {
      const active = matches.filter(m => m.status !== 'completed');
      const completed = matches.filter(m => m.status === 'completed');

      let sectionHtml = '';

      // Active matches first
      if (active.length > 0) {
        sectionHtml += active.map(m => renderScoreCard(m)).join('');
      }

      // Completed matches collapsed by default
      if (completed.length > 0) {
        const toggleId = `toggle-completed${suffix}`;
        const wrapId = `completed-wrap${suffix}`;
        sectionHtml += `
          <div style="margin:12px 0">
            <button class="btn btn-sm toggle-completed-btn" data-toggle="${suffix}" style="background:var(--bg);color:var(--text-secondary);border:1px solid var(--border);width:100%">
              ${showCompleted ? '▲ Hide' : '▼ Show'} ${completed.length} Completed Match${completed.length > 1 ? 'es' : ''}
            </button>
            <div id="${wrapId}" class="${showCompleted ? '' : 'hidden'}" style="margin-top:8px">
              ${completed.map(m => renderScoreCard(m)).join('')}
            </div>
          </div>
        `;
      }

      if (active.length === 0 && completed.length === 0 && label) {
        sectionHtml += `<p class="text-center" style="color:var(--text-secondary);padding:12px">No ${label} matches.</p>`;
      }

      return sectionHtml;
    }

    if (scoresStage === 'group' && groupMatches.length > 0) {
      // Group filter pills
      const groups = [...new Set(groupMatches.map(m => m.group))].sort();
      if (groups.length > 1) {
        html += '<div class="sub-nav" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
        html += `<button class="btn btn-sm ${scoresGroupFilter === '' ? 'btn-primary' : ''}" data-group-filter="">All</button>`;
        groups.forEach(g => {
          const count = groupMatches.filter(m => m.group === g).length;
          html += `<button class="btn btn-sm ${scoresGroupFilter === g ? 'btn-primary' : ''}" data-group-filter="${g}">Group ${g} (${count})</button>`;
        });
        html += '</div>';
      }

      let filtered = groupMatches;
      if (scoresGroupFilter) {
        filtered = groupMatches.filter(m => m.group === scoresGroupFilter);
      }

      // Show grouped by group when viewing all
      if (!scoresGroupFilter) {
        groups.forEach(g => {
          const matchesInGroup = groupMatches.filter(m => m.group === g);
          html += `<div style="font-weight:600;font-size:0.85rem;color:var(--primary);margin-bottom:8px">Group ${g}</div>`;
          html += renderMatchSection(matchesInGroup, '', g);
        });
      } else {
        html += renderMatchSection(filtered, `Group ${scoresGroupFilter}`, scoresGroupFilter);
      }
    }

    if (scoresStage === 'semi' && semiMatches.length > 0) {
      html += renderMatchSection(semiMatches, 'semi-final', 'semi');
    }

    if (scoresStage === 'final' && finalMatches.length > 0) {
      html += renderMatchSection(finalMatches, 'final', 'final');
    }

    container.innerHTML = html;

    // Event listeners
    container.querySelectorAll('[data-scores-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        scoresStage = btn.dataset.scoresStage;
        renderScoresTab();
      });
    });

    container.querySelectorAll('[data-group-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        scoresGroupFilter = btn.dataset.groupFilter;
        renderScoresTab();
      });
    });

    container.querySelectorAll('.toggle-completed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showCompleted = !showCompleted;
        renderScoresTab();
      });
    });

    container.querySelectorAll('.save-score-btn').forEach(btn => {
      btn.addEventListener('click', () => saveMatchScore(btn.dataset.id));
    });
  }

  function renderScoreCard(m) {
    const t1 = state.teams.find(t => t.id === m.team1Id);
    const t2 = state.teams.find(t => t.id === m.team2Id);
    const scores = m.scores || [[0, 0], [0, 0], [0, 0]];

    let statusBadge = '';
    if (m.status === 'scheduled') statusBadge = '<span class="badge badge-scheduled">Scheduled</span>';
    if (m.status === 'live') statusBadge = '<span class="badge badge-live">Live</span>';
    if (m.status === 'completed') statusBadge = '<span class="badge badge-completed">Completed</span>';

    return `
      <div class="card" data-score-id="${m.id}" style="margin-bottom:12px">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(t1?.name || '?')} vs ${escapeHtml(t2?.name || '?')}</div>
            <div class="card-meta">Court ${m.court || '?'} · ${m.scheduledTime || 'TBD'}</div>
          </div>
          ${statusBadge}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[0, 1, 2].map(i => `
            <div class="score-editor">
              <div class="score-input-group">
                <label>${escapeHtml(t1?.name || 'Team 1')} G${i + 1}</label>
                <input type="number" min="0" class="score-t1" data-match="${m.id}" data-game="${i}" value="${scores[i]?.[0] || 0}">
              </div>
              <div class="score-input-divider">-</div>
              <div class="score-input-group">
                <label>${escapeHtml(t2?.name || 'Team 2')} G${i + 1}</label>
                <input type="number" min="0" class="score-t2" data-match="${m.id}" data-game="${i}" value="${scores[i]?.[1] || 0}">
              </div>
            </div>
          `).join('')}
        </div>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn-primary btn-sm save-score-btn" data-id="${m.id}">Save Score</button>
        </div>
      </div>
    `;
  }

  function saveMatchScore(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const card = document.querySelector(`[data-score-id="${matchId}"]`);
    const t1Inputs = card.querySelectorAll('.score-t1');
    const t2Inputs = card.querySelectorAll('.score-t2');

    const scores = [];
    let hasNonZero = false;
    for (let i = 0; i < 3; i++) {
      const s1 = parseInt(t1Inputs[i]?.value || 0, 10);
      const s2 = parseInt(t2Inputs[i]?.value || 0, 10);
      if (s1 > 0 || s2 > 0) hasNonZero = true;
      scores.push([s1, s2]);
    }

    const minPts = getMinPoints(match.stage);
    const g1w = gamesWon(scores, 1, minPts);
    const g2w = gamesWon(scores, 2, minPts);

    let newStatus = match.status;
    if (g1w >= 2 || g2w >= 2) {
      newStatus = 'completed';
      const winnerName = g1w >= 2 ? (state.teams.find(t => t.id === match.team1Id)?.name || 'Team 1') : (state.teams.find(t => t.id === match.team2Id)?.name || 'Team 2');
      showToast(`Match completed! ${winnerName} won ${Math.max(g1w,g2w)}-${Math.min(g1w,g2w)}`, 'success');
    } else if (hasNonZero) {
      newStatus = 'live';
      showToast('Scores saved — match is live', 'success');
    } else {
      newStatus = 'scheduled';
      showToast('Scores saved', 'success');
    }

    match.scores = scores;
    match.status = newStatus;

    renderScoresTab();
    saveData();
  }

  // ===== CONFIG TAB =====
  function renderConfigTab() {
    document.getElementById('config-name').value = state.config.tournamentName || '';
    document.getElementById('config-group-pts').value = state.config.groupStagePoints || 15;
    document.getElementById('config-ko-pts').value = state.config.knockoutPoints || 21;
    document.getElementById('config-advance').value = state.config.teamsToAdvance || 2;
  }

  document.getElementById('save-config-btn').addEventListener('click', () => {
    state.config.tournamentName = document.getElementById('config-name').value.trim();
    state.config.groupStagePoints = parseInt(document.getElementById('config-group-pts').value, 10) || 15;
    state.config.knockoutPoints = parseInt(document.getElementById('config-ko-pts').value, 10) || 21;
    state.config.teamsToAdvance = parseInt(document.getElementById('config-advance').value, 10) || 2;
    saveData();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset all matches and scores? Teams and groups will be kept. This cannot be undone.')) return;
    state.matches = [];
    renderMatchesTab();
    renderScoresTab();
    saveData();
    showToast('All matches and scores cleared', 'success');
  });

  // ===== Utilities =====
  function gamesWon(scores, teamNum, minPoints) {
    if (!scores || !Array.isArray(scores)) return 0;
    let wins = 0;
    scores.forEach(game => {
      if (!game) return;
      const [s1, s2] = game;
      const winnerScore = teamNum === 1 ? s1 : s2;
      const loserScore = teamNum === 1 ? s2 : s1;
      if (winnerScore > loserScore && winnerScore >= minPoints) wins++;
    });
    return wins;
  }

  function getMinPoints(stage) {
    if (stage === 'group') return state.config.groupStagePoints || 15;
    return state.config.knockoutPoints || 21;
  }

  function matchWinner(match) {
    if (!match.scores) return null;
    const min = getMinPoints(match.stage);
    const g1 = gamesWon(match.scores, 1, min);
    const g2 = gamesWon(match.scores, 2, min);
    if (g1 > g2) return match.team1Id;
    if (g2 > g1) return match.team2Id;
    return null;
  }

  function resolveKnockoutMatch(m) {
    const match = { ...m };
    if (match.stage === 'semi') {
      if (match.slot === 'sf1') {
        const a1 = getGroupTopTeam('A', 0);
        const b2 = getGroupTopTeam('B', 1);
        if (a1) match.team1Id = a1.id;
        if (b2) match.team2Id = b2.id;
      } else if (match.slot === 'sf2') {
        const b1 = getGroupTopTeam('B', 0);
        const a2 = getGroupTopTeam('A', 1);
        if (b1) match.team1Id = b1.id;
        if (a2) match.team2Id = a2.id;
      }
    }
    if (match.stage === 'final') {
      const sf1 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf1');
      const sf2 = state.matches.find(x => x.stage === 'semi' && x.slot === 'sf2');
      if (sf1 && sf1.status === 'completed') {
        const w1 = matchWinner(sf1);
        if (w1) match.team1Id = w1;
      }
      if (sf2 && sf2.status === 'completed') {
        const w2 = matchWinner(sf2);
        if (w2) match.team2Id = w2;
      }
    }
    return match;
  }

  function getGroupTopTeam(group, rank) {
    const teamsInGroup = state.teams.filter(t => t.group === group);
    const matchesInGroup = state.matches.filter(m => m.stage === 'group' && m.group === group && m.status === 'completed');
    const stats = {};
    teamsInGroup.forEach(t => {
      stats[t.id] = { team: t, mp: 0, w: 0, l: 0, gw: 0, gl: 0, pts: 0 };
    });
    matchesInGroup.forEach(m => {
      if (!stats[m.team1Id] || !stats[m.team2Id]) return;
      const minPts = getMinPoints('group');
      const g1w = gamesWon(m.scores, 1, minPts);
      const g2w = gamesWon(m.scores, 2, minPts);
      stats[m.team1Id].mp++; stats[m.team2Id].mp++;
      stats[m.team1Id].gw += g1w; stats[m.team2Id].gw += g2w;
      stats[m.team1Id].gl += g2w; stats[m.team2Id].gl += g1w;
      if (g1w > g2w) { stats[m.team1Id].w++; stats[m.team1Id].pts += 2; stats[m.team2Id].l++; stats[m.team2Id].pts += 1; }
      else { stats[m.team2Id].w++; stats[m.team2Id].pts += 2; stats[m.team1Id].l++; stats[m.team1Id].pts += 1; }
    });
    const rows = Object.values(stats);
    rows.forEach(r => r.gd = r.gw - r.gl);
    rows.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gw - a.gw;
    });
    return rows[rank]?.team || null;
  }

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
