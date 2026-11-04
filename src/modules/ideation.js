'use strict';
// STAP 2 + 3 – generate ≥ N ideas from catalog × formats × signals, score and select.
// Score = format performance (learned) + signal boost (anniversary/news/trend) + novelty − risk.
const { FORMATS, hero, score: scoreLine } = require('./formats');
const { loadCatalog } = require('../providers/research/fraternity-catalog');
const { getLlm } = require('../core/llm');

function daysSince(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 999; }

function usage(store) {
  const lastMatch = {}, lastFormat = {};
  for (const p of store.all('posts')) {
    if (p.status === 'rejected') continue;
    const t = p.scheduledAt || p.createdAt;
    for (const s of p.slugs || []) if (!lastMatch[s] || t > lastMatch[s]) lastMatch[s] = t;
    if (!lastFormat[p.format] || t > lastFormat[p.format]) lastFormat[p.format] = t;
  }
  return { lastMatch, lastFormat };
}

function pickGroup(pool, n, lastMatch, rnd) {
  return [...pool].sort((a, b) => daysSince(lastMatch[b.slug]) - daysSince(lastMatch[a.slug]) + (rnd() - 0.5) * 20).slice(0, n);
}

async function generateIdeas(ctx, signals, { rnd = Math.random } = {}) {
  const { config, store, log } = ctx;
  const catalog = loadCatalog(config);
  const bySlug = Object.fromEntries(catalog.map((m) => [m.slug, m]));
  const weights = store.meta('formatWeights') || {};
  const { lastMatch, lastFormat } = usage(store);
  const minGap = config.schedule.minDaysBetweenSameMatch;
  const ideas = [];
  const trendFormats = new Set(signals.filter((s) => s.kind === 'format-trend' && s.format).map((s) => s.format));

  const add = (idea) => {
    const f = FORMATS[idea.format];
    const w = weights[idea.format] ?? 1;
    const novelty = Math.min(1, Math.min(...idea.slugs.map((s) => daysSince(lastMatch[s]))) / 30);
    const formatRest = Math.min(1, daysSince(lastFormat[idea.format]) / 3);
    const tooSoon = idea.slugs.some((s) => daysSince(lastMatch[s]) < minGap) && idea.signal?.kind !== 'anniversary';
    idea.score = +(w * 1.0 + (idea.boost || 0) + novelty * 0.6 + formatRest * 0.4 + (trendFormats.has(idea.format) ? 0.25 : 0) - (tooSoon ? 2 : 0) + rnd() * 0.15).toFixed(3);
    idea.label = f.label;
    ideas.push(idea);
  };

  // Anniversaries → on-this-day (scheduled on the day itself).
  for (const s of signals.filter((x) => x.kind === 'anniversary')) {
    const m = bySlug[s.slug]; if (!m || !FORMATS['on-this-day'].eligible(m, s)) continue;
    const roundYears = s.years % 5 === 0;
    add({ format: 'on-this-day', slugs: [m.slug], signal: s, boost: 1.2 + (roundYears ? 0.5 : 0), why: `${s.years}-jarig jubileum op ${s.date}`, scheduleOn: s.date });
  }
  // News / trends about clubs or players in the catalog → poster-reveal (approval required).
  for (const s of signals.filter((x) => x.kind === 'news' && x.related?.length)) {
    const m = bySlug[s.related[0]]; if (!m?.hasPoster) continue;
    add({ format: 'poster-reveal', slugs: [m.slug], signal: s, boost: 0.6, sensitive: true, why: `Nieuws: "${s.title}" (${s.feed})` });
  }
  // Single-match formats.
  for (const id of ['poster-reveal', 'quiz', 'framed-vs-frameless', 'design-breakdown']) {
    const pool = catalog.filter((m) => FORMATS[id].eligible(m));
    for (const m of pickGroup(pool, 3, lastMatch, rnd)) add({ format: id, slugs: [m.slug], why: `${FORMATS[id].label}: ${scoreLine(m)}` });
  }
  // Multi-match formats.
  for (const id of ['collection-pick', 'last-minute']) {
    const pool = catalog.filter((m) => FORMATS[id].eligible(m));
    if (pool.length < 3) continue;
    const grp = pickGroup(pool, FORMATS[id].group, lastMatch, rnd);
    add({ format: id, slugs: grp.map((m) => m.slug), why: `${FORMATS[id].label}: ${grp.map((m) => hero(m).short).join(', ')}` });
  }
  // Posters that do not exist yet → backlog tasks for the football-poster-designer agent.
  const requested = new Set(store.all('ideas', (i) => i.format === 'poster-request').map((i) => i.signal?.key));
  const reqs = [
    ...signals.filter((x) => x.kind === 'shop-product' && !x.related?.length).map((s) => ({ s, why: `Staat in de shop maar heeft nog geen geverifieerd matchbestand: "${s.title}". Laat de football-poster-designer agent de data verifiëren en de poster in huisstijl renderen.` })),
    ...signals.filter((x) => (x.kind === 'news' || x.kind === 'trend') && !x.related?.length).map((s) => ({ s, why: `Signaal: "${s.title}" – onderzoek of hier een iconisch moment voor een poster in zit (football-poster-designer agent).` })),
  ].filter((r) => !requested.has(r.s.key)).slice(0, 5);
  for (const { s, why } of reqs) ideas.push({ format: 'poster-request', slugs: [], signal: s, score: 0, label: 'Nieuwe poster nodig', why });

  // Optional: Claude proposes extra original angles (only on existing, verified posters).
  const llm = getLlm(ctx);
  if (llm) {
    try {
      const menu = catalog.filter((m) => m.hasPoster).map((m) => `${m.slug}: ${scoreLine(m)}, ${hero(m).name} ${hero(m).minute || ''}`).join('\n');
      const extra = await llm.complete({
        system: 'Je bent contentstrateeg voor Fraternity (voetbalposters, TikTok-fotocarrousels). Verzin GEEN feiten. Gebruik alleen de gegeven wedstrijden en formats.',
        prompt: `Formats: ${Object.keys(FORMATS).join(', ')}.\nWedstrijden:\n${menu}\n\nRecente signalen: ${signals.filter((s) => s.kind !== 'catalog-item').slice(0, 15).map((s) => s.title).join(' | ')}\n\nGeef 3 originele combinaties als JSON-array [{"format":"…","slugs":["…"],"why":"korte reden in het Nederlands"}]. Groepsformats (collection-pick, last-minute) krijgen 4 slugs.`,
        json: true,
      });
      for (const x of extra || []) {
        if (!FORMATS[x.format] || !Array.isArray(x.slugs) || !x.slugs.every((s) => bySlug[s] && FORMATS[x.format].eligible(bySlug[s]))) continue;
        add({ format: x.format, slugs: x.slugs, why: `AI-voorstel: ${x.why}`, boost: 0.1 });
      }
    } catch (e) { log.warn(`llm ideas: ${e.message}`); }
  }
  ideas.sort((a, b) => b.score - a.score);
  return ideas;
}

function selectIdeas(ideas, n, cfg) {
  const chosen = [], usedSlugs = new Set();
  for (const i of ideas) {
    if (chosen.length >= n) break;
    if (i.format === 'poster-request') continue;
    if (i.slugs.some((s) => usedSlugs.has(s))) continue;
    if (chosen.filter((c) => c.format === i.format).length >= cfg.schedule.maxSameFormatInRow) continue;
    chosen.push(i); i.slugs.forEach((s) => usedSlugs.add(s));
  }
  return chosen;
}

module.exports = { generateIdeas, selectIdeas };
