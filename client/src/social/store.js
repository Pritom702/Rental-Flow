// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: my level / streak / badges, shared app-wide
// ============================================================
// A tiny store for "me" in the community: the XP ring in the top bar, the
// feed's side card and the reward layer all read the same numbers, and a
// reward from any action updates all of them at once.
import { useSyncExternalStore } from 'react';
import { api } from '../api.js';

let state = null;            // GET /api/community/me, or null when signed out
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function setMe(next) {
  state = typeof next === 'function' ? next(state) : next;
  emit();
}

let loading = null;
export function loadMe() {
  if (!loading) {
    loading = api.get('/community/me')
      .then((me) => setMe(me))
      .catch(() => {})
      .finally(() => { loading = null; });
  }
  return loading;
}

// Fold a reward from the server into the numbers already on screen.
export function applyReward(r) {
  if (!state || !r) return;
  if (r.limes) state = { ...state, limes: (state.limes ?? 0) + r.limes };
  if (!r.level) { emit(); return; }
  const unlocked = new Set((r.badges || []).map((b) => b.id));
  setMe({
    ...state,
    xp: r.total,
    level: r.level,
    streak: r.streak || state.streak,
    activeToday: true,
    badges: state.badges.map((b) => (unlocked.has(b.id) ? { ...b, unlocked: true } : b)),
  });
}

export function useMe() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state
  );
}
