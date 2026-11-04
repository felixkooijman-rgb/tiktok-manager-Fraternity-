'use strict';
// STAP 8 – metrics snapshots for published posts + follower count; per-format and per-slot stats.
const registry = require('../core/registry');
const { zonedParts } = require('../core/util');

async function collectMetrics(ctx) {
  const { store, log, config } = ctx;
  const a = registry.create('analytics', config.providers.analytics, ctx);
  try {
    const u = await a.user();
    store.insert('followers', { at: new Date().toISOString(), followers: u.follower_count, likes: u.likes_count, videos: u.video_count });
  } catch (e) { log.warn(`followers: ${e.message}`); if (e.code === 'not_connected') return 0; }
  const posts = store.all('posts', (p) => p.tiktokIds?.length);
  const ids = posts.flatMap((p) => p.tiktokIds.map(String));
  if (!ids.length) return 0;
  const vids = await a.queryVideos(ids);
  for (const v of vids) {
    const p = posts.find((x) => x.tiktokIds.map(String).includes(String(v.id)));
    const m = { views: v.view_count || 0, likes: v.like_count || 0, comments: v.comment_count || 0, shares: v.share_count || 0, favorites: p.metrics?.favorites ?? null, shareUrl: v.share_url };
    m.engagement = m.views ? +((m.likes + m.comments + m.shares) / m.views).toFixed(4) : 0;
    store.insert('metrics', { postId: p.id, videoId: String(v.id), at: new Date().toISOString(), ...m });
    store.update('posts', p.id, { metrics: m, shareUrl: v.share_url });
  }
  return vids.length;
}

function latestMetrics(store) { return store.all('posts', (p) => p.metrics && p.status === 'published'); }

function summarize(store, cfg) {
  const posts = latestMetrics(store);
  const by = (keyFn) => {
    const g = {};
    for (const p of posts) { const k = keyFn(p); (g[k] = g[k] || []).push(p); }
    return Object.fromEntries(Object.entries(g).map(([k, ps]) => [k, {
      posts: ps.length,
      avgViews: Math.round(ps.reduce((s, p) => s + p.metrics.views, 0) / ps.length),
      avgEngagement: +(ps.reduce((s, p) => s + p.metrics.engagement, 0) / ps.length).toFixed(4),
      totals: ['views', 'likes', 'comments', 'shares'].reduce((o, k2) => ({ ...o, [k2]: ps.reduce((s, p) => s + p.metrics[k2], 0) }), {}),
    }]));
  };
  const slotOf = (p) => { const z = zonedParts(new Date(p.publishedAt || p.scheduledAt), cfg.schedule.timezone); return `${String(z.hh).padStart(2, '0')}:${String(z.mm).padStart(2, '0')}`; };
  const f = store.all('followers');
  return { byFormat: by((p) => p.format), bySlot: by(slotOf), followers: f.slice(-60), followerGain: f.length > 1 ? f[f.length - 1].followers - f[0].followers : null, posts: posts.length };
}
module.exports = { collectMetrics, summarize };
