// Persistent high-score leaderboard, backed by localStorage.
// Each entry: { id, timestamp, playerName, mode: 'blitz'|'chain',
//   timer: 'untimed'|'60'|'90', nameSet: 'all'|'male'|'female', score, namesCount,
//   startLetter (blitz only), lettersThru (chain only, display string),
//   lettersThruIndex (chain only, numeric for sorting) }
const Leaderboard = (() => {
  const STORAGE_KEY = 'nameGameLeaderboard';
  const NAME_KEY = 'nameGamePlayerName';

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // localStorage unavailable (private browsing, quota, etc.) -- play continues without persistence
    }
  }

  // Returns the saved entry (including its generated id), not the full list,
  // so callers can track "this is the row I just added" (e.g. to highlight
  // it on the leaderboard right after a round ends).
  function addEntry(entry) {
    const entries = loadAll();
    const saved = Object.assign(
      { id: Date.now() + '-' + Math.random().toString(36).slice(2), timestamp: Date.now() },
      entry
    );
    entries.push(saved);
    saveAll(entries);
    return saved;
  }

  // Filtered by mode + timer (both required) and optionally by nameSet
  // ('any' or omitted returns entries regardless of which name set they were played under).
  function getFiltered(mode, timer, nameSetFilter) {
    return loadAll().filter((e) => {
      if (e.mode !== mode) return false;
      if (e.timer !== timer) return false;
      if (nameSetFilter && nameSetFilter !== 'any' && e.nameSet !== nameSetFilter) return false;
      return true;
    });
  }

  // True leaderboard rank is always by score (desc), independent of how the
  // table is currently being viewed/sorted.
  function withRanks(entries) {
    const byScore = [...entries].sort((a, b) => b.score - a.score);
    const rankById = new Map();
    byScore.forEach((e, i) => rankById.set(e.id, i + 1));
    return entries.map((e) => Object.assign({}, e, { rank: rankById.get(e.id) }));
  }

  function sortEntries(entries, key, dir) {
    const sorted = [...entries].sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv || '').toLowerCase();
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    if (dir === 'desc') sorted.reverse();
    return sorted;
  }

  function getPlayerName() {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setPlayerName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (e) {
      // ignore
    }
  }

  return { addEntry, getFiltered, withRanks, sortEntries, getPlayerName, setPlayerName };
})();
