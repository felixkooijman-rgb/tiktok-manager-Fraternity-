'use strict';
// Dashboard + API + built-in scheduler. No framework: node:http.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { summarize } = require('../modules/analytics');
const { publishPost, publishDue } = require('../modules/publisher');
const { runQa } = require('../modules/qa');
const { zonedParts } = require('../core/util');

const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) { return new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } }); }); }
function safeJoin(base, rel) { const p = path.resolve(base, rel); if (!p.startsWith(path.resolve(base) + path.sep)) throw new Error('bad path'); return p; }

function state(ctx) {
  const { store, config } = ctx;
  const { readToken } = require('../auth/tiktok-oauth');
  const tok = readToken(config);
  let report = null; try { report = JSON.parse(fs.readFileSync(path.join(config.paths.data, 'account-report.json'), 'utf8')); } catch {}
  return {
    brand: config.brand, approvalMode: config.approval.mode, privacyLevel: config.publishing.privacyLevel, postMode: config.publishing.postMode,
    tiktok: { configured: !!config.env.TIKTOK_CLIENT_KEY, connected: !!tok, scopes: tok?.scope, mediaHost: !!config.env.PUBLIC_MEDIA_BASE_URL, refreshExpires: tok?.refresh_expires_at },
    llm: !!config.env.ANTHROPIC_API_KEY,
    posts: [...store.all('posts')].sort((a, b) => (b.scheduledAt || b.createdAt).localeCompare(a.scheduledAt || a.createdAt)),
    ideas: [...store.all('ideas', (i) => ['candidate', 'backlog', 'selected', 'failed'].includes(i.status))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 150),
    research: store.all('research').slice(-80).reverse(),
    runs: store.all('runs').slice(-15).reverse(),
    stats: summarize(store, config),
    weights: { formats: store.meta('formatWeights') || {}, slots: store.meta('slotWeights') || {} },
    accountReport: report,
  };
}

