// Core game engine: name validation, scoring, dedupe, and letter/seed helpers.
// Depends on NAMES_DATA (loaded via <script> before this file).
//
// A "session" here is a single play (one Start Game / Play Again click) of one
// mode: score and used-name tracking are scoped to it and reset every time a
// new one begins, per the game's duplicate-checking rules.
const Game = (() => {
  const namesByLower = new Map();
  NAMES_DATA.forEach((entry) => {
    namesByLower.set(entry.name.toLowerCase(), entry);
  });

  const lettersPool = {};
  for (let i = 0; i < 26; i++) lettersPool[String.fromCharCode(65 + i)] = [];
  NAMES_DATA.forEach((entry) => {
    const letter = entry.name[0].toUpperCase();
    if (lettersPool[letter]) lettersPool[letter].push(entry);
  });

  function passesGenderFilter(entry, filter) {
    if (filter === 'male') return entry.gender === 'M' || entry.gender === 'U';
    if (filter === 'female') return entry.gender === 'F' || entry.gender === 'U';
    return true; // 'all'
  }

  // The active pools used for validation/selection during play, scoped to the
  // chosen name set (all / male / female). Rebuilt by setGenderFilter().
  let activeNamesByLower = namesByLower;
  let activeLettersPool = lettersPool;

  function setGenderFilter(filter) {
    if (filter === 'all') {
      activeNamesByLower = namesByLower;
      activeLettersPool = lettersPool;
      return;
    }
    const filteredMap = new Map();
    namesByLower.forEach((entry, key) => {
      if (passesGenderFilter(entry, filter)) filteredMap.set(key, entry);
    });
    activeNamesByLower = filteredMap;

    const filteredLetters = {};
    Object.keys(lettersPool).forEach((letter) => {
      filteredLetters[letter] = lettersPool[letter].filter((e) => passesGenderFilter(e, filter));
    });
    activeLettersPool = filteredLetters;
  }

  // Dedupe is exact-match only: spelling variants (e.g. Brian / Bryan) are
  // treated as distinct names and can both be accepted in the same game.
  function dedupeKey(lower) {
    return lower;
  }

  function getMultiplier(rank) {
    if (rank <= 100) return 1;
    if (rank <= 1000) return 2;
    if (rank <= 5000) return 3;
    return 4;
  }

  function tierClass(rank) {
    return 'tier-' + getMultiplier(rank);
  }

  function computeScore(name, rank) {
    const multiplier = getMultiplier(rank);
    const base = 10 * multiplier;
    const lengthBonus = Math.max(0, name.length - 5);
    return base + lengthBonus;
  }

  // Random letter from the active (gender-filtered) pool only, so Alphabet
  // Blitz never assigns a letter with zero valid names under the filter.
  function randomLetter() {
    const available = Object.keys(activeLettersPool).filter(
      (letter) => activeLettersPool[letter].length > 0
    );
    return available[Math.floor(Math.random() * available.length)];
  }

  // Choose a seed name for Name Chain: prefer well-known, moderate-length names,
  // widening the rank cutoff for sparse letter/gender combos until enough options exist.
  function pickSeedName(letter) {
    const cutoffs = [1500, 3000, 6000, Infinity];
    const pool = activeLettersPool[letter] || [];
    for (const cutoff of cutoffs) {
      const candidates = pool.filter(
        (e) => e.rank <= cutoff && e.name.length >= 3 && e.name.length <= 8
      );
      if (candidates.length >= 3) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let usedKeys = new Set();
  let usedEntries = [];

  function resetSession() {
    usedKeys = new Set();
    usedEntries = [];
  }

  function normalize(rawInput) {
    return rawInput.trim().replace(/\s+/g, ' ');
  }

  // extraBlockedKeys: optional Set of dedupe keys to reject without permanently
  // marking them used (e.g. the current Name Chain seed name itself).
  // Returns { ok: true, record } or { ok: false, reason: 'not-found' | 'used' }.
  function tryAccept(rawInput, requiredFirstLetter, extraBlockedKeys) {
    const trimmed = normalize(rawInput);
    if (!trimmed) return { ok: false, reason: 'not-found' };
    const lower = trimmed.toLowerCase();
    const entry = activeNamesByLower.get(lower);
    if (!entry) return { ok: false, reason: 'not-found' };
    if (
      requiredFirstLetter &&
      entry.name[0].toUpperCase() !== requiredFirstLetter.toUpperCase()
    ) {
      return { ok: false, reason: 'not-found' };
    }
    const key = dedupeKey(lower);
    if (usedKeys.has(key)) return { ok: false, reason: 'used' };
    if (extraBlockedKeys && extraBlockedKeys.has(key)) return { ok: false, reason: 'used' };

    const score = computeScore(entry.name, entry.rank);
    usedKeys.add(key);
    const record = {
      name: entry.name,
      rank: entry.rank,
      score,
      tier: getMultiplier(entry.rank),
    };
    usedEntries.push(record);
    return { ok: true, record };
  }

  function getSidebarSorted() {
    return [...usedEntries].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Entries starting with `letter` (under the active gender filter) that
  // could still be accepted right now: the letter's pool minus names already
  // used this round and minus any extraBlockedKeys (e.g. a Name Chain seed
  // blocking itself as an answer).
  function getAvailableEntries(letter, extraBlockedKeys) {
    const pool = activeLettersPool[letter] || [];
    const available = [];
    for (const entry of pool) {
      const key = dedupeKey(entry.name.toLowerCase());
      if (usedKeys.has(key)) continue;
      if (extraBlockedKeys && extraBlockedKeys.has(key)) continue;
      available.push(entry);
    }
    return available;
  }

  function remainingCount(letter, extraBlockedKeys) {
    return getAvailableEntries(letter, extraBlockedKeys).length;
  }

  // Up to `count` random still-available entries for `letter` -- used to
  // suggest names the player could have tried when a round ends.
  function sampleRemaining(letter, extraBlockedKeys, count) {
    const pool = getAvailableEntries(letter, extraBlockedKeys);
    const picked = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function scoreTotal() {
    return usedEntries.reduce((sum, e) => sum + e.score, 0);
  }

  return {
    tierClass,
    computeScore,
    getMultiplier,
    randomLetter,
    pickSeedName,
    setGenderFilter,
    resetSession,
    tryAccept,
    getSidebarSorted,
    remainingCount,
    sampleRemaining,
    dedupeKey,
    scoreTotal,
    get usedEntries() {
      return usedEntries;
    },
  };
})();
