'use strict';
// STAP 7 (planning) – content calendar: 1–2 posts/day on the best-performing slots, with
// exploration of other candidate times so the agent keeps learning when the audience is active.
const { zonedToUtc, localYmd, addDays } = require('../core/util');

function slotWeights(store, cfg) {
  const w = store.meta('slotWeights') || {};
  return cfg.schedule.candidateSlots.map((s) => ({ slot: s, w: w[s] ?? (cfg.schedule.defaultSlots.includes(s) ? 1 : 0.6) }));
}

function occupied(store) {
  return store.all('posts', (p) => p.scheduledAt && !['rejected', 'deleted', 'qa-failed'].includes(p.status)).map((p) => p.scheduledAt);
}

// Choose a slot for a post: fixed date (anniversary) or the first day with free capacity.
function planSlot(store, cfg, { onDate, rnd = Math.random, now = new Date() } = {}) {
  const tz = cfg.schedule.timezone;
  const taken = occupied(store);
  const perDay = (ymd) => taken.filter((t) => localYmd(new Date(t), tz) === ymd).length;
  const today = localYmd(now, tz);
  const days = onDate ? [onDate] : Array.from({ length: cfg.schedule.planAheadDays + 1 }, (_, i) => addDays(today, i));
  const ranked = slotWeights(store, cfg).sort((a, b) => b.w - a.w);
  for (const day of days) {
    if (perDay(day) >= cfg.schedule.postsPerDay.max && !onDate) continue;
    let order = ranked.map((r) => r.slot);
    if (rnd() < cfg.schedule.explorationRate) order = [order[Math.floor(rnd() * order.length)], ...order];
    for (const slot of order) {
      const at = zonedToUtc(day, slot, tz);
      if (at.getTime() < now.getTime() + 20 * 60e3) continue;
      const clash = taken.some((t) => Math.abs(new Date(t) - at) < 3 * 3600e3);
      if (!clash) return at.toISOString();
    }
  }
  return null;
}

// How many posts to create today: fill each of the next days up to postsPerDay.min, max on good days.
function capacity(store, cfg, now = new Date()) {
  const tz = cfg.schedule.timezone;
  const taken = occupied(store).filter((t) => new Date(t) > now);
  let need = 0;
  for (let i = 0; i <= cfg.schedule.planAheadDays; i++) {
    const day = addDays(localYmd(now, tz), i);
    const n = taken.filter((t) => localYmd(new Date(t), tz) === day).length;
    need += Math.max(0, cfg.schedule.postsPerDay.min - n);
  }
  return Math.min(cfg.ideation.postsToCreatePerDay, Math.max(need, 1));
}

module.exports = { planSlot, capacity, slotWeights };
