'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString('nl-NL'));
const when = (iso) => (iso ? new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
const STATUS = { 'pending-approval': 'Wacht op goedkeuring', scheduled: 'Ingepland', ready: 'Klaar', 'qa-failed': 'QA-fout', publishing: 'Bezig met publiceren', 'in-tiktok-inbox': 'In TikTok-inbox', 'export-ready': 'Klaar voor handmatig posten', published: 'Gepubliceerd', 'publish-failed': 'Publiceren mislukt', rejected: 'Afgewezen', building: 'Wordt gebouwd' };
const PRIVACY = { PUBLIC_TO_EVERYONE: 'Iedereen', MUTUAL_FOLLOW_FRIENDS: 'Vrienden', FOLLOWER_OF_CREATOR: 'Volgers', SELF_ONLY: 'Alleen ik' };
let S = null, postFilter = 'all';

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { alert(j.error || r.status); throw new Error(j.error); }
  return j;
}
async function load() { S = await api('/api/state'); render(); }
const media = (p, s) => `/media/${p.id}/${s.file}`;

function issues(qa) {
  if (!qa) return '';
  return `<ul class="issues">${qa.errors.map((x) => `<li class="e">✕ ${esc(x)}</li>`).join('')}${qa.reasons.map((x) => `<li class="r">● ${esc(x)}</li>`).join('')}${qa.warnings.map((x) => `<li class="w">! ${esc(x)}</li>`).join('')}</ul>`;
}

function postCard(p) {
  const m = p.metrics;
  return `<div class="card">
    <div class="top"><span class="st ${p.status}">${STATUS[p.status] || p.status}</span><span class="muted small">${esc(p.formatLabel)} · ${when(p.scheduledAt)}</span></div>
    <div class="strip">${(p.slides || []).map((s) => `<img loading="lazy" src="${media(p, s)}" data-big="${media(p, s)}" alt="${esc(s.type)}">`).join('')}</div>
    <b>${esc(p.title)}</b>
    <div class="caption">${esc(p.caption)}</div>
    <div>${(p.hashtags || []).map((h) => `<span class="chip">${esc(h)}</span>`).join('')}</div>
    ${m ? `<div class="small"><b>${fmt(m.views)}</b> views · ${fmt(m.likes)} likes · ${fmt(m.comments)} reacties · ${fmt(m.shares)} shares · ${fmt(m.favorites)} favorieten · ${(m.engagement * 100 || 0).toFixed(1)}% engagement</div>` : ''}
    ${p.shareUrl ? `<a class="small" href="${esc(p.shareUrl)}" target="_blank" rel="noopener">Bekijk op TikTok ↗</a>` : ''}
    ${p.publish?.exportDir ? `<div class="small muted">Export: ${esc(p.publish.exportDir)} (${esc(p.publish.reason || '')})</div>` : ''}
    ${p.publishError ? `<div class="small" style="color:var(--bad)">${esc(p.publishError)}</div>` : ''}
    <details><summary class="small">QA, bronnen &amp; rechten</summary>${issues(p.qa)}
      <div class="small"><b>Waarom:</b> ${esc(p.why)}</div>
      <div class="small"><b>Beelden:</b> ${(p.credits || []).map(esc).join(' · ')}</div>
      <div class="small"><b>Bronnen:</b><ul>${(p.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> – ${esc(s.used_for)}</li>`).join('')}</ul></div>
      ${p.openChecks?.length ? `<div class="small"><b>Open punten posterdata:</b><ul>${p.openChecks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    </details>
    <div class="actions">
      ${['pending-approval', 'ready', 'qa-failed'].includes(p.status) ? `<button class="ok" data-act="approve" data-id="${p.id}">✓ Goedkeuren</button>` : ''}
      ${!['published', 'rejected'].includes(p.status) ? `<button data-act="edit" data-id="${p.id}">Aanpassen</button><button data-act="publish" data-id="${p.id}">Nu publiceren</button>` : ''}
      ${['export-ready', 'in-tiktok-inbox', 'scheduled'].includes(p.status) ? `<button data-act="published" data-id="${p.id}">Markeer gepubliceerd</button>` : ''}
      ${p.status === 'published' ? `<button data-act="stats" data-id="${p.id}">Favorieten invullen</button>` : ''}
      ${!['published', 'rejected'].includes(p.status) ? `<button class="bad" data-act="reject" data-id="${p.id}">Afwijzen</button>` : ''}
      <button class="bad" data-act="delete" data-id="${p.id}">Verwijderen</button>
    </div></div>`;
}

