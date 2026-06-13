(() => {
  const STORAGE = {
    players: 'hoops_players',
    games: 'hoops_games',
    current: 'hoops_current_game',
  };

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  let players = load(STORAGE.players, []);
  let games = load(STORAGE.games, []);
  let currentGame = load(STORAGE.current, null);

  const views = {
    play: document.getElementById('view-play'),
    players: document.getElementById('view-players'),
    history: document.getElementById('view-history'),
    backup: document.getElementById('view-backup'),
  };
  const navButtons = document.querySelectorAll('.nav-btn');

  function switchView(name) {
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('active', key === name));
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  }

  navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatDateTime(date) {
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function formatTime(date) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function describeLogEntry(entry) {
    const label = entry.stat === 'assists' ? 'AST' : `${entry.stat}PT`;
    const sign = entry.val > 0 ? '+' : '−';
    return `${entry.playerName} ${sign}${label}`;
  }

  function renderEventLogItems(events) {
    if (!events || events.length === 0) {
      return '<p class="empty">No events yet.</p>';
    }
    return events
      .slice()
      .reverse()
      .map(entry => `
        <div class="event-log-item">
          <span class="event-log-time">${formatTime(new Date(entry.at))}</span>
          <span class="event-log-desc">${escapeHtml(describeLogEntry(entry))}</span>
        </div>
      `)
      .join('');
  }

  function isPlayerInGame(id) {
    return !!currentGame && (currentGame.teams.A.playerIds.includes(id) || currentGame.teams.B.playerIds.includes(id));
  }

  // ---------- Players ----------
  function renderPlayers() {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    if (players.length === 0) {
      list.innerHTML = '<p class="empty">No players yet. Add one below.</p>';
      return;
    }
    players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-row';
      li.innerHTML = `
        <span class="player-row-name">${escapeHtml(p.name)}</span>
        <button class="btn-icon danger" aria-label="Remove">✕</button>
      `;
      li.querySelector('button').addEventListener('click', () => removePlayer(p.id));
      list.appendChild(li);
    });
  }

  function addPlayer(name) {
    name = name.trim();
    if (!name) return;
    players.push({ id: crypto.randomUUID(), name });
    save(STORAGE.players, players);
    renderPlayers();
    renderPlay();
  }

  function removePlayer(id) {
    if (isPlayerInGame(id)) {
      alert('Cannot remove a player who is currently in a game.');
      return;
    }
    players = players.filter(p => p.id !== id);
    delete setupAssignments[id];
    save(STORAGE.players, players);
    renderPlayers();
    renderPlay();
  }

  document.getElementById('add-player-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-player-name');
    addPlayer(input.value);
    input.value = '';
    input.focus();
  });

  // ---------- Play ----------
  let setupAssignments = {}; // playerId -> 'A' | 'B'
  let teamAName = 'Team A';
  let teamBName = 'Team B';
  let selectedPlayerId = null;

  function renderPlay() {
    if (currentGame) {
      renderActiveGame();
    } else {
      renderPlaySetup();
    }
  }

  function renderPlaySetup() {
    document.getElementById('play-setup').classList.remove('hidden');
    document.getElementById('play-active').classList.add('hidden');

    document.getElementById('team-a-name-input').value = teamAName;
    document.getElementById('team-b-name-input').value = teamBName;

    const playerIds = new Set(players.map(p => p.id));
    Object.keys(setupAssignments).forEach(id => {
      if (!playerIds.has(id)) delete setupAssignments[id];
    });

    const list = document.getElementById('setup-players-list');
    list.innerHTML = '';
    if (players.length === 0) {
      list.innerHTML = '<p class="empty">Add players in the Players tab first.</p>';
    }
    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'assign-row';
      row.innerHTML = `
        <span class="assign-name">${escapeHtml(p.name)}</span>
        <div class="assign-toggle">
          <button type="button" class="assign-btn" data-team="A">A</button>
          <button type="button" class="assign-btn" data-team="B">B</button>
        </div>
      `;
      const [btnA, btnB] = row.querySelectorAll('.assign-btn');
      const updateButtons = () => {
        btnA.classList.toggle('active', setupAssignments[p.id] === 'A');
        btnB.classList.toggle('active', setupAssignments[p.id] === 'B');
      };
      updateButtons();
      btnA.addEventListener('click', () => {
        setupAssignments[p.id] = setupAssignments[p.id] === 'A' ? null : 'A';
        updateButtons();
      });
      btnB.addEventListener('click', () => {
        setupAssignments[p.id] = setupAssignments[p.id] === 'B' ? null : 'B';
        updateButtons();
      });
      list.appendChild(row);
    });

    document.getElementById('start-game-btn').disabled = players.length === 0;
  }

  document.getElementById('team-a-name-input').addEventListener('input', (e) => { teamAName = e.target.value; });
  document.getElementById('team-b-name-input').addEventListener('input', (e) => { teamBName = e.target.value; });

  document.getElementById('start-game-btn').addEventListener('click', () => {
    const teamAIds = players.filter(p => setupAssignments[p.id] === 'A').map(p => p.id);
    const teamBIds = players.filter(p => setupAssignments[p.id] === 'B').map(p => p.id);
    if (teamAIds.length === 0 || teamBIds.length === 0) {
      alert('Assign at least one player to each team.');
      return;
    }
    const stats = {};
    [...teamAIds, ...teamBIds].forEach(id => { stats[id] = { shots: { 1: 0, 2: 0, 3: 0 }, assists: 0 }; });
    currentGame = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      teams: {
        A: { name: teamAName.trim() || 'Team A', playerIds: teamAIds },
        B: { name: teamBName.trim() || 'Team B', playerIds: teamBIds },
      },
      stats,
      log: [],
    };
    selectedPlayerId = null;
    save(STORAGE.current, currentGame);
    renderPlay();
  });

  function playerPoints(stat) {
    return stat.shots[1] * 1 + stat.shots[2] * 2 + stat.shots[3] * 3;
  }

  function teamScore(team) {
    return team.playerIds.reduce((sum, id) => sum + playerPoints(currentGame.stats[id]), 0);
  }

  function renderActiveGame() {
    document.getElementById('play-setup').classList.add('hidden');
    document.getElementById('play-active').classList.remove('hidden');

    document.getElementById('team-a-name').textContent = currentGame.teams.A.name;
    document.getElementById('team-b-name').textContent = currentGame.teams.B.name;
    document.getElementById('team-a-score').textContent = teamScore(currentGame.teams.A);
    document.getElementById('team-b-score').textContent = teamScore(currentGame.teams.B);
    document.getElementById('team-a-heading').textContent = currentGame.teams.A.name;
    document.getElementById('team-b-heading').textContent = currentGame.teams.B.name;

    renderTeamChips('active-players-list-a', currentGame.teams.A.playerIds);
    renderTeamChips('active-players-list-b', currentGame.teams.B.playerIds);
    renderScoringBar();
    renderEventLog();

    document.getElementById('undo-btn').disabled = currentGame.log.length === 0;
  }

  function renderEventLog() {
    document.getElementById('event-log-count').textContent = currentGame.log.length;
    document.getElementById('event-log-list').innerHTML = renderEventLogItems(currentGame.log);
  }

  function renderTeamChips(containerId, playerIds) {
    const list = document.getElementById(containerId);
    list.innerHTML = '';
    playerIds.forEach(id => {
      const player = players.find(p => p.id === id);
      const stat = currentGame.stats[id];
      const name = player ? player.name : 'Unknown';

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'player-chip' + (selectedPlayerId === id ? ' selected' : '');
      chip.innerHTML = `
        <div class="player-chip-name">${escapeHtml(name)}</div>
        <div class="player-chip-stats">${playerPoints(stat)} PTS · ${stat.assists} AST</div>
      `;
      chip.addEventListener('click', () => {
        selectedPlayerId = id;
        renderActiveGame();
      });
      list.appendChild(chip);
    });
  }

  function renderScoringBar() {
    const bar = document.getElementById('scoring-bar');
    const stat = currentGame.stats[selectedPlayerId];
    const player = players.find(p => p.id === selectedPlayerId);

    if (!stat || !player) {
      bar.classList.add('empty');
      document.getElementById('scoring-player-name').textContent = 'Tap a player to record stats';
      document.getElementById('scoring-player-stats').textContent = '';
      document.getElementById('scoring-player-breakdown').textContent = '';
      bar.querySelectorAll('.action-btn').forEach(btn => { btn.disabled = true; });
      return;
    }

    bar.classList.remove('empty');
    document.getElementById('scoring-player-name').textContent = player.name;
    document.getElementById('scoring-player-stats').textContent = `${playerPoints(stat)} PTS · ${stat.assists} AST`;
    document.getElementById('scoring-player-breakdown').textContent = `1PT ×${stat.shots[1]} · 2PT ×${stat.shots[2]} · 3PT ×${stat.shots[3]}`;
    bar.querySelectorAll('.action-btn').forEach(btn => { btn.disabled = false; });
  }

  document.querySelectorAll('#scoring-bar .action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedPlayerId) return;
      recordStat(selectedPlayerId, btn.dataset.stat, Number(btn.dataset.val));
    });
  });

  function statValue(stat, key) {
    return key === 'assists' ? stat.assists : stat.shots[key];
  }

  function adjustStat(stat, key, delta) {
    if (key === 'assists') stat.assists += delta;
    else stat.shots[key] += delta;
  }

  function recordStat(playerId, key, val) {
    const stat = currentGame.stats[playerId];
    if (statValue(stat, key) + val < 0) return;
    adjustStat(stat, key, val);
    const player = players.find(p => p.id === playerId);
    currentGame.log.push({ playerId, playerName: player ? player.name : 'Unknown', stat: key, val, at: new Date().toISOString() });
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  document.getElementById('undo-btn').addEventListener('click', () => {
    const last = currentGame.log.pop();
    if (!last) return;
    adjustStat(currentGame.stats[last.playerId], last.stat, -last.val);
    save(STORAGE.current, currentGame);
    renderActiveGame();
  });

  function buildTeamResult(team) {
    return {
      name: team.name,
      score: teamScore(team),
      players: team.playerIds.map(id => {
        const player = players.find(p => p.id === id);
        const stat = currentGame.stats[id];
        return {
          id,
          name: player ? player.name : 'Unknown',
          shots: { ...stat.shots },
          assists: stat.assists,
          points: playerPoints(stat),
        };
      }),
    };
  }

  document.getElementById('end-game-btn').addEventListener('click', () => {
    if (!confirm('End this game and save it to history?')) return;
    const game = {
      id: currentGame.id,
      startedAt: currentGame.startedAt,
      endedAt: new Date().toISOString(),
      teams: {
        A: buildTeamResult(currentGame.teams.A),
        B: buildTeamResult(currentGame.teams.B),
      },
      events: currentGame.log.slice(),
    };
    games.unshift(game);
    save(STORAGE.games, games);
    currentGame = null;
    selectedPlayerId = null;
    localStorage.removeItem(STORAGE.current);
    renderPlay();
    renderHistory();
  });

  document.getElementById('discard-game-btn').addEventListener('click', () => {
    if (!confirm('Discard this game without saving?')) return;
    currentGame = null;
    selectedPlayerId = null;
    localStorage.removeItem(STORAGE.current);
    renderPlay();
  });

  // ---------- History ----------
  function renderTeamTable(team) {
    return `
      <h4 class="team-table-heading">${escapeHtml(team.name)} — ${team.score}</h4>
      <table class="game-table">
        <thead><tr><th>Player</th><th>1PT</th><th>2PT</th><th>3PT</th><th>AST</th><th>PTS</th></tr></thead>
        <tbody>
          ${team.players
            .slice()
            .sort((a, b) => b.points - a.points)
            .map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.shots[1]}</td><td>${p.shots[2]}</td><td>${p.shots[3]}</td><td>${p.assists}</td><td>${p.points}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    if (games.length === 0) {
      list.innerHTML = '<p class="empty">No games yet.</p>';
      return;
    }
    games.forEach(game => {
      const details = document.createElement('details');
      details.className = 'game-entry';
      const date = new Date(game.startedAt);
      details.innerHTML = `
        <summary>
          <span>${formatDateTime(date)}</span>
          <span class="muted">${escapeHtml(game.teams.A.name)} ${game.teams.A.score} – ${game.teams.B.score} ${escapeHtml(game.teams.B.name)}</span>
        </summary>
        ${renderTeamTable(game.teams.A)}
        ${renderTeamTable(game.teams.B)}
        <details class="event-log">
          <summary>Event Log (${game.events ? game.events.length : 0})</summary>
          <div class="event-log-list">${renderEventLogItems(game.events)}</div>
        </details>
        <div class="game-entry-actions">
          <button class="btn-secondary share-game-btn">Share</button>
          <button class="btn-secondary danger delete-game-btn">Delete</button>
        </div>
      `;
      details.querySelector('.delete-game-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (!confirm('Delete this game from history?')) return;
        games = games.filter(g => g.id !== game.id);
        save(STORAGE.games, games);
        renderHistory();
      });
      details.querySelector('.share-game-btn').addEventListener('click', (e) => {
        e.preventDefault();
        shareGameSummary(game);
      });
      list.appendChild(details);
    });
  }

  function shareGameSummary(game) {
    const date = new Date(game.startedAt);
    const lines = [
      `🏀 ${formatDateTime(date)}`,
      `${game.teams.A.name} ${game.teams.A.score} – ${game.teams.B.score} ${game.teams.B.name}`,
      '',
    ];
    [game.teams.A, game.teams.B].forEach(team => {
      lines.push(`${team.name}:`);
      team.players
        .slice()
        .sort((a, b) => b.points - a.points)
        .forEach(p => lines.push(`  ${p.name}: ${p.points} pts (${p.shots[1]}x1, ${p.shots[2]}x2, ${p.shots[3]}x3), ${p.assists} ast`));
    });
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ text, title: 'Hoops Tracker Game Summary' }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('Summary copied to clipboard.'));
    } else {
      alert(text);
    }
  }

  // ---------- Backup ----------
  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.getElementById('export-btn').addEventListener('click', async () => {
    const data = { players, games, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = `hoops-backup-${dateStamp()}.json`;
    const file = new File([blob], filename, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Hoops Tracker Backup' });
        return;
      } catch {
        // user cancelled or share unsupported: fall back to download
      }
    }
    downloadBlob(blob, filename);
  });

  document.getElementById('import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.players) || !Array.isArray(data.games)) {
        throw new Error('Invalid backup file');
      }
      if (!confirm(`Import ${data.players.length} players and ${data.games.length} games? This will replace your current data.`)) {
        return;
      }
      players = data.players;
      games = data.games;
      save(STORAGE.players, players);
      save(STORAGE.games, games);
      renderPlayers();
      renderPlay();
      renderHistory();
      alert('Backup imported successfully.');
    } catch (err) {
      alert('Could not import file: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  // ---------- Init ----------
  renderPlayers();
  renderPlay();
  renderHistory();
})();
