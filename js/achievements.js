// Lifetime achievement badges, persisted in localStorage.
//
// recordRound(context) is called once at the end of every round. `context`
// describes that round (mode, timer, ending reason, score, the accepted
// name entries, elapsed seconds, and the player's name); lifetime stats
// (unique names ever accepted, cumulative 4x-rarity finds) are updated from
// it first, then every badge the current player hasn't yet earned is tested
// against the round + updated stats. A badge can be earned independently by
// multiple named players on the same device -- each earner's name and the
// date they first earned it are recorded and kept.
const Achievements = (() => {
  const STATS_KEY = 'nameGameLifetimeStats';
  const UNLOCKED_KEY = 'nameGameUnlockedBadges';

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        uniqueNames: new Set(parsed && parsed.uniqueNames ? parsed.uniqueNames : []),
        tier4Count: parsed && parsed.tier4Count ? parsed.tier4Count : 0,
      };
    } catch (e) {
      return { uniqueNames: new Set(), tier4Count: 0 };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(
        STATS_KEY,
        JSON.stringify({ uniqueNames: [...stats.uniqueNames], tier4Count: stats.tier4Count })
      );
    } catch (e) {
      // localStorage unavailable -- lifetime stats just won't persist
    }
  }

  // unlocked: { badgeId: [{ name, date }, ...] }, sorted earliest-first.
  function loadUnlocked() {
    try {
      const raw = localStorage.getItem(UNLOCKED_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      // Migrate the old { badgeId: timestamp } shape from earlier versions.
      const migrated = {};
      Object.keys(parsed).forEach((id) => {
        const val = parsed[id];
        if (Array.isArray(val)) {
          migrated[id] = val;
        } else if (typeof val === 'number') {
          migrated[id] = [{ name: 'Anonymous', date: val }];
        }
      });
      return migrated;
    } catch (e) {
      return {};
    }
  }

  function saveUnlocked(unlocked) {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    } catch (e) {
      // ignore
    }
  }

  const isBlitzTimed = (r) => r.mode === 'blitz' && r.timer === '60';
  const isBlitzCounted = (r) => r.mode === 'blitz' && (r.timer === '60' || r.timer === 'untimed');
  const isChainAZ = (r) => r.mode === 'chain' && r.reason === 'reachedZ';

  const BADGES = [
    // ---- Score milestones (single game, any mode) ----
    { id: 'score_500', category: 'Score Milestones', icon: '🏆', title: 'On the Board',
      desc: 'Earn 500 points in a single game', test: (r) => r.score >= 500 },
    { id: 'score_1000', category: 'Score Milestones', icon: '🏆', title: 'Four Figures',
      desc: 'Earn 1,000 points in a single game', test: (r) => r.score >= 1000 },
    { id: 'score_2000', category: 'Score Milestones', icon: '🏆', title: 'High Roller',
      desc: 'Earn 2,000 points in a single game', test: (r) => r.score >= 2000 },
    { id: 'score_5000', category: 'Score Milestones', icon: '🏆', title: 'Legendary Score',
      desc: 'Earn 5,000 points in a single game', test: (r) => r.score >= 5000 },

    // ---- Lifetime unique names ----
    { id: 'unique_100', category: 'Lifetime Names', icon: '📖', title: 'Getting Started',
      desc: 'Play 100 unique names', test: (r, life) => life.uniqueNames.size >= 100,
      progress: (life) => ({ current: life.uniqueNames.size, target: 100 }) },
    { id: 'unique_500', category: 'Lifetime Names', icon: '📖', title: 'Familiar Face',
      desc: 'Play 500 unique names', test: (r, life) => life.uniqueNames.size >= 500,
      progress: (life) => ({ current: life.uniqueNames.size, target: 500 }) },
    { id: 'unique_1000', category: 'Lifetime Names', icon: '📖', title: 'Name Collector',
      desc: 'Play 1,000 unique names', test: (r, life) => life.uniqueNames.size >= 1000,
      progress: (life) => ({ current: life.uniqueNames.size, target: 1000 }) },
    { id: 'unique_5000', category: 'Lifetime Names', icon: '📖', title: 'Walking Dictionary',
      desc: 'Play 5,000 unique names', test: (r, life) => life.uniqueNames.size >= 5000,
      progress: (life) => ({ current: life.uniqueNames.size, target: 5000 }) },
    { id: 'unique_10000', category: 'Lifetime Names', icon: '📖', title: 'Onomastics Master',
      desc: 'Play 10,000 unique names', test: (r, life) => life.uniqueNames.size >= 10000,
      progress: (life) => ({ current: life.uniqueNames.size, target: 10000 }) },

    // ---- Lifetime rare (4x) finds ----
    { id: 'tier4_20', category: 'Rare Finds', icon: '💎', title: 'Rare Sighting',
      desc: 'Play 20 4x-rarity names', test: (r, life) => life.tier4Count >= 20,
      progress: (life) => ({ current: life.tier4Count, target: 20 }) },
    { id: 'tier4_50', category: 'Rare Finds', icon: '💎', title: 'Rarity Hunter',
      desc: 'Play 50 4x-rarity names', test: (r, life) => life.tier4Count >= 50,
      progress: (life) => ({ current: life.tier4Count, target: 50 }) },
    { id: 'tier4_100', category: 'Rare Finds', icon: '💎', title: 'Rarity Expert',
      desc: 'Play 100 4x-rarity names', test: (r, life) => life.tier4Count >= 100,
      progress: (life) => ({ current: life.tier4Count, target: 100 }) },
    { id: 'tier4_250', category: 'Rare Finds', icon: '💎', title: 'Rarity Connoisseur',
      desc: 'Play 250 4x-rarity names', test: (r, life) => life.tier4Count >= 250,
      progress: (life) => ({ current: life.tier4Count, target: 250 }) },
    { id: 'tier4_500', category: 'Rare Finds', icon: '💎', title: 'Rarity Legend',
      desc: 'Play 500 4x-rarity names', test: (r, life) => life.tier4Count >= 500,
      progress: (life) => ({ current: life.tier4Count, target: 500 }) },

    // ---- Name Chain mastery ----
    { id: 'chain_az', category: 'Name Chain Mastery', icon: '🔗', title: 'A to Z',
      desc: 'Complete Name Chain all the way from A to Z', test: isChainAZ },
    { id: 'chain_az_no1x', category: 'Name Chain Mastery', icon: '🔗', title: 'No Gimmes',
      desc: 'Complete A to Z using no 1x-rarity names',
      test: (r) => isChainAZ(r) && r.roundEntries.every((e) => e.tier !== 1) },
    { id: 'chain_az_20min', category: 'Name Chain Mastery', icon: '🔗', title: 'Steady Pace',
      desc: 'Complete A to Z in under 20 minutes', test: (r) => isChainAZ(r) && r.durationSeconds <= 20 * 60 },
    { id: 'chain_az_15min', category: 'Name Chain Mastery', icon: '🔗', title: 'Quick Study',
      desc: 'Complete A to Z in under 15 minutes', test: (r) => isChainAZ(r) && r.durationSeconds <= 15 * 60 },
    { id: 'chain_az_10min', category: 'Name Chain Mastery', icon: '🔗', title: 'Speed Demon',
      desc: 'Complete A to Z in under 10 minutes', test: (r) => isChainAZ(r) && r.durationSeconds <= 10 * 60 },
    { id: 'chain_az_instant_death', category: 'Name Chain Mastery', icon: '🔗', title: 'Nerves of Steel',
      desc: 'Reach Z in Instant Death mode', test: (r) => isChainAZ(r) && r.timer === 'instant-death' },

    // ---- Alphabet Blitz mastery ----
    { id: 'blitz_250', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'Quick Start',
      desc: 'Earn 250 points in a timed round of Alphabet Blitz', test: (r) => isBlitzTimed(r) && r.score >= 250 },
    { id: 'blitz_500', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'Warming Up',
      desc: 'Earn 500 points in a timed round of Alphabet Blitz', test: (r) => isBlitzTimed(r) && r.score >= 500 },
    { id: 'blitz_750', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'On a Roll',
      desc: 'Earn 750 points in a timed round of Alphabet Blitz', test: (r) => isBlitzTimed(r) && r.score >= 750 },
    { id: 'blitz_1000', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'Blitz Master',
      desc: 'Earn 1,000 points in a timed round of Alphabet Blitz', test: (r) => isBlitzTimed(r) && r.score >= 1000 },
    { id: 'blitz_1500', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'Blitz Legend',
      desc: 'Earn 1,500 points in a timed round of Alphabet Blitz', test: (r) => isBlitzTimed(r) && r.score >= 1500 },
    { id: 'blitz_1x_only_100', category: 'Alphabet Blitz Mastery', icon: '⚡', title: 'Purist',
      desc: 'Earn 100 points in Alphabet Blitz using only 1x-rarity names',
      test: (r) => r.mode === 'blitz' && r.score >= 100 && r.roundEntries.length > 0 && r.roundEntries.every((e) => e.tier === 1) },
    { id: 'blitz_names_10', category: 'Alphabet Blitz Mastery', icon: '🎯', title: 'Quickfire',
      desc: 'Play 10 names in a single round of Alphabet Blitz', test: (r) => isBlitzCounted(r) && r.roundEntries.length >= 10 },
    { id: 'blitz_names_25', category: 'Alphabet Blitz Mastery', icon: '🎯', title: 'Name Machine',
      desc: 'Play 25 names in a single round of Alphabet Blitz', test: (r) => isBlitzCounted(r) && r.roundEntries.length >= 25 },
    { id: 'blitz_names_50', category: 'Alphabet Blitz Mastery', icon: '🎯', title: 'Human Almanac',
      desc: 'Play 50 names in a single round of Alphabet Blitz', test: (r) => isBlitzCounted(r) && r.roundEntries.length >= 50 },
  ];

  // Updates lifetime stats from this round's accepted entries, then tests
  // every badge the current player doesn't already have. Returns
  // { stats, unlocked, newlyUnlocked }.
  function recordRound(roundContext) {
    const stats = loadStats();
    roundContext.roundEntries.forEach((e) => {
      stats.uniqueNames.add(e.name.toLowerCase());
      if (e.tier === 4) stats.tier4Count++;
    });
    saveStats(stats);

    const playerName = roundContext.playerName || 'Anonymous';
    const unlocked = loadUnlocked();
    const newlyUnlocked = [];
    let changed = false;
    BADGES.forEach((badge) => {
      const earners = unlocked[badge.id] || [];
      if (earners.some((e) => e.name === playerName)) return;
      let earned = false;
      try {
        earned = !!badge.test(roundContext, stats);
      } catch (e) {
        earned = false;
      }
      if (earned) {
        earners.push({ name: playerName, date: Date.now() });
        earners.sort((a, b) => a.date - b.date);
        unlocked[badge.id] = earners;
        newlyUnlocked.push(badge);
        changed = true;
      }
    });
    if (changed) saveUnlocked(unlocked);

    return { stats, unlocked, newlyUnlocked };
  }

  function getProgress() {
    return { stats: loadStats(), unlocked: loadUnlocked() };
  }

  return { BADGES, recordRound, getProgress };
})();