const views = {
  overzicht() {
    const posts = S.posts, st = S.stats;
    const count = (f) => posts.filter(f).length;
    const tot = Object.values(st.byFormat).reduce((a, s) => ({ views: a.views + s.totals.views, likes: a.likes + s.totals.likes, comments: a.comments + s.totals.comments, shares: a.shares + s.totals.shares }), { views: 0, likes: 0, comments: 0, shares: 0 });
    const lastF = st.followers.at(-1);
    const fmtRows = Object.entries(st.byFormat).sort((a, b) => b[1].avgViews - a[1].avgViews);
    const maxV = Math.max(1, ...fmtRows.map(([, s]) => s.avgViews));
    const upcoming = posts.filter((p) => ['scheduled', 'pending-approval', 'export-ready', 'in-tiktok-inbox'].includes(p.status)).sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || '')).slice(0, 8);
    return `<h2>Overzicht</h2>
    ${!S.tiktok.connected ? `<div class="panel" style="margin-bottom:14px">⚠ TikTok is nog niet gekoppeld. Posts worden klaargezet voor handmatige publicatie. <a href="#instellingen">Koppel TikTok →</a></div>` : ''}
    <div class="kpis">
      <div class="kpi"><span>Gemaakt</span><b>${count(() => true)}</b></div>
      <div class="kpi"><span>Klaar / ingepland</span><b>${count((p) => ['scheduled', 'ready', 'export-ready', 'in-tiktok-inbox'].includes(p.status))}</b></div>
      <div class="kpi"><span>Wacht op jou</span><b>${count((p) => ['pending-approval', 'qa-failed'].includes(p.status))}</b></div>
      <div class="kpi"><span>Gepubliceerd</span><b>${count((p) => p.status === 'published')}</b></div>
      <div class="kpi"><span>Views</span><b>${fmt(tot.views)}</b></div>
      <div class="kpi"><span>Likes · reacties · shares</span><b>${fmt(tot.likes)} · ${fmt(tot.comments)} · ${fmt(tot.shares)}</b></div>
      <div class="kpi"><span>Volgers</span><b>${fmt(lastF?.followers)}</b>${st.followerGain != null ? `<span>${st.followerGain >= 0 ? '+' : ''}${fmt(st.followerGain)} sinds meting</span>` : ''}</div>
    </div>
    <div class="grid2">
      <div><h3>Prestaties per contentcategorie</h3>${fmtRows.length ? `<div class="tablewrap"><table><tr><th>Format</th><th>Posts</th><th>⌀ views</th><th>⌀ engagement</th><th>Gewicht</th></tr>${fmtRows.map(([k, s]) => `<tr><td>${esc(k)}<div class="bar" style="width:${(s.avgViews / maxV) * 100}%"></div></td><td>${s.posts}</td><td>${fmt(s.avgViews)}</td><td>${(s.avgEngagement * 100).toFixed(1)}%</td><td>${S.weights.formats[k] ?? '1'}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nog geen gepubliceerde posts met statistieken.</p>'}
      <h3>Tijdslots</h3>${Object.keys(st.bySlot).length ? `<div class="tablewrap"><table><tr><th>Tijd</th><th>Posts</th><th>⌀ views</th></tr>${Object.entries(st.bySlot).sort().map(([k, s]) => `<tr><td>${k}</td><td>${s.posts}</td><td>${fmt(s.avgViews)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nog geen data – de agent test verschillende tijden.</p>'}</div>
      <div><h3>Komende posts</h3>${upcoming.length ? `<div class="tablewrap"><table>${upcoming.map((p) => `<tr><td>${when(p.scheduledAt)}</td><td>${esc(p.title)}</td><td><span class="st ${p.status}">${STATUS[p.status]}</span></td></tr>`).join('')}</table></div>` : '<p class="muted">Niets ingepland. Start een dagelijkse run.</p>'}
      ${S.accountReport ? `<h3>Account @${esc(S.accountReport.account.username)}</h3><p class="small">${fmt(S.accountReport.account.followers)} volgers · ${S.accountReport.sample} posts geanalyseerd · mediaan ${fmt(S.accountReport.medianViews)} views</p>` : ''}</div>
    </div>`;
  },
  posts() {
    const filters = { all: 'Alle', wait: 'Wacht op goedkeuring', ready: 'Klaar / ingepland', published: 'Gepubliceerd', other: 'Afgewezen / fout' };
    const match = { all: () => true, wait: (p) => ['pending-approval', 'qa-failed'].includes(p.status), ready: (p) => ['scheduled', 'ready', 'export-ready', 'in-tiktok-inbox', 'publishing'].includes(p.status), published: (p) => p.status === 'published', other: (p) => ['rejected', 'publish-failed'].includes(p.status) };
    const list = S.posts.filter(match[postFilter]);
    return `<h2>Posts</h2><div class="filters">${Object.entries(filters).map(([k, v]) => `<button data-filter="${k}" class="${k === postFilter ? 'primary' : ''}">${v} (${S.posts.filter(match[k]).length})</button>`).join('')}</div>
      ${list.length ? `<div class="cards">${list.map(postCard).join('')}</div>` : '<p class="muted">Geen posts in deze lijst.</p>'}`;
  },
  ideeen() {
    const rows = S.ideas;
    return `<h2>Contentideeën</h2><p class="muted small">Kandidaten uit de laatste runs, gesorteerd op score. "Nieuwe poster nodig" = onderwerp zonder geverifieerde poster: laat de football-poster-designer agent in de Fraternity-repo de data verifiëren en de poster maken.</p>
    <div class="tablewrap"><table><tr><th>Score</th><th>Format</th><th>Idee</th><th>Status</th><th></th></tr>
    ${rows.map((i) => `<tr><td>${i.score}</td><td>${esc(i.label)}</td><td>${esc(i.why)}${i.signal?.url ? ` <a href="${esc(i.signal.url)}" target="_blank" rel="noopener">bron ↗</a>` : ''}${i.error ? `<div class="small" style="color:var(--bad)">${esc(i.error)}</div>` : ''}</td><td>${esc(i.status)}</td>
      <td>${i.format !== 'poster-request' && i.status !== 'used' ? `<button data-idea="${i.id}" data-do="build">Maak post</button>` : ''} <button data-idea="${i.id}" data-do="dismiss">✕</button></td></tr>`).join('')}</table></div>
    <h3>Laatste signalen (trends, nieuws, shop)</h3><div class="tablewrap"><table><tr><th>Bron</th><th>Signaal</th></tr>${S.research.slice(0, 40).map((r) => `<tr><td>${esc(r.source)}</td><td>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</td></tr>`).join('')}</table></div>`;
  },
  beelden() {
    const assets = S.posts.flatMap((p) => (p.assets || []).map((a) => ({ ...a, post: p })));
    const srcs = S.posts.flatMap((p) => (p.sources || []).map((s) => ({ ...s, post: p })));
    return `<h2>Beelden &amp; bronnen</h2><h3>Gebruikte beelden</h3><div class="tablewrap"><table><tr><th>Bron</th><th>Licentie</th><th>AI</th><th>Post</th></tr>
      ${assets.map((a) => `<tr><td>${a.sourceUrl ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">${esc(a.source)}</a>` : esc(a.source)}</td><td>${esc(a.license?.type)}${a.license?.attributionRequired ? ' · naamsvermelding verplicht' : ''}</td><td>${a.aiGenerated ? 'ja' : 'nee'}</td><td>${esc(a.post.title)}</td></tr>`).join('')}</table></div>
      <h3>Gegenereerde slides</h3><div class="strip">${S.posts.flatMap((p) => (p.slides || []).map((s) => `<img loading="lazy" src="${media(p, s)}" data-big="${media(p, s)}">`)).slice(0, 60).join('')}</div>
      <h3>Feitenbronnen</h3><div class="tablewrap"><table><tr><th>Bron</th><th>Gebruikt voor</th><th>Post</th></tr>${srcs.map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></td><td>${esc(s.used_for)}</td><td>${esc(s.post.title)}</td></tr>`).join('')}</table></div>`;
  },
  runs() {
    return `<h2>Runs</h2>${S.runs.map((r) => `<div class="panel" style="margin-bottom:10px"><b>${when(r.startedAt)}</b> – ${r.ok === false ? `<span style="color:var(--bad)">fout: ${esc(r.error)}</span>` : r.finishedAt ? `${(r.built || []).length} post(s)` : 'loopt…'}
      <ul class="small">${(r.steps || []).map((s) => `<li>STAP ${s.n}: ${esc(s.t)}</li>`).join('')}</ul></div>`).join('') || '<p class="muted">Nog geen runs.</p>'}`;
  },
  instellingen() {
    const t = S.tiktok;
    return `<h2>Instellingen</h2><div class="grid2">
      <div class="panel"><h3>TikTok</h3>
        <p class="small">App geconfigureerd: <b>${t.configured ? 'ja' : 'nee'}</b> · Gekoppeld: <b>${t.connected ? 'ja' : 'nee'}</b> · Publieke media-host: <b>${t.mediaHost ? 'ja' : 'nee'}</b></p>
        ${t.scopes ? `<p class="small muted">Scopes: ${esc(t.scopes)}</p>` : ''}
        <button id="connect" class="primary" ${t.configured ? '' : 'disabled'}>Koppel TikTok (@${esc(S.brand.handle)})</button>
        ${t.connected ? ' <button id="creator">Toon creator-info</button>' : ''}
        <pre id="creatorOut" class="small"></pre></div>
      <div class="panel"><h3>Publicatie</h3>
        <label>Goedkeuring<select id="approval">${[['all', 'Elke post handmatig goedkeuren'], ['sensitive-only', 'Alleen gevoelige/gemarkeerde posts'], ['none', 'Nooit (niet aanbevolen)']].map(([k, v]) => `<option value="${k}" ${S.approvalMode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Zichtbaarheid op TikTok (bewust kiezen)<select id="privacy"><option value="">– per post kiezen –</option>${Object.entries(PRIVACY).map(([k, v]) => `<option value="${k}" ${S.privacyLevel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Modus<select id="postMode"><option value="DIRECT_POST" ${S.postMode === 'DIRECT_POST' ? 'selected' : ''}>Direct publiceren</option><option value="MEDIA_UPLOAD" ${S.postMode === 'MEDIA_UPLOAD' ? 'selected' : ''}>Als concept naar TikTok-inbox</option></select></label>
        <button id="saveSettings" class="primary">Opslaan</button>
        <p class="small muted">Tot TikTok de app heeft geauditeerd, mogen API-posts alleen "Alleen ik" zijn. AI-tekst: ${S.llm ? 'Claude actief' : 'uit (sjablonen)'}.</p></div></div>`;
  },
};

function render() {
  const tab = (location.hash || '#overzicht').slice(1);
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${tab}`));
  $('#app').innerHTML = (views[tab] || views.overzicht)();
}

function editDialog(p) {
  const d = $('#dlg');
  d.innerHTML = `<form method="dialog"><h3>Post aanpassen</h3>
    <label>Titel (max 90)<input name="title" maxlength="90" value="${esc(p.title)}"></label>
    <label>Caption<textarea name="caption">${esc(p.caption)}</textarea></label>
    <label>Hashtags (spatie-gescheiden)<input name="hashtags" value="${esc((p.hashtags || []).join(' '))}"></label>
    <label>Moment<input type="datetime-local" name="scheduledAt" value="${p.scheduledAt ? new Date(new Date(p.scheduledAt) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''}"></label>
    <label>Zichtbaarheid<select name="privacy"><option value="">– kies –</option>${Object.entries(PRIVACY).map(([k, v]) => `<option value="${k}" ${p.publishSettings?.privacyLevel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="comments" ${p.publishSettings?.allowComments ? 'checked' : ''}> Reacties toestaan</label>
    <label style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="organic" ${p.publishSettings?.brandOrganic ? 'checked' : ''}> Promoot eigen merk (TikTok "Your brand")</label>
    <div class="actions"><button value="cancel">Annuleren</button><button value="save" class="primary">Opslaan</button></div></form>`;
  d.showModal();
  d.onclose = async () => {
    if (d.returnValue !== 'save') return;
    const f = d.querySelector('form');
    await api(`/api/posts/${p.id}`, { method: 'PATCH', body: { title: f.title.value, caption: f.caption.value, hashtags: f.hashtags.value.split(/\s+/).filter(Boolean), scheduledAt: f.scheduledAt.value || undefined, publishSettings: { privacyLevel: f.privacy.value || null, allowComments: f.comments.checked, brandOrganic: f.organic.checked } } });
    load();
  };
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.big) { const d = $('#dlg'); d.innerHTML = `<div class="big" onclick="this.closest('dialog').close()"><img src="${t.dataset.big}"></div>`; d.onclose = null; d.showModal(); return; }
  if (t.dataset.filter) { postFilter = t.dataset.filter; render(); return; }
  if (t.dataset.act) {
    const p = S.posts.find((x) => x.id === t.dataset.id);
    const a = t.dataset.act;
    if (a === 'edit') return editDialog(p);
    if (a === 'delete' && !confirm('Post en slides definitief verwijderen?')) return;
    if (a === 'approve' || a === 'publish') {
      let privacy = p.publishSettings?.privacyLevel || S.privacyLevel;
      if (!privacy && S.tiktok.connected) { editDialog(p); return alert('Kies eerst de zichtbaarheid voor deze post.'); }
      await api(`/api/posts/${p.id}/${a}`, { method: 'POST', body: { publishSettings: { privacyLevel: privacy || null } } });
    } else if (a === 'published') {
      const url = prompt('Plak de TikTok-link van deze post:'); if (!url) return;
      await api(`/api/posts/${p.id}/published`, { method: 'POST', body: { shareUrl: url } });
    } else if (a === 'stats') {
      const fav = prompt('Aantal favorieten (uit TikTok Studio):', p.metrics?.favorites ?? ''); if (fav === null) return;
      await api(`/api/posts/${p.id}`, { method: 'PATCH', body: { metrics: { favorites: Number(fav) } } });
    } else if (a === 'delete') await api(`/api/posts/${p.id}`, { method: 'DELETE' });
    else await api(`/api/posts/${p.id}/${a}`, { method: 'POST' });
    return load();
  }
  if (t.dataset.idea) { t.disabled = true; t.textContent = '…'; await api(`/api/ideas/${t.dataset.idea}/${t.dataset.do}`, { method: 'POST' }).finally(load); return; }
  if (t.id === 'run') { await api('/api/run/daily', { method: 'POST' }); t.textContent = '⏳ Run gestart…'; setTimeout(() => { t.textContent = '▶ Dagelijkse run'; load(); }, 15000); return; }
  if (t.id === 'connect') { const { url } = await api('/api/auth/url'); location.href = url; return; }
  if (t.id === 'creator') { $('#creatorOut').textContent = JSON.stringify(await api('/api/creator-info'), null, 2); return; }
  if (t.id === 'saveSettings') { await api('/api/settings', { method: 'POST', body: { approvalMode: $('#approval').value, privacyLevel: $('#privacy').value, postMode: $('#postMode').value } }); load(); }
});
window.addEventListener('hashchange', render);
load();
setInterval(load, 60000);
