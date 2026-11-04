'use strict';
// STAP 6 – quality, rights and safety gate. Produces {ok, errors, warnings, needsApproval, reasons}.
const fs = require('fs');

function checkText(s) {
  const issues = [];
  if (/\s{2,}/.test(s.replace(/\n/g, ' '))) issues.push('dubbele spaties');
  if (/\b(\w{3,})\s+\1\b/i.test(s)) issues.push('herhaald woord');
  if (/undefined|null|NaN|\[object/.test(s)) issues.push('lege variabele in tekst');
  return issues;
}

function runQa(post, ctx) {
  const { config } = ctx;
  const errors = [], warnings = [], reasons = [];
  // Images
  if (!post.slides.length) errors.push('geen slides');
  if (post.slides.length > 35) errors.push('TikTok staat max. 35 foto’s toe');
  for (const s of post.slides) {
    if (!fs.existsSync(s.path)) errors.push(`slide ontbreekt: ${s.file}`);
    if (s.width !== 1080 || s.height !== 1920) errors.push(`${s.file}: ${s.width}×${s.height}, verwacht 1080×1920`);
    if (s.overflow?.length) errors.push(`${s.file}: tekst buiten beeld (${s.overflow.join(', ')})`);
  }
  // Rights
  for (const a of post.assets) {
    if (!a.license || !a.license.type) errors.push(`geen licentie bekend voor ${a.source}`);
    else if (a.license.commercialUse === false) errors.push(`licentie staat geen commercieel gebruik toe: ${a.source}`);
    if (a.license?.attributionRequired && !post.credits.some((c) => c.includes(a.license.attribution))) errors.push(`naamsvermelding ontbreekt: ${a.license.attribution}`);
    if (a.aiGenerated) reasons.push('bevat AI-gegenereerd beeld (label AIGC aanzetten)');
  }
  // Text
  const full = `${post.title}\n${post.caption}\n${post.hashtags.join(' ')}`;
  if (post.title.length > 90) errors.push('titel > 90 tekens');
  if (full.length > 4000) errors.push('caption > 4000 tekens');
  if (post.hashtags.length > config.hashtags.max) warnings.push('veel hashtags');
  if (post.hashtags.some((h) => !/^#[\p{L}\p{N}_]+$/u.test(h))) errors.push('ongeldige hashtag');
  for (const i of checkText(full)) errors.push(`tekst: ${i}`);
  for (const s of post.slides) for (const i of checkText(s.text || '')) warnings.push(`${s.file}: ${i}`);
  const low = full.toLowerCase() + ' ' + post.slides.map((s) => s.text || '').join(' ').toLowerCase();
  for (const b of config.safety.bannedClaims) if (low.includes(b)) errors.push(`misleidende claim: "${b}"`);
  for (const t of config.safety.sensitiveTerms) if (new RegExp(`\\b${t}\\b`).test(low)) reasons.push(`gevoelig woord: "${t}"`);
  if (post.signal?.kind === 'news') reasons.push(`reageert op nieuws: ${post.signal.title}`);
  if (post.openChecks?.length) warnings.push(`${post.openChecks.length} open punten in de posterdata (zie bronnen)`);
  if (post.captionSource === 'llm') warnings.push('caption door AI herschreven (feiten-check: geen nieuwe cijfers)');
  // Repetition
  const recent = ctx.store.all('posts', (p) => p.id !== post.id && p.status !== 'rejected' && Date.now() - new Date(p.createdAt).getTime() < 30 * 864e5);
  if (recent.some((p) => p.caption === post.caption)) errors.push('identieke caption als een recente post');
  if (recent.some((p) => p.format === post.format && (p.slugs || []).join() === post.slugs.join())) warnings.push('zelfde format + wedstrijd recent gebruikt');

  const mode = config.approval.mode;
  const needsApproval = mode === 'all' || (mode === 'sensitive-only' && reasons.length > 0);
  return { ok: errors.length === 0, errors, warnings, needsApproval, reasons, checkedAt: new Date().toISOString() };
}
module.exports = { runQa };
