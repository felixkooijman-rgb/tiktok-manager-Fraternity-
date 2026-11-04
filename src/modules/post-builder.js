'use strict';
// STAP 4 + 5 – gather images (own posters first; licensed stock/AI only as supporting visuals)
// and render the full carousel + caption into data/posts/<id>/.
const path = require('path');
const fs = require('fs');
const registry = require('../core/registry');
const { FORMATS } = require('./formats');
const { renderSlides } = require('../compose/slides');
const { buildCaption } = require('./captions');
const { runQa } = require('./qa');
const { loadCatalog } = require('../providers/research/fraternity-catalog');

async function buildPost(ctx, idea, { browser }) {
  const { config, store } = ctx;
  const catalog = Object.fromEntries(loadCatalog(config).map((m) => [m.slug, m]));
  const entries = idea.slugs.map((s) => catalog[s]).filter(Boolean);
  if (entries.length !== idea.slugs.length) throw new Error(`onbekende wedstrijd in idee: ${idea.slugs.join(', ')}`);
  const f = FORMATS[idea.format];
  const posterProvider = registry.create('images', 'fraternity-poster', ctx);
  const assets = [];
  const posterFor = async (m, variant) => {
    const a = await posterProvider.forMatch(m, variant);
    if (!assets.some((x) => x.path === a.path)) assets.push(a);
    return a.path;
  };
  const sctx = { config, poster: posterFor };
  const specs = await f.slides(f.group ? entries : entries[0], sctx, idea.signal);

  const post = store.insert('posts', { status: 'building', format: idea.format, formatLabel: f.label, ideaId: idea.id, slugs: idea.slugs, signal: idea.signal || null, why: idea.why });
  const outDir = path.join(config.paths.posts, post.id);
  const slides = await renderSlides(specs, { outDir, theme: entries[0].theme, config, browser });
  const cap = await buildCaption(ctx, idea, entries);

  const sources = [];
  for (const m of entries) for (const s of m.sources) if (!sources.some((x) => x.url === s.url)) sources.push({ ...s, match: m.slug });
  if (idea.signal?.url) sources.push({ title: idea.signal.title, url: idea.signal.url, used_for: `aanleiding (${idea.signal.source})` });
  const credits = assets.map((a) => a.license?.attribution || `${a.source} – ${a.license?.type}`);

  Object.assign(post, {
    ...cap, slides, assets, sources, credits,
    openChecks: entries.flatMap((m) => m.needsManualCheck.map((c) => `${m.slug}: ${c}`)),
    aiGenerated: assets.some((a) => a.aiGenerated),
    shopLinks: (idea.signal?.kind === 'shop-product' && idea.signal.url) ? [idea.signal.url] : [],
    publishSettings: { privacyLevel: config.publishing.privacyLevel || null, allowComments: config.publishing.allowComments, brandOrganic: config.publishing.brandOrganic, brandedContent: false },
  });
  post.qa = runQa(post, ctx);
  post.status = !post.qa.ok ? 'qa-failed' : post.qa.needsApproval ? 'pending-approval' : 'ready';
  fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify(post, null, 2));
  store.update('posts', post.id, post);
  return post;
}
// Re-render the slides of an existing post (e.g. in a new cloud session where the files are gone).
// Caption, hashtags, schedule and user edits stay as they are.
async function rebuildSlides(ctx, post, { browser }) {
  const { config, store } = ctx;
  const catalog = Object.fromEntries(loadCatalog(config).map((m) => [m.slug, m]));
  const entries = post.slugs.map((s) => catalog[s]);
  if (entries.some((x) => !x)) throw new Error('wedstrijd niet meer in de catalogus');
  const f = FORMATS[post.format];
  const posterProvider = registry.create('images', 'fraternity-poster', ctx);
  const sctx = { config, poster: async (m, v) => (await posterProvider.forMatch(m, v)).path };
  const specs = await f.slides(f.group ? entries : entries[0], sctx, post.signal);
  const slides = await renderSlides(specs, { outDir: path.join(config.paths.posts, post.id), theme: entries[0].theme, config, browser });
  const updated = { ...post, slides };
  return store.update('posts', post.id, { slides, qa: runQa(updated, ctx) });
}
module.exports = { buildPost, rebuildSlides };
