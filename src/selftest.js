'use strict';
// Renders one post per format from the catalog (no research network calls, no publishing) and
// prints QA results. Use DATA_DIR=/tmp/x to keep it out of the real store.
const { chromium } = require('playwright');
const { FORMATS } = require('./modules/formats');
const { loadCatalog } = require('./providers/research/fraternity-catalog');
const { buildPost } = require('./modules/post-builder');

async function run(ctx) {
  const catalog = loadCatalog(ctx.config);
  if (!catalog.length) throw new Error(`geen matchbestanden gevonden in ${ctx.config.paths.fraternity}/matches`);
  const browser = await chromium.launch();
  let fails = 0;
  try {
    for (const [id, f] of Object.entries(FORMATS)) {
      let slugs;
      if (id === 'on-this-day') {
        const m = catalog.find((x) => x.hasPoster); const years = 2026 - +m.match.date.slice(0, 4);
        const idea = { format: id, slugs: [m.slug], signal: { kind: 'anniversary', years, date: `2026${m.match.date.slice(4)}`, slug: m.slug }, why: 'selftest' };
        fails += await one(ctx, idea, browser); continue;
      }
      const pool = catalog.filter((m) => f.eligible(m));
      slugs = (f.group ? pool.slice(0, f.group) : pool.slice(-1)).map((m) => m.slug);
      if (!slugs.length) { console.log(`${id}: geen geschikte wedstrijd`); continue; }
      fails += await one(ctx, { format: id, slugs, why: 'selftest' }, browser);
    }
  } finally { await browser.close(); }
  if (fails) { console.error(`${fails} format(s) met QA-fouten`); process.exitCode = 1; }
}
async function one(ctx, idea, browser) {
  const p = await buildPost(ctx, idea, { browser });
  console.log(`${p.qa.ok ? 'OK  ' : 'FAIL'} ${idea.format.padEnd(20)} ${p.slides.length} slides  ${p.status.padEnd(16)} ${p.title}`);
  if (!p.qa.ok) console.log('     ', p.qa.errors.join(' | '));
  return p.qa.ok ? 0 : 1;
}
module.exports = { run };
