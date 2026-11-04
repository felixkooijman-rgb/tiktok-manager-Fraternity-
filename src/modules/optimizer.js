'use strict';
// STAP 9 – learn format and slot weights from results (shrunk towards 1.0 while data is thin, so
// one viral post does not take over the calendar and every format keeps a chance).
const { summarize } = require('./analytics');
const { FORMATS } = require('./formats');

function score(s) { return Math.log10(1 + s.avgViews) * (1 + 10 * s.avgEngagement); }

function optimize(ctx) {
  const { store, config } = ctx;
  const sum = summarize(store, config);
  const shrink = (groups, keys) => {
    const vals = Object.values(groups); if (!vals.length) return {};
    const mean = vals.reduce((a, s) => a + score(s), 0) / vals.length || 1;
    const out = {};
    for (const k of keys) {
      const s = groups[k];
      if (!s) { out[k] = 1; continue; }
      const k0 = 3; // prior strength in posts
      const rel = score(s) / mean;
      out[k] = +(((s.posts * rel) + k0) / (s.posts + k0)).toFixed(3);
    }
    return out;
  };
  const formatWeights = shrink(sum.byFormat, Object.keys(FORMATS));
  const slotWeights = shrink(sum.bySlot, config.schedule.candidateSlots);
  if (Object.keys(formatWeights).length) store.meta('formatWeights', formatWeights);
  if (Object.keys(slotWeights).length) store.meta('slotWeights', slotWeights);
  return { formatWeights, slotWeights, basedOn: sum.posts };
}
module.exports = { optimize };
