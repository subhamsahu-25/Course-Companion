// frontend/src/utils/cache.js — tiny per-user browser cache for slow,
// rarely-changing reference data (courses, modules, documents).
//
// Rules:
// - Namespaced per user id: lab/shared computers must never leak one
//   student's catalog into another's session. Cleared on logout.
// - Stale-while-revalidate shape: readers render the cached snapshot
//   instantly (if fresh enough) and refetch in the background.
// - NEVER used for correctness-critical live data (TA queue, history,
//   stats) — those always hit the network.
// - Best-effort throughout: private-mode/quota failures degrade to
//   plain network fetches, never crashes.

const PREFIX = 'cc:v1:';
const UID_KEY = `${PREFIX}uid`;
// Reference data older than this is treated as absent (plain load).
const MAX_AGE_MS = 24 * 3600 * 1000;

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/private-mode — caching is optional, fetching is not.
  }
}

export function getStoredUid() {
  try {
    return localStorage.getItem(UID_KEY);
  } catch {
    return null;
  }
}

export function setStoredUid(uid) {
  try {
    if (uid) localStorage.setItem(UID_KEY, uid);
    else localStorage.removeItem(UID_KEY);
  } catch {
    // Non-fatal.
  }
}

function namespaced(uid, scope) {
  return `${PREFIX}${uid}:${scope}`;
}

export function cacheGet(uid, scope) {
  if (!uid) return null;
  const entry = readRaw(namespaced(uid, scope));
  if (!entry || typeof entry !== 'object') return null;
  if (!entry.savedAt || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry.data ?? null;
}

export function cacheSet(uid, scope, data) {
  if (!uid) return;
  writeRaw(namespaced(uid, scope), { savedAt: Date.now(), data });
}

export function cacheInvalidate(uid, scope) {
  if (!uid) return;
  try {
    localStorage.removeItem(namespaced(uid, scope));
  } catch {
    // Non-fatal.
  }
}

// Wipes every namespaced entry for a user — called on logout so nothing
// personal survives the session on shared machines.
export function clearUserCache(uid) {
  if (!uid) return;
  try {
    const prefix = `${PREFIX}${uid}:`;
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Non-fatal.
  }
}
