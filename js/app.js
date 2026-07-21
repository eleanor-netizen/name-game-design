// UI wiring + mode-specific flow (Alphabet Blitz, Name Chain) on top of the Game engine.
(function () {
  const screens = {
    home: document.getElementById('screen-home'),
    game: document.getElementById('screen-game'),
    summary: document.getElementById('screen-summary'),
    leaderboard: document.getElementById('screen-leaderboard'),
  };

  const el = {
    playerNameInput: document.getElementById('player-name-input'),
    modeOptions: document.getElementById('mode-options'),
    timerOptions: document.getElementById('timer-options'),
    genderOptions: document.getElementById('gender-options'),
    startBtn: document.getElementById('start-btn'),
    viewLeaderboardBtn: document.getElementById('view-leaderboard-btn'),

    modeLabel: document.getElementById('mode-label'),
    promptDisplay: document.getElementById('prompt-display'),
    timerDisplay: document.getElementById('timer-display'),
    timerLabel: document.getElementById('timer-label'),
    timerValue: document.getElementById('timer-value'),
    scoreTotal: document.getElementById('score-total'),
    endRoundBtn: document.getElementById('end-round-btn'),
    endGameBtn: document.getElementById('end-game-btn'),
    submitForm: document.getElementById('submit-form'),
    nameInput: document.getElementById('name-input'),
    feedbackZone: document.getElementById('feedback-chip-zone'),
    roundList: document.getElementById('round-list'),
    usedCount: document.getElementById('used-count'),
    usedNamesList: document.getElementById('used-names-list'),

    summaryCount: document.getElementById('summary-count'),
    summaryScore: document.getElementById('summary-score'),
    summaryRarest: document.getElementById('summary-rarest'),
    summaryDurationStat: document.getElementById('summary-duration-stat'),
    summaryDuration: document.getElementById('summary-duration'),
    playAgainBtn: document.getElementById('play-again-btn'),
    changeModeBtn: document.getElementById('change-mode-btn'),
    summaryLeaderboardBtn: document.getElementById('summary-leaderboard-btn'),

    lbModeTabs: document.getElementById('lb-mode-tabs'),
    lbTimerTabs: document.getElementById('lb-timer-tabs'),
    lbGenderFilter: document.getElementById('lb-gender-filter'),
    lbTableHead: document.getElementById('lb-table-head'),
    lbTableBody: document.getElementById('lb-table-body'),
    lbTable: document.getElementById('lb-table'),
    lbEmpty: document.getElementById('lb-empty'),
    lbBackBtn: document.getElementById('lb-back-btn'),
  };

  let selectedMode = 'blitz';
  let selectedTimer = 'untimed';
  let selectedGender = 'all';

  let currentMode = null;
  let currentTimerSetting = 'untimed';
  let currentGenderFilter = 'all';
  let currentPlayerName = 'Anonymous';
  let timerRemaining = 0;
  let timerIntervalId = null;
  let roundStartTimestamp = 0; // used to clock untimed rounds

  let blitzLetter = null;

  // Non-wrapping seed counter for Name Chain: chainAbsoluteIndex % 26 gives the
  // actual letter used for game logic, while the raw value lets us report how
  // far through the alphabet (potentially past one lap) a session got.
  let chainAbsoluteIndex = 0;
  let chain = null; // { seedEntry, blanks: [{letter, filled, filledName}], currentBlankIndex, blockedKeys }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  el.playerNameInput.value = Leaderboard.getPlayerName();

  // ---------- Home screen option toggles ----------

  el.modeOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    selectedMode = btn.dataset.mode;
    [...el.modeOptions.children].forEach((c) => c.classList.toggle('selected', c === btn));
  });

  el.timerOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    selectedTimer = btn.dataset.timer;
    [...el.timerOptions.children].forEach((c) => c.classList.toggle('selected', c === btn));
  });

  el.genderOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    selectedGender = btn.dataset.gender;
    [...el.genderOptions.children].forEach((c) => c.classList.toggle('selected', c === btn));
  });

  el.startBtn.addEventListener('click', () => startGame(selectedMode, selectedTimer));
  el.playAgainBtn.addEventListener('click', () => startGame(currentMode, currentTimerSetting));
  el.changeModeBtn.addEventListener('click', () => showScreen('home'));
  el.viewLeaderboardBtn.addEventListener('click', () => {
    renderLeaderboardTable();
    showScreen('leaderboard');
  });
  el.summaryLeaderboardBtn.addEventListener('click', () => {
    renderLeaderboardTable();
    showScreen('leaderboard');
  });
  el.lbBackBtn.addEventListener('click', () => showScreen('home'));

  // ---------- Round lifecycle ----------
  // Each Start Game / Play Again begins a brand new play session: score and
  // the used-names list both reset, so previously-used names become
  // available again.

  function startGame(mode, timerSetting) {
    currentMode = mode;
    currentTimerSetting = timerSetting;
    currentGenderFilter = selectedGender;
    currentPlayerName = el.playerNameInput.value.trim() || 'Anonymous';
    Leaderboard.setPlayerName(currentPlayerName);

    Game.setGenderFilter(selectedGender);
    Game.resetSession();

    el.roundList.innerHTML = '';
    el.nameInput.value = '';
    el.feedbackZone.innerHTML = '';

    el.modeLabel.textContent = mode === 'blitz' ? 'Alphabet Blitz' : 'Name Chain';

    if (mode === 'blitz') {
      blitzLetter = Game.randomLetter();
      renderBlitzPrompt();
    } else {
      chainAbsoluteIndex = 0; // Name Chain always starts its first seed at "A"
      startNewChainSeed();
    }

    updateScoreDisplay();
    renderSidebar();

    clearInterval(timerIntervalId);
    el.timerDisplay.classList.remove('low');
    if (timerSetting === 'untimed') {
      el.timerLabel.textContent = 'Time Played';
      roundStartTimestamp = Date.now();
      el.timerValue.textContent = formatDuration(0);
      el.timerDisplay.classList.remove('hidden');
      el.endRoundBtn.classList.remove('hidden');
      timerIntervalId = setInterval(tickStopwatch, 1000);
    } else {
      el.timerLabel.textContent = 'Time Left';
      timerRemaining = parseInt(timerSetting, 10);
      el.timerValue.textContent = timerRemaining;
      el.timerDisplay.classList.remove('hidden');
      el.endRoundBtn.classList.add('hidden');
      timerIntervalId = setInterval(tickTimer, 1000);
    }

    showScreen('game');
    el.nameInput.focus();
  }

  function tickTimer() {
    timerRemaining--;
    el.timerValue.textContent = timerRemaining;
    if (timerRemaining <= 10) el.timerDisplay.classList.add('low');
    if (timerRemaining <= 0) {
      clearInterval(timerIntervalId);
      endRound();
    }
  }

  function tickStopwatch() {
    const elapsedSeconds = Math.floor((Date.now() - roundStartTimestamp) / 1000);
    el.timerValue.textContent = formatDuration(elapsedSeconds);
  }

  el.endRoundBtn.addEventListener('click', endRound);

  el.endGameBtn.addEventListener('click', () => {
    clearInterval(timerIntervalId);
    showScreen('home');
  });

  function endRound() {
    clearInterval(timerIntervalId);
    const roundEntries = Game.usedEntries;
    const roundScore = Game.scoreTotal();
    let rarest = null;
    roundEntries.forEach((e) => {
      if (!rarest || e.rank > rarest.rank) rarest = e;
    });

    el.summaryCount.textContent = roundEntries.length;
    el.summaryScore.textContent = roundScore;
    el.summaryRarest.textContent = rarest ? rarest.name : '—';

    const entry = {
      playerName: currentPlayerName,
      mode: currentMode,
      timer: currentTimerSetting,
      nameSet: currentGenderFilter,
      score: roundScore,
      namesCount: roundEntries.length,
    };
    if (currentMode === 'blitz') {
      entry.startLetter = blitzLetter;
    } else {
      const laps = Math.floor(chainAbsoluteIndex / 26);
      const letter = String.fromCharCode(65 + (chainAbsoluteIndex % 26));
      entry.lettersThru = laps > 0 ? `A thru ${letter} (lap ${laps + 1})` : `A thru ${letter}`;
      entry.lettersThruIndex = chainAbsoluteIndex;
    }
    if (currentTimerSetting === 'untimed') {
      entry.durationSeconds = Math.floor((Date.now() - roundStartTimestamp) / 1000);
      el.summaryDuration.textContent = formatDuration(entry.durationSeconds);
      el.summaryDurationStat.classList.remove('hidden');
    } else {
      el.summaryDurationStat.classList.add('hidden');
    }
    Leaderboard.addEntry(entry);

    showScreen('summary');
  }

  // ---------- Alphabet Blitz ----------

  function renderBlitzPrompt() {
    el.promptDisplay.innerHTML = '';
    const badge = document.createElement('span');
    badge.className = 'letter-badge';
    badge.textContent = blitzLetter;
    el.promptDisplay.appendChild(badge);
  }

  // ---------- Name Chain ----------

  function startNewChainSeed() {
    const letter = String.fromCharCode(65 + (chainAbsoluteIndex % 26));
    const seedEntry = Game.pickSeedName(letter);
    const blanks = seedEntry.name
      .toUpperCase()
      .split('')
      .map((ch) => ({ letter: ch, filled: false, filledName: null }));
    chain = {
      seedEntry,
      blanks,
      currentBlankIndex: 0,
      blockedKeys: new Set([Game.dedupeKey(seedEntry.name.toLowerCase())]),
    };
    renderChainPrompt();
  }

  function renderChainPrompt() {
    el.promptDisplay.innerHTML = '';
    chain.blanks.forEach((blank, i) => {
      const wrap = document.createElement('span');
      wrap.className = 'chain-blank';
      if (blank.filled) wrap.classList.add('filled');
      if (i === chain.currentBlankIndex) wrap.classList.add('current');

      const badge = document.createElement('span');
      badge.className = 'letter-badge';
      badge.textContent = blank.letter;
      wrap.appendChild(badge);

      if (blank.filled) {
        const nameLabel = document.createElement('span');
        nameLabel.className = 'filled-name';
        nameLabel.textContent = blank.filledName;
        wrap.appendChild(nameLabel);
      }

      el.promptDisplay.appendChild(wrap);
    });
  }

  // ---------- Submission handling ----------

  el.submitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = el.nameInput.value;
    el.nameInput.value = '';
    if (!raw.trim()) return;

    if (currentMode === 'blitz') {
      const result = Game.tryAccept(raw, blitzLetter);
      if (result.ok) {
        acceptName(result.record);
      } else {
        rejectFeedback(raw, result.reason);
      }
    } else {
      if (!chain || chain.currentBlankIndex >= chain.blanks.length) return; // between seeds, ignore
      const requiredLetter = chain.blanks[chain.currentBlankIndex].letter;
      const result = Game.tryAccept(raw, requiredLetter, chain.blockedKeys);
      if (result.ok) {
        chain.blanks[chain.currentBlankIndex].filled = true;
        chain.blanks[chain.currentBlankIndex].filledName = result.record.name;
        chain.currentBlankIndex++;
        acceptName(result.record);
        if (chain.currentBlankIndex >= chain.blanks.length) {
          chainAbsoluteIndex++;
          setTimeout(startNewChainSeed, 550);
        } else {
          renderChainPrompt();
        }
      } else {
        rejectFeedback(raw, result.reason);
      }
    }
  });

  // Accepted names need no separate flash -- appearing in the round list
  // (with its own pop-in animation) is feedback enough.
  function acceptName(record) {
    const roundChip = document.createElement('span');
    roundChip.className = 'round-chip ' + Game.tierClass(record.rank);
    roundChip.textContent = record.name;
    el.roundList.appendChild(roundChip);

    updateScoreDisplay();
    renderSidebar();
  }

  const REJECT_REASON_TEXT = {
    used: 'Name already used',
    'not-found': 'Name not recognized',
  };

  function rejectFeedback(raw, reason) {
    const chip = document.createElement('span');
    chip.className = 'feedback-chip reject';

    const nameLine = document.createElement('span');
    nameLine.className = 'feedback-name';
    nameLine.textContent = raw.trim();
    chip.appendChild(nameLine);

    const reasonLine = document.createElement('span');
    reasonLine.className = 'feedback-reason';
    reasonLine.textContent = REJECT_REASON_TEXT[reason] || REJECT_REASON_TEXT['not-found'];
    chip.appendChild(reasonLine);

    el.feedbackZone.innerHTML = '';
    el.feedbackZone.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.remove();
    }, 850);
  }

  function updateScoreDisplay() {
    el.scoreTotal.textContent = Game.scoreTotal();
  }

  function renderSidebar() {
    const sorted = Game.getSidebarSorted();
    el.usedCount.textContent = sorted.length ? `(${sorted.length})` : '';
    el.usedNamesList.innerHTML = '';
    sorted.forEach((entry) => {
      const li = document.createElement('li');
      const dot = document.createElement('i');
      dot.className = 'tier-dot ' + Game.tierClass(entry.rank);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = entry.name;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'used-score';
      scoreSpan.textContent = entry.score;
      li.appendChild(dot);
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      el.usedNamesList.appendChild(li);
    });
  }

  // ---------- Leaderboard ----------

  const NAME_SET_LABELS = { all: 'All', male: 'Male', female: 'Female' };

  // Columns depend on mode (blitz vs chain fields), whether the "Any Name Set"
  // filter is active (adds a Name Set column so rows stay distinguishable),
  // and whether this is the Untimed board (adds a Time Played column).
  function getColumns(mode, timer, genderFilter) {
    const columns = [
      { key: 'rank', label: '#', sortable: false, format: (e) => '#' + e.rank },
      { key: 'playerName', label: 'Player', sortable: true, defaultDir: 'asc' },
    ];
    if (genderFilter === 'any') {
      columns.push({
        key: 'nameSet',
        label: 'Name Set',
        sortable: true,
        defaultDir: 'asc',
        format: (e) => NAME_SET_LABELS[e.nameSet] || e.nameSet,
      });
    }
    columns.push({ key: 'score', label: 'Score', sortable: true, defaultDir: 'desc' });
    if (mode === 'blitz') {
      columns.push({ key: 'startLetter', label: 'Starting Letter', sortable: true, defaultDir: 'asc' });
    } else {
      columns.push({
        key: 'lettersThruIndex',
        label: 'Letters Reached',
        sortable: true,
        defaultDir: 'desc',
        format: (e) => e.lettersThru,
      });
    }
    columns.push({ key: 'namesCount', label: 'Names Found', sortable: true, defaultDir: 'desc' });
    if (timer === 'untimed') {
      columns.push({
        key: 'durationSeconds',
        label: 'Time Played',
        sortable: true,
        defaultDir: 'desc',
        format: (e) => formatDuration(e.durationSeconds || 0),
      });
    }
    return columns;
  }

  let lbMode = 'blitz';
  let lbTimer = 'untimed';
  let lbGenderFilter = 'any';
  let lbSortKey = 'score';
  let lbSortDir = 'desc';

  el.lbModeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    lbMode = btn.dataset.lbMode;
    [...el.lbModeTabs.children].forEach((c) => c.classList.toggle('selected', c === btn));
    lbSortKey = 'score';
    lbSortDir = 'desc';
    renderLeaderboardTable();
  });

  el.lbTimerTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    lbTimer = btn.dataset.lbTimer;
    [...el.lbTimerTabs.children].forEach((c) => c.classList.toggle('selected', c === btn));
    lbSortKey = 'score';
    lbSortDir = 'desc';
    renderLeaderboardTable();
  });

  el.lbGenderFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    lbGenderFilter = btn.dataset.lbGender;
    [...el.lbGenderFilter.children].forEach((c) => c.classList.toggle('selected', c === btn));
    lbSortKey = 'score';
    lbSortDir = 'desc';
    renderLeaderboardTable();
  });

  function renderLeaderboardTable() {
    const columns = getColumns(lbMode, lbTimer, lbGenderFilter);
    const entries = Leaderboard.getFiltered(lbMode, lbTimer, lbGenderFilter);
    const ranked = Leaderboard.withRanks(entries);
    const sorted = Leaderboard.sortEntries(ranked, lbSortKey, lbSortDir);

    el.lbTableHead.innerHTML = '';
    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.sortable) {
        th.classList.add('sortable');
        if (col.key === lbSortKey) th.classList.add(lbSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        th.addEventListener('click', () => {
          if (lbSortKey === col.key) {
            lbSortDir = lbSortDir === 'asc' ? 'desc' : 'asc';
          } else {
            lbSortKey = col.key;
            lbSortDir = col.defaultDir;
          }
          renderLeaderboardTable();
        });
      }
      el.lbTableHead.appendChild(th);
    });

    el.lbTableBody.innerHTML = '';
    sorted.forEach((entry) => {
      const tr = document.createElement('tr');
      if (entry.rank === 1) tr.classList.add('lb-rank-first');
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = col.format ? col.format(entry) : entry[col.key];
        tr.appendChild(td);
      });
      el.lbTableBody.appendChild(tr);
    });

    el.lbTable.classList.toggle('hidden', sorted.length === 0);
    el.lbEmpty.classList.toggle('hidden', sorted.length !== 0);
  }
})();
