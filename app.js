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
    menu: document.getElementById('view-menu'),
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
    let desc = `${entry.playerName} +${entry.stat}PT`;
    if (entry.assist) desc += ` (AST ${entry.assist.playerName})`;
    if (entry.andOne) desc += ' +1';
    return desc;
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
    delete setupPresent[id];
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
  let setupPresent = {};     // playerId -> bool (default true)
  let teamAName = 'Team A';
  let teamBName = 'Team B';

  // Discard any in-progress game saved under the old log/undo schema.
  if (currentGame && !currentGame.undoStack) {
    currentGame = null;
    localStorage.removeItem(STORAGE.current);
  }

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
    document.getElementById('play-summary').classList.add('hidden');

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
      if (!(p.id in setupPresent)) setupPresent[p.id] = true;
      const present = setupPresent[p.id];
      const row = document.createElement('div');
      row.className = 'assign-row' + (present ? '' : ' assign-absent');
      row.innerHTML = `
        <button type="button" class="assign-present-btn${present ? ' active' : ''}" aria-label="Toggle present">✓</button>
        <span class="assign-name">${escapeHtml(p.name)}</span>
        <div class="assign-toggle${present ? '' : ' hidden'}">
          <button type="button" class="assign-btn" data-team="A">A</button>
          <button type="button" class="assign-btn" data-team="B">B</button>
        </div>
      `;
      const presentBtn = row.querySelector('.assign-present-btn');
      const toggleDiv = row.querySelector('.assign-toggle');
      const [btnA, btnB] = row.querySelectorAll('.assign-btn');
      const updateButtons = () => {
        btnA.classList.toggle('active', setupAssignments[p.id] === 'A');
        btnB.classList.toggle('active', setupAssignments[p.id] === 'B');
      };
      updateButtons();
      presentBtn.addEventListener('click', () => {
        setupPresent[p.id] = !setupPresent[p.id];
        if (!setupPresent[p.id]) delete setupAssignments[p.id];
        renderPlaySetup();
      });
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

    document.getElementById('shuffle-btn').disabled = players.filter(p => setupPresent[p.id]).length < 2;
    document.getElementById('start-game-btn').disabled = players.length === 0;
  }

  document.getElementById('team-a-name-input').addEventListener('input', (e) => { teamAName = e.target.value; });
  document.getElementById('team-b-name-input').addEventListener('input', (e) => { teamBName = e.target.value; });

  document.getElementById('shuffle-btn').addEventListener('click', () => {
    const presentIds = players.filter(p => setupPresent[p.id]).map(p => p.id);
    for (let i = presentIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [presentIds[i], presentIds[j]] = [presentIds[j], presentIds[i]];
    }
    const half = Math.ceil(presentIds.length / 2);
    presentIds.forEach((id, idx) => { setupAssignments[id] = idx < half ? 'A' : 'B'; });
    renderPlaySetup();
  });

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
      undoStack: [],
    };
    save(STORAGE.current, currentGame);
    renderPlay();
  });

  function playerPoints(stat) {
    return stat.shots[1] * 1 + stat.shots[2] * 2 + stat.shots[3] * 3;
  }

  function teamScore(team) {
    return team.playerIds.reduce((sum, id) => sum + playerPoints(currentGame.stats[id]), 0);
  }

  let clockInterval = null;

  function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = String(s % 60).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }

  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    const el = document.getElementById('game-clock');
    const tick = () => {
      if (!currentGame || !el) return;
      el.textContent = formatElapsed(Date.now() - new Date(currentGame.startedAt).getTime());
    };
    tick();
    clockInterval = setInterval(tick, 1000);
  }

  function stopClock() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    const el = document.getElementById('game-clock');
    if (el) el.textContent = '0:00';
  }

  function renderActiveGame() {
    document.getElementById('play-setup').classList.add('hidden');
    document.getElementById('play-active').classList.remove('hidden');
    document.getElementById('play-summary').classList.add('hidden');

    document.getElementById('team-a-name').textContent = currentGame.teams.A.name;
    document.getElementById('team-b-name').textContent = currentGame.teams.B.name;
    document.getElementById('team-a-score').textContent = teamScore(currentGame.teams.A);
    document.getElementById('team-b-score').textContent = teamScore(currentGame.teams.B);
    document.getElementById('qa-label-a').textContent = currentGame.teams.A.name;
    document.getElementById('qa-label-b').textContent = currentGame.teams.B.name;

    renderFeed();
    startClock();

    document.getElementById('undo-btn').disabled = currentGame.undoStack.length === 0;
  }

  function teamKeyForPlayer(playerId) {
    return currentGame.teams.A.playerIds.includes(playerId) ? 'A' : 'B';
  }

  // Renders the play-by-play feed, newest first. Assist / and-one info is
  // stored directly on the shot entry (entry.assist / entry.andOne) and
  // rendered as part of that entry's row.
  function renderFeed() {
    const feed = document.getElementById('feed');
    const log = currentGame.log;

    if (log.length === 0) {
      feed.innerHTML = '<p class="empty">No plays yet. Tap +2 / +3 to get started.</p>';
      return;
    }

    const rows = log.slice().reverse().map(entry => {
      const time = formatTime(new Date(entry.at));
      const teammates = currentGame.teams[teamKeyForPlayer(entry.playerId)].playerIds.filter(id => id !== entry.playerId);

      let actions = '';
      if (entry.assist) {
        actions += `<button type="button" class="feed-badge removable" data-action="remove-ast" data-entry="${entry.id}">AST ${escapeHtml(entry.assist.playerName)}</button>`;
      } else if (teammates.length > 0) {
        actions += `<button type="button" class="feed-chip" data-action="ast" data-entry="${entry.id}">AST</button>`;
      }
      if (entry.andOne) {
        actions += `<button type="button" class="feed-badge removable" data-action="remove-and-one" data-entry="${entry.id}">+1</button>`;
      } else {
        actions += `<button type="button" class="feed-chip" data-action="and-one" data-entry="${entry.id}">+1</button>`;
      }

      return `
        <div class="feed-item">
          <span class="feed-time">${time}</span>
          <span class="feed-desc"><strong>+${entry.stat}</strong> ${escapeHtml(entry.playerName)}</span>
          <span class="feed-actions">${actions}</span>
        </div>
      `;
    });

    feed.innerHTML = rows.join('');

    feed.querySelectorAll('[data-action="ast"]').forEach(btn => {
      btn.addEventListener('click', () => handleAssist(btn.dataset.entry));
    });
    feed.querySelectorAll('[data-action="remove-ast"]').forEach(btn => {
      btn.addEventListener('click', () => removeAssist(btn.dataset.entry));
    });
    feed.querySelectorAll('[data-action="and-one"]').forEach(btn => {
      btn.addEventListener('click', () => recordAndOne(btn.dataset.entry));
    });
    feed.querySelectorAll('[data-action="remove-and-one"]').forEach(btn => {
      btn.addEventListener('click', () => removeAndOne(btn.dataset.entry));
    });
  }

  function playerOptions(playerIds) {
    return playerIds.map(id => {
      const player = players.find(p => p.id === id);
      return { id, label: player ? player.name : 'Unknown' };
    });
  }

  function openPicker(title, options, onSelect) {
    document.getElementById('picker-title').textContent = title;
    const list = document.getElementById('picker-list');
    list.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        closePicker();
        onSelect(opt.id);
      });
      list.appendChild(btn);
    });
    document.getElementById('picker-overlay').classList.remove('hidden');
  }

  function closePicker() {
    document.getElementById('picker-overlay').classList.add('hidden');
  }

  document.getElementById('picker-cancel').addEventListener('click', closePicker);
  document.getElementById('picker-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'picker-overlay') closePicker();
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const teamKey = btn.dataset.team;
      const points = btn.dataset.points;
      const playerIds = currentGame.teams[teamKey].playerIds;

      if (playerIds.length === 1) {
        recordStat(playerIds[0], points);
        return;
      }

      openPicker(`Who scored +${points}?`, playerOptions(playerIds), (playerId) => recordStat(playerId, points));
    });
  });

  function handleAssist(entryId) {
    const entry = currentGame.log.find(e => e.id === entryId);
    if (!entry) return;
    const teammates = currentGame.teams[teamKeyForPlayer(entry.playerId)].playerIds.filter(id => id !== entry.playerId);
    if (teammates.length === 1) {
      recordAssist(entry.id, teammates[0]);
      return;
    }
    openPicker(`Who assisted ${entry.playerName}?`, playerOptions(teammates), (assistPlayerId) => {
      recordAssist(entry.id, assistPlayerId);
    });
  }

  function recordStat(playerId, points) {
    currentGame.stats[playerId].shots[points] += 1;
    const player = players.find(p => p.id === playerId);
    const entry = {
      id: crypto.randomUUID(),
      playerId,
      playerName: player ? player.name : 'Unknown',
      stat: points,
      at: new Date().toISOString(),
    };
    currentGame.log.push(entry);
    currentGame.undoStack.push({ type: 'shot', entryId: entry.id });
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  function recordAssist(entryId, assistPlayerId) {
    const entry = currentGame.log.find(e => e.id === entryId);
    if (!entry) return;
    const player = players.find(p => p.id === assistPlayerId);
    entry.assist = { playerId: assistPlayerId, playerName: player ? player.name : 'Unknown' };
    currentGame.stats[assistPlayerId].assists += 1;
    currentGame.undoStack.push({ type: 'assist', entryId });
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  function removeAssist(entryId) {
    const entry = currentGame.log.find(e => e.id === entryId);
    if (!entry || !entry.assist) return;
    if (!confirm(`Remove assist credit for ${entry.assist.playerName}?`)) return;
    currentGame.stats[entry.assist.playerId].assists -= 1;
    delete entry.assist;
    currentGame.undoStack = currentGame.undoStack.filter(a => !(a.type === 'assist' && a.entryId === entryId));
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  function recordAndOne(entryId) {
    const entry = currentGame.log.find(e => e.id === entryId);
    if (!entry) return;
    entry.andOne = true;
    currentGame.stats[entry.playerId].shots[1] += 1;
    currentGame.undoStack.push({ type: 'andOne', entryId });
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  function removeAndOne(entryId) {
    const entry = currentGame.log.find(e => e.id === entryId);
    if (!entry || !entry.andOne) return;
    if (!confirm(`Remove the +1 for ${entry.playerName}?`)) return;
    currentGame.stats[entry.playerId].shots[1] -= 1;
    delete entry.andOne;
    currentGame.undoStack = currentGame.undoStack.filter(a => !(a.type === 'andOne' && a.entryId === entryId));
    save(STORAGE.current, currentGame);
    renderActiveGame();
  }

  document.getElementById('undo-btn').addEventListener('click', () => {
    if (currentGame.undoStack.length === 0) return;
    if (!confirm('Undo the last action? This cannot be redone.')) return;

    const action = currentGame.undoStack.pop();
    const entry = currentGame.log.find(e => e.id === action.entryId);

    if (action.type === 'shot') {
      currentGame.stats[entry.playerId].shots[entry.stat] -= 1;
      currentGame.log = currentGame.log.filter(e => e.id !== entry.id);
    } else if (action.type === 'assist') {
      currentGame.stats[entry.assist.playerId].assists -= 1;
      delete entry.assist;
    } else if (action.type === 'andOne') {
      currentGame.stats[entry.playerId].shots[1] -= 1;
      delete entry.andOne;
    }

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
    const endedAt = new Date().toISOString();
    const game = {
      id: currentGame.id,
      startedAt: currentGame.startedAt,
      endedAt,
      teams: {
        A: buildTeamResult(currentGame.teams.A),
        B: buildTeamResult(currentGame.teams.B),
      },
      events: currentGame.log.slice(),
    };
    games.unshift(game);
    save(STORAGE.games, games);
    currentGame = null;
    localStorage.removeItem(STORAGE.current);
    stopClock();
    renderHistory();
    showSummary(game);
  });

  function showSummary(game) {
    document.getElementById('play-setup').classList.add('hidden');
    document.getElementById('play-active').classList.add('hidden');
    document.getElementById('play-summary').classList.remove('hidden');

    const duration = formatElapsed(new Date(game.endedAt) - new Date(game.startedAt));
    const teamA = game.teams.A;
    const teamB = game.teams.B;
    const winner = teamA.score > teamB.score ? teamA.name
      : teamB.score > teamA.score ? teamB.name : null;

    document.getElementById('summary-content').innerHTML = `
      <div class="summary-scoreboard">
        <div class="summary-team">
          <div class="summary-team-name">${escapeHtml(teamA.name)}</div>
          <div class="summary-score${teamA.score >= teamB.score ? ' winner' : ''}">${teamA.score}</div>
        </div>
        <div class="summary-mid">
          <div class="summary-sep">–</div>
          <div class="summary-duration">${duration}</div>
        </div>
        <div class="summary-team">
          <div class="summary-team-name">${escapeHtml(teamB.name)}</div>
          <div class="summary-score${teamB.score >= teamA.score ? ' winner' : ''}">${teamB.score}</div>
        </div>
      </div>
      ${winner ? `<p class="summary-winner">${escapeHtml(winner)} wins!</p>` : '<p class="summary-winner">Tie game!</p>'}
      ${renderSummaryTable(teamA)}
      ${renderSummaryTable(teamB)}
      <button class="btn-secondary summary-share-btn" style="width:100%;margin-top:8px;">Share Summary</button>
    `;

    document.querySelector('.summary-share-btn').addEventListener('click', () => shareGameSummary(game));
  }

  function renderSummaryTable(team) {
    const rows = team.players
      .slice()
      .sort((a, b) => b.points - a.points)
      .map(p => `<tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.shots[1]}</td><td>${p.shots[2]}</td><td>${p.shots[3]}</td>
        <td>${p.assists}</td><td>${p.points}</td>
      </tr>`)
      .join('');
    return `
      <h4 class="team-table-heading">${escapeHtml(team.name)} — ${team.score}</h4>
      <table class="game-table">
        <thead><tr><th>Player</th><th>1PT</th><th>2PT</th><th>3PT</th><th>AST</th><th>PTS</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  document.getElementById('summary-done-btn').addEventListener('click', () => {
    document.getElementById('play-summary').classList.add('hidden');
    renderPlaySetup();
  });

  document.getElementById('discard-game-btn').addEventListener('click', () => {
    if (!confirm('Discard this game without saving?')) return;
    currentGame = null;
    localStorage.removeItem(STORAGE.current);
    stopClock();
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

  // ---------- Menu ----------
  document.getElementById('app-version').textContent = window.APP_VERSION || 'dev';

  document.getElementById('reset-app-btn').addEventListener('click', () => {
    if (!confirm('Delete all players, game history, and any in-progress game? This cannot be undone.')) return;
    localStorage.clear();
    players = [];
    games = [];
    currentGame = null;
    renderPlayers();
    renderPlay();
    renderHistory();
  });

  // ---------- Init ----------
  renderPlayers();
  renderPlay();
  renderHistory();
})();
