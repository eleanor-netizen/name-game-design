// UI wiring + mode-specific flow (Alphabet Blitz, Name Chain) on top of the Game engine.
(function () {
  const screens = {
    home: document.getElementById('screen-home'),
    game: document.getElementById('screen-game'),
    summary: document.getElementById('screen-summary'),
    leaderboard: document.getElementById('screen-leaderboard'),
    achievements: document.getElementById('screen-achievements'),
  };

  const el = {
    playerNameInput: document.getElementById('player-name-input'),
    modeOptions: document.getElementById('mode-options'),
    timerOptions: document.getElementById('timer-options'),
    genderOptions: document.getElementById('gender-options'),
    startBtn: document.getElementById('start-btn'),
    viewLeaderboardBtn: document.getElementById('view-leaderboard-btn'),
    viewAchievementsBtn: document.getElementById('view-achievements-btn'),

    modeLabel: document.getElementById('mode-label'),
    promptDisplay: document.getElementById('prompt-display'),
    remainingDisplay: document.getElementById('remaining-display'),
    timerDisplay: document.getElementById('timer-display'),
    timerLabel: document.getElementById('timer-label'),
    timerValue: document.getElementById('timer-value'),
    scoreTotal: document.getElementById('score-total'),
    endRoundBtn: document.getElementById('end-round-btn'),
    submitForm: document.getElementById('submit-form'),
    nameInput: document.getElementById('name-input'),
    feedbackZone: document.getElementById('feedback-chip-zone'),
    roundList: document.getElementById('round-list'),
    usedCount: document.getElementById('used-count'),
    usedNamesList: document.getElementById('used-names-list'),

    summaryHeading: document.getElementById('summary-heading'),
    summarySubheading: document.getElementById('summary-subheading'),
    summaryCount: document.getElementById('summary-count'),
    summaryScore: document.getElementById('summary-score'),
    summaryRarest: document.getElementById('summary-rarest'),
    summaryNewNames: document.getElementById('summary-new-names'),
    summaryDurationStat: document.getElementById('summary-duration-stat'),
    summaryDuration: document.getElementById('summary-duration'),
    summaryReviewCount: document.getElementById('summary-review-count'),
    summaryReviewList: document.getElementById('summary-review-list'),
    summaryMissed: document.getElementById('summary-missed'),
    summaryMissedChips: document.getElementById('summary-missed-chips'),
    highScoreBanner: document.getElementById('high-score-banner'),
    highScoreBannerTitle: document.getElementById('high-score-banner-title'),
    achievementBanner: document.getElementById('achievement-banner'),
    achievementBannerLabel: document.getElementById('achievement-banner-label'),
    achievementBannerTitle: document.getElementById('achievement-banner-title'),
    achievementBannerBtn: document.getElementById('achievement-banner-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    changeModeBtn: document.getElementById('change-mode-btn'),
    summaryLeaderboardBtn: document.getElementById('summary-leaderboard-btn'),
    summaryAchievementsBtn: document.getElementById('summary-achievements-btn'),

    lbModeTabs: document.getElementById('lb-mode-tabs'),
    lbTimerTabs: document.getElementById('lb-timer-tabs'),
    lbGenderFilter: document.getElementById('lb-gender-filter'),
    lbLetterFilter: document.getElementById('lb-letter-filter'),
    lbTableHead: document.getElementById('lb-table-head'),
    lbTableBody: document.getElementById('lb-table-body'),
    lbTable: document.getElementById('lb-table'),
    lbEmpty: document.getElementById('lb-empty'),
    lbBackBtn: document.getElementById('lb-back-btn'),

    achievementsProgress: document.getElementById('achievements-progress'),
    achievementsCategories: document.getElementById('achievements-categories'),
    achievementsBackBtn: document.getElementById('achievements-back-btn'),
    unicornOverlay: document.getElementById('unicorn-overlay'),
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
  let roundStartTimestamp = 0; // used to clock untimed/instant-death rounds
  let lastRoundEntryId = null; // highlights this round's row when High Scores is opened from the summary screen
  let newNamesThisRound = 0; // count of names accepted this round that were never played before (lifetime)

  let instantDeathIntervalId = null;
  let instantDeathRemaining = 0;

  let blitzLetter = null;

  // Name Chain's current seed letter as an index (0=A ... 25=Z). Reaching Z
  // ends the round rather than wrapping, so this only ever counts up to 25.
  let chainAbsoluteIndex = 0;
  let chain = null; // { seedEntry, blanks: [{letter, filled, filledName}], currentBlankIndex, blockedKeys }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  const NAME_SET_LABELS = { all: 'All', male: 'Male', female: 'Female' };
  const TIMER_LABELS = { untimed: 'Untimed', '60': '60s', 'instant-death': 'Instant Death' };

  // Easter egg: these names send a unicorn dashing across the screen when accepted.
  const UNICORN_NAMES = new Set([
    'betsy', 'mary', 'sam', 'samuel', 'eleanor', 'ellie', 'lynn', 'patricia',
    'virgil', 'walter', 'walt', 'judd', 'judson', 'cate', 'catherine', 'rosie',
    'rosalene', 'melissa', 'caleb', 'wade', 'mickey', 'cal', 'maxine', 'nancy',
    'thomas', 'tom', 'heidi', 'isabelle', 'max', 'maxwell', 'rachel', 'sarah',
  ]);

  function maybeSpawnUnicorn(name) {
    if (!UNICORN_NAMES.has(name.toLowerCase())) return;
    const wrap = document.createElement('div');
    wrap.className = 'unicorn-wrap';
    wrap.style.top = (15 + Math.random() * 55) + '%';

    const trail = document.createElement('div');
    trail.className = 'unicorn-trail';
    wrap.appendChild(trail);

    const unicorn = document.createElement('span');
    unicorn.className = 'unicorn-dash';
    unicorn.textContent = '🦄';
    wrap.appendChild(unicorn);

    el.unicornOverlay.appendChild(wrap);
    unicorn.addEventListener('animationend', () => wrap.remove());
  }

  function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // Shared row builder for both the live sidebar and the post-round review list.
  function buildNameListItem(entry) {
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
    return li;
  }

  const REMAINING_NOUN_BY_GENDER = { all: 'name', female: 'female name', male: 'male name' };

  // Updates the live "names remaining" readout for `letter` and returns the
  // count, so callers can also check whether the pool has run dry.
  function updateRemainingDisplay(letter, extraBlockedKeys) {
    const remaining = Game.remainingCount(letter, extraBlockedKeys);
    const noun = REMAINING_NOUN_BY_GENDER[currentGenderFilter] || 'name';
    const plural = remaining === 1 ? noun : noun + 's';
    el.remainingDisplay.textContent = `${remaining} ${plural} left starting with "${letter}"`;
    return remaining;
  }

  // Refreshes the remaining-count display for `letter` and, if the pool has
  // hit zero (no further accepted entry is possible), ends the round.
  // Returns true if the round was ended.
  function checkRemainingOrEnd(letter, extraBlockedKeys) {
    const remaining = updateRemainingDisplay(letter, extraBlockedKeys);
    if (remaining <= 0) {
      endRound({ reason: 'exhausted' });
      return true;
    }
    return false;
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
    // Jump to the board for the game just played, with that round's row highlighted.
    setLeaderboardFilters(currentMode, currentTimerSetting, currentGenderFilter, blitzLetter);
    renderLeaderboardTable();
    showScreen('leaderboard');
  });
  el.lbBackBtn.addEventListener('click', () => showScreen('home'));
  el.viewAchievementsBtn.addEventListener('click', () => {
    renderAchievementsScreen();
    showScreen('achievements');
  });
  el.summaryAchievementsBtn.addEventListener('click', () => {
    renderAchievementsScreen();
    showScreen('achievements');
  });
  el.achievementsBackBtn.addEventListener('click', () => showScreen('home'));
  el.achievementBannerBtn.addEventListener('click', () => {
    renderAchievementsScreen();
    showScreen('achievements');
  });

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
    newNamesThisRound = 0;

    el.modeLabel.textContent =
      (mode === 'blitz' ? 'Alphabet Blitz' : 'Name Chain') + ' (' + NAME_SET_LABELS[currentGenderFilter] + ' Names)';

    if (mode === 'blitz') {
      blitzLetter = Game.randomLetter();
      renderBlitzPrompt();
      if (checkRemainingOrEnd(blitzLetter)) return; // pool already empty (pathological edge case)
    } else {
      chainAbsoluteIndex = 0; // Name Chain always starts its first seed at "A"
      if (startNewChainSeed()) return; // same -- ended immediately if that seed's pool is empty
    }

    updateScoreDisplay();
    renderSidebar();

    clearInterval(timerIntervalId);
    clearInterval(instantDeathIntervalId);
    el.timerDisplay.classList.remove('low', 'danger');
    el.endRoundBtn.classList.remove('hidden');
    // Always tracked (not just for untimed/instant-death display) so elapsed
    // time is available for time-based achievements regardless of timer mode.
    roundStartTimestamp = Date.now();

    if (currentTimerSetting === 'instant-death') {
      // The 5-second countdown only starts once the player submits their
      // first name; total elapsed time is still tracked for the leaderboard.
      el.timerLabel.textContent = 'Get Ready';
      el.timerValue.textContent = '—';
      el.timerDisplay.classList.remove('hidden');
    } else if (currentTimerSetting === 'untimed') {
      el.timerLabel.textContent = 'Time Played';
      el.timerValue.textContent = formatDuration(0);
      el.timerDisplay.classList.remove('hidden');
      timerIntervalId = setInterval(tickStopwatch, 1000);
    } else {
      el.timerLabel.textContent = 'Time Left';
      timerRemaining = parseInt(currentTimerSetting, 10);
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
      endRound({ reason: 'timeout' });
    }
  }

  function tickStopwatch() {
    const elapsedSeconds = Math.floor((Date.now() - roundStartTimestamp) / 1000);
    el.timerValue.textContent = formatDuration(elapsedSeconds);
  }

  // Instant Death: each accepted name buys 5 more seconds to submit the next one.
  function startInstantDeathCountdown() {
    clearInterval(instantDeathIntervalId);
    instantDeathRemaining = 5;
    el.timerLabel.textContent = 'Next Name In';
    el.timerValue.textContent = instantDeathRemaining;
    el.timerDisplay.classList.remove('danger');
    el.timerDisplay.classList.add('instant-death');
    instantDeathIntervalId = setInterval(tickInstantDeathCountdown, 1000);
  }

  function tickInstantDeathCountdown() {
    instantDeathRemaining--;
    el.timerValue.textContent = instantDeathRemaining;
    if (instantDeathRemaining <= 2) el.timerDisplay.classList.add('danger');
    if (instantDeathRemaining <= 0) {
      clearInterval(instantDeathIntervalId);
      endRound({ reason: 'lost' });
    }
  }

  el.endRoundBtn.addEventListener('click', () => endRound({ reason: 'manual' }));

  const SUMMARY_HEADING_BY_REASON = {
    manual: 'Round Complete',
    timeout: "Time's Up!",
    reachedZ: 'Nicely Done!',
    lost: 'Game Over',
    exhausted: 'Dictionary Exhausted!',
  };

  function endRound(options) {
    options = options || {};
    clearInterval(timerIntervalId);
    clearInterval(instantDeathIntervalId);
    const roundEntries = Game.usedEntries;
    const roundScore = Game.scoreTotal();
    let rarest = null;
    roundEntries.forEach((e) => {
      if (!rarest || e.rank > rarest.rank) rarest = e;
    });

    el.summaryHeading.textContent = SUMMARY_HEADING_BY_REASON[options.reason] || SUMMARY_HEADING_BY_REASON.manual;
    if (options.reason === 'lost' && REJECT_REASON_TEXT[options.rejectReason]) {
      el.summarySubheading.textContent = REJECT_REASON_TEXT[options.rejectReason];
      el.summarySubheading.classList.remove('hidden');
    } else {
      el.summarySubheading.classList.add('hidden');
    }
    el.summaryCount.textContent = roundEntries.length;
    el.summaryScore.textContent = roundScore;
    el.summaryRarest.textContent = rarest ? rarest.name : '—';
    el.summaryNewNames.textContent = newNamesThisRound;

    const byScoreDesc = [...roundEntries].sort((a, b) => b.score - a.score);
    el.summaryReviewCount.textContent = byScoreDesc.length ? `(${byScoreDesc.length})` : '';
    el.summaryReviewList.innerHTML = '';
    byScoreDesc.forEach((e) => el.summaryReviewList.appendChild(buildNameListItem(e)));

    // Suggest a few names the player could still have tried for whatever
    // prompt they were stuck on -- skipped when they won by completing the
    // whole alphabet (nothing was missed). Naturally comes up empty (and
    // stays hidden) for an exhausted pool, since nothing was left to try.
    let missedLetter = null;
    let missedBlockedKeys = null;
    if (options.reason !== 'reachedZ') {
      if (currentMode === 'blitz') {
        missedLetter = blitzLetter;
      } else if (chain && chain.currentBlankIndex < chain.blanks.length) {
        missedLetter = chain.blanks[chain.currentBlankIndex].letter;
        missedBlockedKeys = chain.blockedKeys;
      }
    }
    const missed = missedLetter ? Game.sampleRemainingByTier(missedLetter, missedBlockedKeys) : [];
    if (missed.length > 0) {
      el.summaryMissedChips.innerHTML = '';
      missed.forEach((e) => {
        const chip = document.createElement('span');
        chip.className = 'round-chip ' + Game.tierClass(e.rank);
        chip.textContent = e.name;
        el.summaryMissedChips.appendChild(chip);
      });
      el.summaryMissed.classList.remove('hidden');
    } else {
      el.summaryMissed.classList.add('hidden');
    }

    const elapsedSeconds = Math.floor((Date.now() - roundStartTimestamp) / 1000);

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
      // chainAbsoluteIndex is always 0-25 (A-Z): reaching Z ends the round
      // immediately rather than wrapping, so there's never more than one lap.
      const letter = String.fromCharCode(65 + chainAbsoluteIndex);
      entry.lettersThru = `A thru ${letter}`;
      entry.lettersThruIndex = chainAbsoluteIndex;
    }
    if (currentTimerSetting === 'untimed' || currentTimerSetting === 'instant-death') {
      entry.durationSeconds = elapsedSeconds;
      el.summaryDuration.textContent = formatDuration(elapsedSeconds);
      el.summaryDurationStat.classList.remove('hidden');
    } else {
      el.summaryDurationStat.classList.add('hidden');
    }
    lastRoundEntryId = Leaderboard.addEntry(entry).id;

    // Did this round just take #1 on the exact board it belongs to (the same
    // board "High Scores" jumps to from this screen -- mode/timer/name set,
    // plus starting letter for Blitz)?
    let boardEntries = Leaderboard.getFiltered(entry.mode, entry.timer, entry.nameSet);
    if (entry.mode === 'blitz') {
      boardEntries = boardEntries.filter((e) => e.startLetter === entry.startLetter);
    }
    const myRanked = Leaderboard.withRanks(boardEntries).find((e) => e.id === lastRoundEntryId);
    if (myRanked && myRanked.rank === 1) {
      const parts = [
        currentMode === 'blitz' ? 'Alphabet Blitz' : 'Name Chain',
        TIMER_LABELS[currentTimerSetting] || currentTimerSetting,
        NAME_SET_LABELS[currentGenderFilter] || currentGenderFilter,
      ];
      if (currentMode === 'blitz') parts.push('Letter ' + blitzLetter);
      el.highScoreBannerTitle.textContent = 'Top of the ' + parts.join(' · ') + ' board!';
      el.highScoreBanner.classList.remove('hidden');
    } else {
      el.highScoreBanner.classList.add('hidden');
    }

    const { newlyUnlocked } = Achievements.recordRound({
      mode: currentMode,
      timer: currentTimerSetting,
      reason: options.reason || 'manual',
      score: roundScore,
      roundEntries,
      durationSeconds: elapsedSeconds,
      playerName: currentPlayerName,
      startLetter: currentMode === 'blitz' ? blitzLetter : undefined,
    });
    if (newlyUnlocked.length > 0) {
      el.achievementBannerLabel.textContent =
        newlyUnlocked.length > 1 ? `${newlyUnlocked.length} Achievements Unlocked!` : 'Achievement Unlocked!';
      el.achievementBannerTitle.textContent = newlyUnlocked.map((b) => `${b.icon} ${b.title}`).join('   ·   ');
      el.achievementBanner.classList.remove('hidden');
    } else {
      el.achievementBanner.classList.add('hidden');
    }

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

  // Returns true if starting this seed immediately ended the round (its first
  // blank's pool was already exhausted -- a pathological edge case).
  function startNewChainSeed() {
    const letter = String.fromCharCode(65 + chainAbsoluteIndex);
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
    return checkRemainingOrEnd(chain.blanks[0].letter, chain.blockedKeys);
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

    const instantDeath = currentTimerSetting === 'instant-death';

    if (currentMode === 'blitz') {
      const result = Game.tryAccept(raw, blitzLetter);
      if (result.ok) {
        acceptName(result.record);
        if (checkRemainingOrEnd(blitzLetter)) return; // no names left for this letter -- round over
        if (instantDeath) startInstantDeathCountdown();
      } else if (instantDeath) {
        clearInterval(instantDeathIntervalId);
        endRound({ reason: 'lost', rejectReason: result.reason });
      } else {
        rejectFeedback(raw, result.reason, blitzLetter);
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
        renderChainPrompt(); // always show the fill immediately, even on the seed's last blank

        if (chain.currentBlankIndex >= chain.blanks.length) {
          if (chainAbsoluteIndex === 25) {
            // Just completed the "Z" seed: the round ends here, it does not
            // wrap back around to "A". Leave chainAbsoluteIndex at 25 (Z) so
            // the leaderboard/summary correctly report "A thru Z".
            clearInterval(instantDeathIntervalId);
            setTimeout(() => endRound({ reason: 'reachedZ' }), 550);
          } else {
            chainAbsoluteIndex++;
            if (instantDeath) startInstantDeathCountdown();
            setTimeout(startNewChainSeed, 550);
          }
        } else {
          const nextLetter = chain.blanks[chain.currentBlankIndex].letter;
          if (checkRemainingOrEnd(nextLetter, chain.blockedKeys)) return; // no names left for this letter -- round over
          if (instantDeath) startInstantDeathCountdown();
        }
      } else if (instantDeath) {
        clearInterval(instantDeathIntervalId);
        endRound({ reason: 'lost', rejectReason: result.reason });
      } else {
        rejectFeedback(raw, result.reason, requiredLetter);
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

    maybeSpawnUnicorn(record.name);

    el.feedbackZone.innerHTML = '';
    if (Achievements.isNewName(record.name)) {
      newNamesThisRound++;
      const chip = document.createElement('span');
      chip.className = 'feedback-chip new-name';

      const nameLine = document.createElement('span');
      nameLine.className = 'feedback-name';
      nameLine.textContent = record.name;
      chip.appendChild(nameLine);

      const reasonLine = document.createElement('span');
      reasonLine.className = 'feedback-reason';
      reasonLine.textContent = 'New name!';
      chip.appendChild(reasonLine);

      el.feedbackZone.appendChild(chip);
      setTimeout(() => {
        if (chip.parentNode) chip.remove();
      }, 2200);
    }

    updateScoreDisplay();
    renderSidebar();
  }

  const REJECT_REASON_TEXT = {
    used: 'Name already used',
    'not-found': 'Name not recognized',
    'wrong-letter': 'Wrong starting letter',
  };

  function rejectFeedback(raw, reason, requiredLetter) {
    const chip = document.createElement('span');
    chip.className = 'feedback-chip reject';

    const nameLine = document.createElement('span');
    nameLine.className = 'feedback-name';
    nameLine.textContent = raw.trim();
    chip.appendChild(nameLine);

    const reasonLine = document.createElement('span');
    reasonLine.className = 'feedback-reason';
    reasonLine.textContent =
      reason === 'wrong-letter' && requiredLetter
        ? `Must start with "${requiredLetter.toUpperCase()}"`
        : REJECT_REASON_TEXT[reason] || REJECT_REASON_TEXT['not-found'];
    chip.appendChild(reasonLine);

    el.feedbackZone.innerHTML = '';
    el.feedbackZone.appendChild(chip);
    setTimeout(() => {
      if (chip.parentNode) chip.remove();
    }, 2200);
  }

  function updateScoreDisplay() {
    el.scoreTotal.textContent = Game.scoreTotal();
  }

  function renderSidebar() {
    const sorted = Game.getSidebarSorted();
    el.usedCount.textContent = sorted.length ? `(${sorted.length})` : '';
    el.usedNamesList.innerHTML = '';
    sorted.forEach((entry) => el.usedNamesList.appendChild(buildNameListItem(entry)));
  }

  // ---------- Leaderboard ----------

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
    // Untimed and Instant Death are both variable-length: their duration is
    // worth showing. The 60s board has a fixed, implied duration.
    if (timer === 'untimed' || timer === 'instant-death') {
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
  let lbLetter = 'all';
  let lbSortKey = 'score';
  let lbSortDir = 'desc';

  // Points the High Scores screen at a specific board (and, for Blitz, a
  // specific starting letter) and syncs the tab UI to match -- used to jump
  // straight to "the board for the game you just played" from the summary screen.
  function setLeaderboardFilters(mode, timer, genderFilter, letter) {
    lbMode = mode;
    lbTimer = timer;
    lbGenderFilter = genderFilter;
    lbLetter = mode === 'blitz' && letter ? letter : 'all';
    lbSortKey = 'score';
    lbSortDir = 'desc';

    [...el.lbModeTabs.children].forEach((c) => c.classList.toggle('selected', c.dataset.lbMode === lbMode));
    [...el.lbTimerTabs.children].forEach((c) => c.classList.toggle('selected', c.dataset.lbTimer === lbTimer));
    [...el.lbGenderFilter.children].forEach((c) => c.classList.toggle('selected', c.dataset.lbGender === lbGenderFilter));
    el.lbLetterFilter.classList.toggle('hidden', lbMode !== 'blitz');
    [...el.lbLetterFilter.children].forEach((c) => c.classList.toggle('selected', c.dataset.lbLetter === lbLetter));
  }

  // Alphabet Blitz only: a horizontally scrollable "All" + A-Z strip that
  // filters the high-score table down to rounds that started with that letter.
  el.lbLetterFilter.innerHTML = '';
  ['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].forEach((letter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn lb-letter-btn' + (letter === 'all' ? ' selected' : '');
    btn.dataset.lbLetter = letter;
    btn.textContent = letter === 'all' ? 'All' : letter;
    el.lbLetterFilter.appendChild(btn);
  });
  el.lbLetterFilter.classList.toggle('hidden', lbMode !== 'blitz');

  el.lbLetterFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.lb-letter-btn');
    if (!btn) return;
    lbLetter = btn.dataset.lbLetter;
    [...el.lbLetterFilter.children].forEach((c) => c.classList.toggle('selected', c === btn));
    lbSortKey = 'score';
    lbSortDir = 'desc';
    renderLeaderboardTable();
  });

  el.lbModeTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    lbMode = btn.dataset.lbMode;
    [...el.lbModeTabs.children].forEach((c) => c.classList.toggle('selected', c === btn));
    el.lbLetterFilter.classList.toggle('hidden', lbMode !== 'blitz');
    lbLetter = 'all';
    [...el.lbLetterFilter.children].forEach((c) => c.classList.toggle('selected', c.dataset.lbLetter === 'all'));
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
    let entries = Leaderboard.getFiltered(lbMode, lbTimer, lbGenderFilter);
    if (lbMode === 'blitz' && lbLetter !== 'all') {
      entries = entries.filter((e) => e.startLetter === lbLetter);
    }
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
    let mineRow = null;
    sorted.forEach((entry) => {
      const tr = document.createElement('tr');
      if (entry.rank === 1) tr.classList.add('lb-rank-first');
      if (entry.id === lastRoundEntryId) {
        tr.classList.add('lb-row-mine');
        mineRow = tr;
      }
      columns.forEach((col) => {
        const td = document.createElement('td');
        td.textContent = col.format ? col.format(entry) : entry[col.key];
        tr.appendChild(td);
      });
      el.lbTableBody.appendChild(tr);
    });

    el.lbTable.classList.toggle('hidden', sorted.length === 0);
    el.lbEmpty.classList.toggle('hidden', sorted.length !== 0);
    if (mineRow) mineRow.scrollIntoView({ block: 'center' });
  }

  // ---------- Achievements ----------

  function renderAchievementsScreen() {
    const { unlocked, stats } = Achievements.getProgress();
    const total = Achievements.BADGES.length;
    const earnedCount = Achievements.BADGES.filter((b) => (unlocked[b.id] || []).length > 0).length;
    el.achievementsProgress.textContent = `${earnedCount} / ${total} earned`;

    const categories = [];
    Achievements.BADGES.forEach((badge) => {
      let cat = categories.find((c) => c.name === badge.category);
      if (!cat) {
        cat = { name: badge.category, badges: [] };
        categories.push(cat);
      }
      cat.badges.push(badge);
    });

    el.achievementsCategories.innerHTML = '';
    categories.forEach((cat) => {
      const section = document.createElement('div');
      section.className = 'achievement-category';

      const heading = document.createElement('h3');
      heading.textContent = cat.name;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'achievement-grid';

      cat.badges.forEach((badge) => {
        const earners = unlocked[badge.id] || [];
        const card = document.createElement('div');
        card.className = 'achievement-card' + (earners.length > 0 ? ' unlocked' : '');

        const icon = document.createElement('span');
        icon.className = 'achievement-icon';
        icon.textContent = badge.icon;
        card.appendChild(icon);

        const text = document.createElement('div');
        text.className = 'achievement-text';
        const title = document.createElement('div');
        title.className = 'achievement-title';
        title.textContent = badge.title;
        text.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'achievement-desc';
        desc.textContent = badge.desc;
        text.appendChild(desc);

        if (badge.progress) {
          const { current, target } = badge.progress(stats);
          const pct = Math.max(0, Math.min(100, (current / target) * 100));
          const track = document.createElement('div');
          track.className = 'achievement-progress-track';
          const fill = document.createElement('div');
          fill.className = 'achievement-progress-fill';
          fill.style.width = pct + '%';
          track.appendChild(fill);
          text.appendChild(track);
          const progLabel = document.createElement('div');
          progLabel.className = 'achievement-progress-label';
          progLabel.textContent = `${Math.min(current, target).toLocaleString()} / ${target.toLocaleString()}`;
          text.appendChild(progLabel);
        }

        if (badge.letterStatus) {
          const status = badge.letterStatus(stats);
          const expandBtn = document.createElement('button');
          expandBtn.type = 'button';
          expandBtn.className = 'achievement-expand-btn';
          expandBtn.textContent = '▸ Letter progress';
          expandBtn.setAttribute('aria-expanded', 'false');
          text.appendChild(expandBtn);

          const letterGrid = document.createElement('div');
          letterGrid.className = 'achievement-letter-grid hidden';
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter) => {
            const cell = document.createElement('span');
            cell.className = 'letter-cell' + (status[letter] ? ' complete' : '');
            cell.textContent = letter;
            letterGrid.appendChild(cell);
          });
          text.appendChild(letterGrid);

          expandBtn.addEventListener('click', () => {
            const nowHidden = letterGrid.classList.toggle('hidden');
            expandBtn.textContent = (nowHidden ? '▸' : '▾') + ' Letter progress';
            expandBtn.setAttribute('aria-expanded', String(!nowHidden));
          });
        }

        if (earners.length > 0) {
          const earnedWrap = document.createElement('div');
          earnedWrap.className = 'achievement-earned';
          const label = document.createElement('div');
          label.className = 'achievement-earned-label';
          label.textContent = 'Earned by:';
          earnedWrap.appendChild(label);
          earners.forEach((e) => {
            const row = document.createElement('div');
            row.className = 'achievement-earned-row';
            row.textContent = `${new Date(e.date).toLocaleDateString()} — ${e.name}`;
            earnedWrap.appendChild(row);
          });
          text.appendChild(earnedWrap);
        }

        card.appendChild(text);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      el.achievementsCategories.appendChild(section);
    });
  }
})();