function start(ctx) {
  const { config, store, log } = ctx;
  const port = +(config.env.DASHBOARD_PORT || 4300);
  const pass = config.env.DASHBOARD_PASSWORD;
  let busy = false;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      // Public: slide media (TikTok must be able to pull them) and OAuth callback.
      if (p.startsWith('/media/')) {
        const [, , id, file] = p.split('/');
        const f = safeJoin(config.paths.posts, `${id}/${file}`);
        return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream') : send(res, 404, 'not found', 'text/plain');
      }
      if (p === '/auth/tiktok/callback') {
        const { exchangeCode } = require('../auth/tiktok-oauth');
        if (url.searchParams.get('state') !== store.reload().meta('oauthState')) return send(res, 400, 'Ongeldige state', 'text/plain');
        await exchangeCode(config, url.searchParams.get('code'));
        res.writeHead(302, { location: '/#instellingen' }); return res.end();
      }
      if (pass) {
        const ok = (req.headers.authorization || '') === 'Basic ' + Buffer.from(`admin:${pass}`).toString('base64');
        if (!ok) { res.writeHead(401, { 'www-authenticate': 'Basic realm="Fraternity agent"' }); return res.end(); }
      }
      if (p.startsWith('/fonts/')) { const f = safeJoin(config.paths.fonts, path.basename(p)); return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'font/ttf') : send(res, 404, '', 'text/plain'); }
      if (p === '/api/state') return send(res, 200, state(ctx.store.reload() && ctx));
      if (p === '/api/auth/url') {
        const { authorizeUrl } = require('../auth/tiktok-oauth');
        const { url: u, state: st } = authorizeUrl(config); store.meta('oauthState', st); return send(res, 200, { url: u });
      }
      if (p === '/api/run/daily' && req.method === 'POST') {
        if (busy) return send(res, 409, { error: 'er loopt al een run' });
        busy = true; require('../workflow/daily').runDaily(ctx).catch((e) => log.error(e.message)).finally(() => { busy = false; });
        return send(res, 202, { started: true });
      }
      if (p === '/api/settings' && req.method === 'POST') {
        const b = await readBody(req);
        const file = path.join(config.paths.root, 'config', 'agent.config.json');
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (b.approvalMode && ['all', 'sensitive-only', 'none'].includes(b.approvalMode)) raw.approval.mode = config.approval.mode = b.approvalMode;
        if ('privacyLevel' in b) raw.publishing.privacyLevel = config.publishing.privacyLevel = b.privacyLevel || null;
        if (b.postMode && ['DIRECT_POST', 'MEDIA_UPLOAD'].includes(b.postMode)) raw.publishing.postMode = config.publishing.postMode = b.postMode;
        fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
        return send(res, 200, { ok: true });
      }
      if (p === '/api/creator-info') return send(res, 200, await require('../providers/publish/tiktok')(ctx).creatorInfo());
      let m;
      if ((m = p.match(/^\/api\/posts\/([\w-]+)(?:\/(\w+))?$/))) {
        const [, id, action] = m;
        const post = store.get('posts', id); if (!post) return send(res, 404, { error: 'post niet gevonden' });
        const b = req.method === 'GET' ? {} : await readBody(req);
        if (req.method === 'DELETE') { fs.rmSync(path.join(config.paths.posts, id), { recursive: true, force: true }); store.remove('posts', id); return send(res, 200, { ok: true }); }
        if (req.method === 'PATCH') {
          const patch = {};
          for (const k of ['caption', 'title']) if (typeof b[k] === 'string') patch[k] = b[k].trim();
          if (Array.isArray(b.hashtags)) patch.hashtags = b.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`).toLowerCase());
          if (b.scheduledAt) patch.scheduledAt = new Date(b.scheduledAt).toISOString();
          if (b.publishSettings) patch.publishSettings = { ...post.publishSettings, ...b.publishSettings };
          if (b.metrics) patch.metrics = { ...(post.metrics || {}), ...b.metrics };
          if (b.shareUrl) patch.shareUrl = b.shareUrl;
          const updated = { ...post, ...patch };
          patch.qa = runQa(updated, ctx); patch.editedByUser = true;
          return send(res, 200, store.update('posts', id, patch));
        }
        if (action === 'approve') {
          if (!post.qa?.ok) return send(res, 400, { error: 'QA heeft fouten – eerst aanpassen' });
          return send(res, 200, store.update('posts', id, { status: 'scheduled', approvedAt: new Date().toISOString(), publishSettings: { ...post.publishSettings, ...(b.publishSettings || {}) } }));
        }
        if (action === 'reject') return send(res, 200, store.update('posts', id, { status: 'rejected' }));
        if (action === 'publish') return send(res, 200, await publishPost(ctx, store.update('posts', id, { publishSettings: { ...post.publishSettings, ...(b.publishSettings || {}) } })));
        if (action === 'published') return send(res, 200, store.update('posts', id, { status: 'published', publishedAt: new Date().toISOString(), shareUrl: b.shareUrl || post.shareUrl, tiktokIds: b.videoId ? [String(b.videoId)] : (post.tiktokIds || (b.shareUrl?.match(/video\/(\d+)|photo\/(\d+)/)?.slice(1).filter(Boolean) || [])) }));
        return send(res, 200, post);
      }
      if ((m = p.match(/^\/api\/ideas\/([\w-]+)\/(build|dismiss)$/)) && req.method === 'POST') {
        const idea = store.get('ideas', m[1]); if (!idea) return send(res, 404, { error: 'idee niet gevonden' });
        if (m[2] === 'dismiss') return send(res, 200, store.update('ideas', idea.id, { status: 'dismissed' }));
        if (idea.format === 'poster-request') return send(res, 400, { error: 'Eerst een geverifieerde poster maken in de Fraternity-repo (football-poster-designer agent).' });
        const { chromium } = require('playwright');
        const br = await chromium.launch();
        try {
          const post = await require('../modules/post-builder').buildPost(ctx, idea, { browser: br });
          const at = require('../modules/scheduler').planSlot(store, config);
          store.update('ideas', idea.id, { status: 'used', postId: post.id });
          return send(res, 200, store.update('posts', post.id, { scheduledAt: at, status: post.status === 'ready' ? 'scheduled' : post.status }));
        } finally { await br.close(); }
      }
      // Static UI
      const f = safeJoin(PUB, p === '/' ? 'index.html' : p.slice(1));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, 200, fs.readFileSync(f), TYPES[path.extname(f)] || 'text/plain');
      send(res, 404, 'not found', 'text/plain');
    } catch (e) { log.error(e.stack); send(res, 500, { error: e.message }); }
  });
  server.listen(port, () => log.info(`Dashboard: http://localhost:${port}${pass ? ' (wachtwoord actief)' : ''}`));

  // Built-in scheduler: publish every 5 min; daily loop once per day at schedule.dailyRunAt.
  if (!process.argv.includes('--no-scheduler')) {
    setInterval(async () => {
      try {
        store.reload();
        await publishDue(ctx);
        const z = zonedParts(new Date(), config.schedule.timezone);
        const today = `${z.y}-${z.m}-${z.d}`, hm = `${String(z.hh).padStart(2, '0')}:${String(z.mm).padStart(2, '0')}`;
        if (!busy && hm >= (config.schedule.dailyRunAt || '07:05') && store.meta('lastDaily') !== today) {
          busy = true; store.meta('lastDaily', today);
          await require('../workflow/daily').runDaily(ctx).catch((e) => log.error(`daily: ${e.message}`)).finally(() => { busy = false; });
        }
      } catch (e) { log.error(`scheduler: ${e.message}`); }
    }, 5 * 60e3);
    log.info('Scheduler actief (publiceren elke 5 min, dagelijkse run om ' + (config.schedule.dailyRunAt || '07:05') + ')');
  }
  return server;
}
module.exports = { start };
