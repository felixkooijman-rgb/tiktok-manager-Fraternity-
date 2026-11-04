'use strict';
// Caption + hashtags. Template caption from verified data; Claude may polish tone/spelling but
// QA rejects any polished caption that introduces numbers/names not present in the facts.
const { FORMATS } = require('./formats');
const { getLlm } = require('../core/llm');

function hashtagsFor(entries, format, config) {
  const h = config.hashtags;
  const tags = [...h.brand, ...(h.byFormat[format] || [])];
  for (const m of entries) {
    for (const [k, v] of Object.entries(h.byClub)) if ([m.match.home.name, m.match.away.name].some((n) => n === k || new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(n) || (k === 'Nederland' && n === 'Netherlands'))) tags.push(...v);
    for (const [k, v] of Object.entries(h.byCompetition)) if (m.match.competition.startsWith(k)) tags.push(...v);
  }
  tags.push(...h.always);
  return [...new Set(tags.map((t) => t.toLowerCase()))].slice(0, h.max);
}

function tokens(s) { return new Set((String(s).match(/\d+|[A-Za-zÀ-ž]{4,}/g) || []).map((x) => x.toLowerCase())); }

async function buildCaption(ctx, idea, entries) {
  const f = FORMATS[idea.format];
  const subject = f.group ? entries : entries[0];
  const caption = f.caption(subject, idea.signal);
  const title = f.title(subject, idea.signal).slice(0, 90);
  const hashtags = hashtagsFor(entries, idea.format, ctx.config);
  const result = { caption, title, hashtags, captionSource: 'template' };
  const llm = getLlm(ctx);
  if (!llm) return result;
  try {
    const facts = entries.map((m) => [m.match, m.goals, m.featured, m.confirmed]).map((x) => JSON.stringify(x)).join('\n');
    const polished = await llm.complete({
      system: 'Je schrijft TikTok-captions voor Fraternity (premium voetbalposters). Toon: kort, Nederlands, enthousiast maar niet schreeuwerig, max 2 emoji, eindig met een vraag. VERBODEN: feiten, cijfers, namen of claims toevoegen die niet in de feiten staan; clickbait; "link in bio" herhalen als het al in de tekst staat. Antwoord alleen met de caption.',
      prompt: `Feiten (geverifieerd):\n${facts}\n\nConcept-caption:\n${caption}\n\nVerbeter spelling, ritme en hook (max 220 tekens).`,
      maxTokens: 300,
    });
    const allowed = new Set([...tokens(caption), ...tokens(facts)]);
    const novel = [...tokens(polished)].filter((t) => /\d/.test(t) && !allowed.has(t));
    if (polished && polished.length <= 400 && novel.length === 0) Object.assign(result, { caption: polished.trim(), captionSource: 'llm', captionDraft: caption });
  } catch (e) { ctx.log.warn(`caption polish: ${e.message}`); }
  return result;
}

module.exports = { buildCaption, hashtagsFor };
