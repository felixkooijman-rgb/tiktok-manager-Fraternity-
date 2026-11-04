'use strict';
// Analyse the existing TikTok account (official Display API): topics, hashtags, caption length,
// posting times, best performers, dominant cover colours. Writes data/account-report.json and the
// "Gemeten" section of config/style-guide.md, and seeds format/slot weights.
const fs = require('fs');
const path = require('path');
const registry = require('../core/registry');
const { zonedParts } = require('../core/util');

const MARK_START = '<!-- AUTO:ACCOUNT-ANALYSIS:START -->', MARK_END = '<!-- AUTO:ACCOUNT-ANALYSIS:END -->';

async function coverColors(urls, browser) {
  if (!browser || !urls.length) return [];
  const page = await browser.newPage();
  try {
    const out = [];
    for (const u of urls.slice(0, 24)) {
      try {
        const res = await fetch(u); if (!res.ok) continue;
        const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
        out.push(...await page.evaluate(async (src) => {
          const img = new Image(); img.src = src; await img.decode();
          const c = document.createElement('canvas'); c.width = 48; c.height = 85;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 85);
          const d = g.getImageData(0, 0, 48, 85).data, bins = {};
          for (let i = 0; i < d.length; i += 4) { const k = [d[i], d[i + 1], d[i + 2]].map((v) => Math.round(v / 32) * 32).map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join(''); bins[k] = (bins[k] || 0) + 1; }
          return Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => '#' + k.toUpperCase());
        }, `data:image/jpeg;base64,${b64}`));
      } catch { /* skip unreadable cover */ }
    }
    const count = {}; for (const c of out) count[c] = (count[c] || 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => ({ color: c, covers: n }));
  } finally { await page.close(); }
}

async function analyzeAccount(ctx, { browser } = {}) {
  const { config, store, log } = ctx;
  const a = registry.create('analytics', config.providers.analytics, ctx);
  const user = await a.user();
  const vids = await a.listVideos(300);
  const tz = config.schedule.timezone;
  const rows = vids.map((v) => {
    const text = `${v.title || ''} ${v.video_description || ''}`;
    const z = zonedParts(new Date(v.create_time * 1000), tz);
    const views = v.view_count || 0;
    return { id: v.id, url: v.share_url, cover: v.cover_image_url, text, hashtags: (text.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase()),
      hour: z.hh, weekday: z.weekday, views, likes: v.like_count || 0, comments: v.comment_count || 0, shares: v.share_count || 0,
      engagement: views ? (v.like_count + v.comment_count + v.share_count) / views : 0, captionLength: (v.video_description || '').length, created: new Date(v.create_time * 1000).toISOString() };
  });
  const tagCount = {}; rows.forEach((r) => r.hashtags.forEach((h) => { tagCount[h] = tagCount[h] || { n: 0, views: 0 }; tagCount[h].n++; tagCount[h].views += r.views; }));
  const hours = {}; rows.forEach((r) => { hours[r.hour] = hours[r.hour] || { n: 0, views: 0 }; hours[r.hour].n++; hours[r.hour].views += r.views; });
  const words = {}; rows.forEach((r) => (r.text.toLowerCase().replace(/#[^\s]+/g, '').match(/[a-zà-ž]{5,}/g) || []).forEach((w) => { words[w] = (words[w] || 0) + 1; }));
  const median = (xs) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const report = {
    analyzedAt: new Date().toISOString(),
    account: { username: user.username, displayName: user.display_name, bio: user.bio_description, followers: user.follower_count, likes: user.likes_count, posts: user.video_count },
    sample: rows.length,
    medianViews: median(rows.map((r) => r.views)),
    medianEngagement: +median(rows.map((r) => r.engagement)).toFixed(4),
    avgCaptionLength: rows.length ? Math.round(rows.reduce((s, r) => s + r.captionLength, 0) / rows.length) : 0,
    topByViews: [...rows].sort((x, y) => y.views - x.views).slice(0, 10).map(({ id, url, text, views, engagement, created }) => ({ id, url, text: text.slice(0, 140), views, engagement: +engagement.toFixed(4), created })),
    topByEngagement: [...rows].filter((r) => r.views >= 100).sort((x, y) => y.engagement - x.engagement).slice(0, 10).map(({ id, url, text, views, engagement }) => ({ id, url, text: text.slice(0, 140), views, engagement: +engagement.toFixed(4) })),
    hashtags: Object.entries(tagCount).sort((x, y) => y[1].n - x[1].n).slice(0, 25).map(([h, s]) => ({ tag: h, uses: s.n, avgViews: Math.round(s.views / s.n) })),
    postingHours: Object.entries(hours).sort((x, y) => +x[0] - +y[0]).map(([h, s]) => ({ hour: +h, posts: s.n, avgViews: Math.round(s.views / s.n) })),
    frequentWords: Object.entries(words).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([w, n]) => ({ word: w, n })),
    coverColors: await coverColors(rows.sort((x, y) => y.views - x.views).map((r) => r.cover).filter(Boolean), browser),
  };
  fs.writeFileSync(path.join(config.paths.data, 'account-report.json'), JSON.stringify(report, null, 2));
  writeStyleGuideSection(config, report);
  // Seed slot weights from historic posting hours (only hours with ≥ 2 posts).
  const sw = {};
  for (const s of config.schedule.candidateSlots) {
    const h = hours[+s.slice(0, 2)];
    if (h && h.n >= 2 && report.medianViews) sw[s] = +Math.min(2, Math.max(0.5, (h.views / h.n) / report.medianViews)).toFixed(3);
  }
  if (Object.keys(sw).length) store.meta('slotWeights', { ...(store.meta('slotWeights') || {}), ...sw });
  log.info(`account @${user.username}: ${rows.length} posts geanalyseerd`);
  return report;
}

function writeStyleGuideSection(config, r) {
  const file = path.join(config.paths.root, 'config', 'style-guide.md');
  const md = fs.readFileSync(file, 'utf8');
  const section = [MARK_START, `_Laatst gemeten: ${r.analyzedAt.slice(0, 10)} via de TikTok Display API – ${r.sample} posts van @${r.account.username} (${r.account.followers} volgers)._`, '',
    `- Mediaan views: **${r.medianViews}** · mediaan engagement: **${(r.medianEngagement * 100).toFixed(1)}%** · gem. captionlengte: **${r.avgCaptionLength}** tekens`,
    `- Meest gebruikte hashtags: ${r.hashtags.slice(0, 12).map((h) => `${h.tag} (${h.uses}×, ⌀ ${h.avgViews} views)`).join(', ') || '–'}`,
    `- Dominante covertinten: ${r.coverColors.map((c) => `\`${c.color}\``).join(' ') || '–'}`,
    `- Beste posturen (⌀ views): ${[...r.postingHours].sort((a, b) => b.avgViews - a.avgViews).slice(0, 4).map((h) => `${h.hour}:00 (${h.avgViews})`).join(', ') || '–'}`,
    '', '**Top 5 posts op views**', '', ...r.topByViews.slice(0, 5).map((t) => `1. [${t.text.replace(/\n/g, ' ').slice(0, 80) || t.id}](${t.url}) – ${t.views} views, ${(t.engagement * 100).toFixed(1)}%`),
    '', MARK_END].join('\n');
  const re = new RegExp(`${MARK_START}[\\s\\S]*${MARK_END}`);
  fs.writeFileSync(file, re.test(md) ? md.replace(re, section) : `${md}\n${section}\n`);
}
module.exports = { analyzeAccount };
