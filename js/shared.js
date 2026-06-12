/**
 * Bion Badminton Tournament - Shared Utilities
 */

(function() {
  'use strict';

  window.TournamentUtils = {
    escapeHtml(text) {
      if (text == null) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    showToast(msg, type = 'success') {
      const container = document.getElementById('toast-container') || this.createToastContainer();
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },

    createToastContainer() {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
      return el;
    },

    gamesWon(scores, teamNum, minPoints) {
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
    },

    getMinPoints(stage, config) {
      if (stage === 'group') return config?.groupStagePoints ?? 15;
      return config?.knockoutPoints ?? 21;
    },

    matchWinner(match, config) {
      if (!match.scores) return null;
      const min = this.getMinPoints(match.stage, config);
      const g1 = this.gamesWon(match.scores, 1, min);
      const g2 = this.gamesWon(match.scores, 2, min);
      if (g1 > g2) return match.team1Id;
      if (g2 > g1) return match.team2Id;
      return null;
    },

    matchSummary(match, config) {
      const min = this.getMinPoints(match.stage, config);
      const g1 = this.gamesWon(match.scores, 1, min);
      const g2 = this.gamesWon(match.scores, 2, min);
      if (g1 === 0 && g2 === 0) return '';
      return `${g1}-${g2}`;
    },

    computeStandings(group, teams, matches, minPoints) {
      const groupTeams = teams.filter(t => t.group === group).sort((a, b) => a.name.localeCompare(b.name));
      const groupMatches = matches.filter(m => m.stage === 'group' && m.group === group && m.status === 'completed');

      const stats = {};
      groupTeams.forEach(t => {
        stats[t.id] = { team: t, mp: 0, w: 0, l: 0, gw: 0, gl: 0, gd: 0, pts: 0 };
      });

      groupMatches.forEach(m => {
        if (!stats[m.team1Id] || !stats[m.team2Id]) return;
        const s1 = stats[m.team1Id];
        const s2 = stats[m.team2Id];

        const g1w = this.gamesWon(m.scores, 1, minPoints);
        const g2w = this.gamesWon(m.scores, 2, minPoints);

        s1.mp++; s2.mp++;
        s1.gw += g1w; s2.gw += g2w;
        s1.gl += g2w; s2.gl += g1w;

        if (g1w > g2w) {
          s1.w++; s1.pts += 2;
          s2.l++; s2.pts += 0;
        } else {
          s2.w++; s2.pts += 2;
          s1.l++; s1.pts += 0;
        }
      });

      const rows = Object.values(stats);
      rows.forEach(r => { r.gd = r.gw - r.gl; });

      rows.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;

        // Head-to-head tie-breaker: who won the direct match between these two teams
        const h2h = groupMatches.find(m =>
          (m.team1Id === a.team.id && m.team2Id === b.team.id) ||
          (m.team1Id === b.team.id && m.team2Id === a.team.id)
        );
        if (h2h) {
          const winner = this.matchWinner(h2h, { groupStagePoints: minPoints });
          if (winner === a.team.id) return -1;  // a won head-to-head → a first
          if (winner === b.team.id) return 1;   // b won head-to-head → b first
        }

        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gw - a.gw;
      });

      return rows;
    }
  };
})();
