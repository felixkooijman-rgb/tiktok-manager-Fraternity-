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
  const fs = require('fs');
  const { localYmd } = require('../core/util');
  const browser = await chromium.launch();
  try {
    // Posts whose slide files are gone (made in an earlier, recycled cloud session): re-render
    // them when they are still due today or later, expire them when their day has passed.
    const today = localYmd(new Date(), config.schedule.timezone);
    for (const p of store.all('posts', (x) => ['scheduled', 'ready', 'pending-approval', 'export-ready'].includes(x.status))) {
      if ((p.slides || []).every((sl) => fs.existsSync(sl.path))) continue;
      if (p.scheduledAt && localYmd(new Date(p.scheduledAt), config.schedule.timezone) >= today) {
        try { await require('../modules/post-builder').rebuildSlides(ctx, p, { browser }); log.info(`slides opnieuw gemaakt: ${p.id}`); }
        catch (e) { log.warn(`rebuild ${p.id}: ${e.message}`); store.update('posts', p.id, { status: 'expired' }); }
      } else store.update('posts', p.id, { status: 'expired' });
    }
    // 8 + 9 first: learn from yesterday before deciding today.
    step(8, 'Prestaties van gepubliceerde posts ophalen');
    try { const n = await collectMetrics(ctx); run.steps.at(-1).metrics = n; } catch (e) { log.warn(`metrics: ${e.message}`); }
    step(9, 'Optimaliseren (format- en tijdslotgewichten)');
    run.steps.at(-1).weights = optimize(ctx);

    step(1, 'Trends en onderwerpen analyseren');
    const signals = await runResearch(ctx, opts);
    step(2, 'Contentideeën bedenken');
    const ideas = await generateIdeas(ctx, signals);
    // --count n = aim for n posts today in total (posts already planned for today count).
    const planned = store.all('posts', (p) => p.scheduledAt && ['scheduled', 'ready', 'pending-approval', 'export-ready'].includes(p.status) && localYmd(new Date(p.scheduledAt), config.schedule.timezone) === today).length;
    const n = opts.count ? Math.max(0, opts.count - planned) : capacity(store, config);
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
