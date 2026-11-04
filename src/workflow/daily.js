'use strict';
// The autonomous daily loop (STAP 1–9). Every step is a separate module so steps can be swapped,
// skipped or run alone from the CLI.
const { chromium } = require('playwright');
const { runResearch } = require('../modules/research');
const { generateIdeas, selectIdeas } = require('../modules/ideation');
const { buildPost } = require('../modules/post-builder');
const { planSlot, capacity } = require('../modules/scheduler');
const { publishDue } = require('../modules/publisher');
const { collectMetrics } = require('../modules/analytics');
const { optimize } = require('../modules/optimizer');

async function runDaily(ctx, opts = {}) {
  const { store, log, config } = ctx;
  const run = store.insert('runs', { kind: 'daily', startedAt: new Date().toISOString(), steps: [] });
  const step = (n, t, info) => { log.step(n, t); run.steps.push({ n, t, at: new Date().toISOString(), ...(info || {}) }); };
  // Posts whose slide files are gone (e.g. made in an earlier, already recycled cloud session)
  // can no longer be posted: mark them expired so they do not block today's calendar.
  const fs = require('fs');
  for (const p of store.all('posts', (x) => ['scheduled', 'ready', 'pending-approval', 'export-ready'].includes(x.status))) {
    if (!(p.slides || []).every((sl) => fs.existsSync(sl.path))) store.update('posts', p.id, { status: 'expired' });
  }
  const browser = await chromium.launch();
  try {
    // 8 + 9 first: learn from yesterday before deciding today.
    step(8, 'Prestaties van gepubliceerde posts ophalen');
    try { const n = await collectMetrics(ctx); run.steps.at(-1).metrics = n; } catch (e) { log.warn(`metrics: ${e.message}`); }
    step(9, 'Optimaliseren (format- en tijdslotgewichten)');
    run.steps.at(-1).weights = optimize(ctx);

    step(1, 'Trends en onderwerpen analyseren');
    const signals = await runResearch(ctx, opts);
    step(2, 'Contentideeën bedenken');
    const ideas = await generateIdeas(ctx, signals);
    const n = opts.count || capacity(store, config);
    step(3, `Beste ${n} ideeën selecteren uit ${ideas.length}`);
    const chosen = new Set(selectIdeas(ideas, n, config));
    const saved = ideas.map((i) => store.insert('ideas', { ...i, status: chosen.has(i) ? 'selected' : (i.format === 'poster-request' ? 'backlog' : 'candidate'), runId: run.id }));
    // keep the idea list manageable: drop old unselected candidates
    store.db.ideas = store.db.ideas.filter((i) => i.status !== 'candidate' || i.runId === run.id || Date.now() - new Date(i.createdAt) < 14 * 864e5); store.save();
    log.info(saved.map((i) => `  ${i.status === 'selected' ? '★' : ' '} [${i.score}] ${i.label} – ${i.why}`).join('\n'));

    step('4-6', 'Afbeeldingen verzamelen, posts samenstellen en controleren');
    const built = [];
    for (const idea of saved.filter((i) => i.status === 'selected')) {
      try {
        const post = await buildPost(ctx, idea, { browser });
        store.update('ideas', idea.id, { status: 'used', postId: post.id });
        built.push(post);
        log.info(`  post ${post.id}: ${post.status}${post.qa.errors.length ? ' – ' + post.qa.errors.join('; ') : ''}`);
      } catch (e) { log.error(`build ${idea.label}: ${e.message}`); store.update('ideas', idea.id, { status: 'failed', error: e.message }); }
    }
    step(7, 'Inplannen en publiceren');
    for (const p of built) {
      const at = planSlot(store, config, { onDate: p.signal?.kind === 'anniversary' ? p.signal.date : undefined });
      store.update('posts', p.id, { scheduledAt: at, status: p.status === 'ready' ? 'scheduled' : p.status });
      log.info(`  ${p.id} → ${at || 'geen slot vrij'} (${store.get('posts', p.id).status})`);
    }
    const published = await publishDue(ctx);
    run.steps.at(-1).published = published;
    store.update('runs', run.id, { finishedAt: new Date().toISOString(), built: built.map((p) => p.id), ok: true });
    return { built, ideas: saved };
  } catch (e) {
    store.update('runs', run.id, { finishedAt: new Date().toISOString(), ok: false, error: e.message });
    throw e;
  } finally { await browser.close(); }
}
module.exports = { runDaily };
