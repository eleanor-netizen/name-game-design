// Core game engine: name validation, scoring, dedupe, and letter/seed helpers.
// Depends on NAMES_DATA and VARIANTS_DATA (loaded via <script> before this file).
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

  function dedupeKey(lower) {
    return VARIANTS_DATA[lower] || lower;
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

  function randomLetter() {
    return String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }

  // Choose a seed name for Name Chain: prefer well-known, moderate-length names,
  // widening the rank cutoff for sparse letters (Q, U, X, ...) until enough options exist.
  function pickSeedName(letter) {
    const cutoffs = [1500, 3000, 6000, Infinity];
    for (const cutoff of cutoffs) {
      const candidates = lettersPool[letter].filter(
        (e) => e.rank <= cutoff && e.name.length >= 3 && e.name.length <= 8
      );
      if (candidates.length >= 3) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    const all = lettersPool[letter];
    return all[Math.floor(Math.random() * all.length)];
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
  function tryAccept(rawInput, requiredFirstLetter, extraBlockedKeys) {
    const trimmed = normalize(rawInput);
    if (!trimmed) return { ok: false };
    const lower = trimmed.toLowerCase();
    const entry = namesByLower.get(lower);
    if (!entry) return { ok: false };
    if (
      requiredFirstLetter &&
      entry.name[0].toUpperCase() !== requiredFirstLetter.toUpperCase()
    ) {
      return { ok: false };
    }
    const key = dedupeKey(lower);
    if (usedKeys.has(key)) return { ok: false };
    if (extraBlockedKeys && extraBlockedKeys.has(key)) return { ok: false };

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

  function sessionScoreTotal() {
    return usedEntries.reduce((sum, e) => sum + e.score, 0);
  }

  return {
    tierClass,
    computeScore,
    getMultiplier,
    randomLetter,
    pickSeedName,
    resetSession,
    tryAccept,
    getSidebarSorted,
    dedupeKey,
    sessionScoreTotal,
    get usedEntries() {
      return usedEntries;
    },
  };
})();
