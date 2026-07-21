// UI wiring + mode-specific flow (Alphabet Blitz, Name Chain) on top of the Game engine.
(function () {
  const screens = {
    home: document.getElementById('screen-home'),
    game: document.getElementById('screen-game'),
    summary: document.getElementById('screen-summary'),
  };

  const el = {
    modeOptions: document.getElementById('mode-options'),
    timerOptions: document.getElementById('timer-options'),
    startBtn: document.getElementById('start-btn'),
    sessionSummary: document.getElementById('session-summary'),
    sessionSummaryText: document.getElementById('session-summary-text'),
    newSessionBtn: document.getElementById('new-session-btn'),

    modeLabel: document.getElementById('mode-label'),
    promptDisplay: document.getElementById('prompt-display'),
    timerDisplay: document.getElementById('timer-display'),
    scoreTotal: document.getElementById('score-total'),
    endRoundBtn: document.getElementById('end-round-btn'),
    submitForm: document.getElementById('submit-form'),
    nameInput: document.getElementById('name-input'),
    feedbackZone: document.getElementById('feedback-chip-zone'),
    roundList: document.getElementById('round-list'),
    usedCount: document.getElementById('used-count'),
    usedNamesList: document.getElementById('used-names-list'),

    summaryCount: document.getElementById('summary-count'),
    summaryScore: document.getElementById('summary-score'),
    summaryRarest: document.getElementById('summary-rarest'),
    summarySessionScore: document.getElementById('summary-session-score'),
    playAgainBtn: document.getElementById('play-again-btn'),
    changeModeBtn: document.getElementById('change-mode-btn'),
  };

  let selectedMode = 'blitz';
  let selectedTimer = 'untimed';

  let currentMode = null;
  let roundStartIndex = 0;
  let timerRemaining = 0;
  let timerIntervalId = null;

  let blitzLetter = null;

  let chainLetterIndex = 0;
  let chain = null; // { seedEntry, blanks: [{letter, filled, filledName}], currentBlankIndex, blockedKeys }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

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

  el.newSessionBtn.addEventListener('click', () => {
    Game.resetSession();
    updateHomeSessionSummary();
  });

  function updateHomeSessionSummary() {
    const count = Game.usedEntries.length;
    if (count === 0) {
      el.sessionSummary.classList.add('hidden');
      return;
    }
    el.sessionSummary.classList.remove('hidden');
    el.sessionSummaryText.textContent =
      `Session so far: ${count} name${count === 1 ? '' : 's'}, ${Game.sessionScoreTotal()} points`;
  }

  el.startBtn.addEventListener('click', () => startGame(selectedMode, selectedTimer));
  el.playAgainBtn.addEventListener('click', () => startGame(currentMode, selectedTimer));
  el.changeModeBtn.addEventListener('click', () => {
    updateHomeSessionSummary();
    showScreen('home');
  });

  // ---------- Round lifecycle ----------

  function startGame(mode, timerSetting) {
    currentMode = mode;
    roundStartIndex = Game.usedEntries.length;
    el.roundList = document.getElementById('round-list');
    el.roundList.innerHTML = '';
    el.nameInput.value = '';
    el.feedbackZone.innerHTML = '';

    el.modeLabel.textContent = mode === 'blitz' ? 'Alphabet Blitz' : 'Name Chain';

    if (mode === 'blitz') {
      blitzLetter = Game.randomLetter();
      renderBlitzPrompt();
    } else {
      chainLetterIndex = Math.floor(Math.random() * 26);
      startNewChainSeed();
    }

    updateScoreDisplay();
    renderSidebar();

    if (timerSetting === 'untimed') {
      el.timerDisplay.classList.add('hidden');
      el.endRoundBtn.classList.remove('hidden');
    } else {
      timerRemaining = parseInt(timerSetting, 10);
      el.timerDisplay.classList.remove('hidden');
      el.timerDisplay.classList.remove('low');
      el.timerDisplay.textContent = timerRemaining;
      el.endRoundBtn.classList.add('hidden');
      clearInterval(timerIntervalId);
      timerIntervalId = setInterval(tickTimer, 1000);
    }

    showScreen('game');
    el.nameInput.focus();
  }

  function tickTimer() {
    timerRemaining--;
    el.timerDisplay.textContent = timerRemaining;
    if (timerRemaining <= 10) el.timerDisplay.classList.add('low');
    if (timerRemaining <= 0) {
      clearInterval(timerIntervalId);
      endRound();
    }
  }

  el.endRoundBtn.addEventListener('click', endRound);

  function endRound() {
    clearInterval(timerIntervalId);
    const roundEntries = Game.usedEntries.slice(roundStartIndex);
    const roundScore = roundEntries.reduce((sum, e) => sum + e.score, 0);
    let rarest = null;
    roundEntries.forEach((e) => {
      if (!rarest || e.rank > rarest.rank) rarest = e;
    });

    el.summaryCount.textContent = roundEntries.length;
    el.summaryScore.textContent = roundScore;
    el.summaryRarest.textContent = rarest ? rarest.name : '—';
    el.summarySessionScore.textContent = Game.sessionScoreTotal();

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
    const letter = String.fromCharCode(65 + chainLetterIndex);
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
        acceptFeedback(result.record);
      } else {
        rejectFeedback(raw);
      }
    } else {
      const requiredLetter = chain.blanks[chain.currentBlankIndex].letter;
      const result = Game.tryAccept(raw, requiredLetter, chain.blockedKeys);
      if (result.ok) {
        chain.blanks[chain.currentBlankIndex].filled = true;
        chain.blanks[chain.currentBlankIndex].filledName = result.record.name;
        chain.currentBlankIndex++;
        acceptFeedback(result.record);
        if (chain.currentBlankIndex >= chain.blanks.length) {
          chainLetterIndex = (chainLetterIndex + 1) % 26;
          setTimeout(startNewChainSeed, 550);
        } else {
          renderChainPrompt();
        }
      } else {
        rejectFeedback(raw);
      }
    }
  });

  function acceptFeedback(record) {
    const chip = document.createElement('span');
    chip.className = 'feedback-chip accept';
    chip.textContent = record.name;
    el.feedbackZone.innerHTML = '';
    el.feedbackZone.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.remove();
    }, 900);

    const roundChip = document.createElement('span');
    roundChip.className = 'round-chip ' + Game.tierClass(record.rank);
    roundChip.textContent = record.name;
    el.roundList.appendChild(roundChip);

    updateScoreDisplay();
    renderSidebar();
  }

  function rejectFeedback(raw) {
    const chip = document.createElement('span');
    chip.className = 'feedback-chip reject';
    chip.textContent = raw.trim();
    el.feedbackZone.innerHTML = '';
    el.feedbackZone.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.remove();
    }, 850);
  }

  function updateScoreDisplay() {
    el.scoreTotal.textContent = Game.sessionScoreTotal();
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

  // ---------- Init ----------
  updateHomeSessionSummary();
})();
