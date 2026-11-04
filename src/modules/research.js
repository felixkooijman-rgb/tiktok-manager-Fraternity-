'use strict';
// STAP 1 – collect signals from every enabled research provider and store them.
const registry = require('../core/registry');

async function runResearch(ctx, { today } = {}) {
  const { config, store, log } = ctx;
  const signals = [];
  for (const name of config.providers.research) {
    try {
      const p = registry.create('research', name, ctx);
      const got = await p.collect({ today });
      log.info(`research ${name}: ${got.length} signalen`);
      signals.push(...got);
    } catch (e) { log.warn(`research ${name} failed: ${e.message}`); }
  }
  const seen = new Set(store.all('research').map((r) => r.key));
  const fresh = signals.filter((s) => !seen.has(s.key) && s.kind !== 'catalog-item');
  for (const s of fresh) store.db.research.push({ id: `sig_${Buffer.from(s.key).toString('base64url').slice(0, 24)}`, collectedAt: new Date().toISOString(), ...s });
  store.db.research = store.db.research.slice(-1500);
  store.save();
  return signals;
}
module.exports = { runResearch };
