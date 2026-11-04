'use strict';
// STAP 7 (publish) – push due posts to TikTok via the official API, else export for manual posting.
const path = require('path');
const registry = require('../core/registry');

function mediaHost(ctx) {
  const pref = ctx.config.providers.hosting;
  for (const name of pref === 'auto' ? ['command', 'local'] : [pref]) { const h = registry.create('hosting', name, ctx); if (h) return h; }
  return null;
}

async function publishPost(ctx, post) {
  const { config, store, log } = ctx;
  const tiktok = registry.create('publish', 'tiktok', ctx);
  const host = mediaHost(ctx);
  const canAuto = config.publishing.provider === 'tiktok' && tiktok.ready && host && post.publishSettings?.privacyLevel;
  if (canAuto) {
    try {
      const urls = await host.upload(post, path.join(config.paths.posts, post.id));
      const r = await tiktok.publish(post, { imageUrls: urls });
      log.info(`TikTok ${r.mode}: ${post.id} → publish_id ${r.publishId}`);
      return store.update('posts', post.id, { status: 'publishing', publish: { ...r, imageUrls: urls, at: new Date().toISOString() } });
    } catch (e) {
      log.warn(`TikTok publish ${post.id}: ${e.message} → fallback manual export`);
      store.update('posts', post.id, { publishError: e.message });
    }
  }
  const why = !tiktok.ready ? 'TikTok-app niet geconfigureerd' : !host ? 'geen publieke media-host (PUBLIC_MEDIA_BASE_URL)' : !post.publishSettings?.privacyLevel ? 'geen zichtbaarheid gekozen' : 'API-fout';
  const r = await registry.create('publish', 'manual-export', ctx).publish(post);
  log.info(`manual export ${post.id} (${why}) → ${r.exportDir}`);
  return store.update('posts', post.id, { status: 'export-ready', publish: { ...r, reason: why, at: new Date().toISOString() } });
}

async function publishDue(ctx, now = new Date()) {
  const due = ctx.store.all('posts', (p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) <= now);
  for (const p of due) await publishPost(ctx, p);
  // Follow up on posts TikTok is still processing.
  const tiktok = registry.create('publish', 'tiktok', ctx);
  for (const p of ctx.store.all('posts', (x) => x.status === 'publishing' && x.publish?.publishId)) {
    try {
      const s = await tiktok.status(p.publish.publishId);
      if (s.status === 'PUBLISH_COMPLETE') ctx.store.update('posts', p.id, { status: 'published', publishedAt: new Date().toISOString(), tiktokIds: s.postIds });
      else if (s.status === 'SEND_TO_USER_INBOX') ctx.store.update('posts', p.id, { status: 'in-tiktok-inbox' });
      else if (s.status === 'FAILED') ctx.store.update('posts', p.id, { status: 'publish-failed', publishError: s.failReason });
    } catch (e) { ctx.log.warn(`status ${p.id}: ${e.message}`); }
  }
  return due.length;
}
module.exports = { publishDue, publishPost };
