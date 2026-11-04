'use strict';
// "Klaar om te posten": one self-contained mobile page with the upcoming posts. Per post: the
// slides in order, a button that saves them one by one to the phone (Claude app → share sheet →
// "Bewaar afbeelding"), and a button that copies caption + hashtags. Published as a claude.ai
// Artifact with the `downloads` capability; also works as a plain page (Web Share on phones).
const fs = require('fs');
const path = require('path');
const { escapeHtml: e, localYmd, zonedParts } = require('../core/util');
const { hero, score } = require('./formats');
const { loadCatalog } = require('../providers/research/fraternity-catalog');

const LIVE = ['scheduled', 'ready', 'pending-approval', 'export-ready', 'in-tiktok-inbox'];

function pickPosts(store, cfg, now = new Date(), days = 31) {
  const tz = cfg.schedule.timezone;
  const today = localYmd(now, tz);
  const until = new Date(now.getTime() + days * 864e5);
  return store.all('posts', (p) => LIVE.includes(p.status) && p.qa?.ok && p.scheduledAt && p.slides?.every((s) => fs.existsSync(s.path)) && new Date(p.scheduledAt) <= until && localYmd(new Date(p.scheduledAt), tz) >= today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

function whenLabel(iso, tz, now) {
  const z = zonedParts(new Date(iso), tz);
  const day = localYmd(new Date(iso), tz) === localYmd(now, tz) ? 'Vandaag' : localYmd(new Date(iso), tz) === localYmd(new Date(now.getTime() + 864e5), tz) ? 'Morgen' : new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long', timeZone: tz });
  return `${day} ${String(z.hh).padStart(2, '0')}:${String(z.mm).padStart(2, '0')}`;
}

function dayLabel(ymd, tz, now) {
  if (ymd === localYmd(now, tz)) return 'Vandaag';
  if (ymd === localYmd(new Date(now.getTime() + 864e5), tz)) return 'Morgen';
  return new Date(ymd + 'T12:00:00Z').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

// linked = true: slides are published as separate files next to the page (light page, fast on a
// phone); `files` maps each published path to the local slide. false = everything embedded.
function buildPhonePack(ctx, { now = new Date(), linked = true } = {}) {
  const { store, config } = ctx;
  const tz = config.schedule.timezone;
  const files = {};
  const cat = Object.fromEntries(loadCatalog(config).map((m) => [m.slug, m]));
  const matchLines = (p) => (p.slugs || []).map((sl) => cat[sl]).filter(Boolean).map((m) => { const h = hero(m); return { match: score(m), moment: [h.short, h.minute].filter(Boolean).join(' ') }; });
  const posts = pickPosts(store, config, now).map((p) => ({
    matches: matchLines(p),
    id: p.id, format: p.formatLabel, when: whenLabel(p.scheduledAt, tz, now), date: localYmd(new Date(p.scheduledAt), tz),
    title: p.title, text: `${p.caption}\n\n${p.hashtags.join(' ')}`, flagged: p.status === 'pending-approval' ? (p.qa.reasons || []).join('; ') : '',
    ai: !!p.aiGenerated,
    day: dayLabel(localYmd(new Date(p.scheduledAt), tz), tz, now),
    slides: p.slides.map((s) => {
      if (!linked) return `data:image/jpeg;base64,${fs.readFileSync(s.path).toString('base64')}`;
      const pub = `slides/${p.id}/${s.file}`; files[pub] = s.path; return pub;
    }),
  }));
  const made = now.toLocaleString('nl-NL', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return { html: template(posts, { made, handle: config.brand.handle }), files, count: posts.length };
}

function template(posts, { made, handle }) {
  const cards = posts.map((p, n) => `${n === 0 || posts[n - 1].day !== p.day ? `<h2 class="day">${e(p.day)}</h2>` : ''}
  <article class="post" data-i="${n}">
    <header class="post-head">
      <span class="when">${e(p.when.split(' ').slice(-1)[0])}</span>
      <span class="fmt">${e(p.format)} · ${p.slides.length} foto's</span>
    </header>
    <ul class="matches">${p.matches.map((x) => `<li><b>${e(x.match)}</b><span>${e(x.moment)}</span></li>`).join('')}</ul>
    ${p.flagged ? `<p class="flag">Eerst zelf checken: ${e(p.flagged)}</p>` : ''}
    ${p.ai ? `<p class="flag">Bevat een AI-beeld: zet in TikTok "AI-gegenereerde content" aan.</p>` : ''}
    <div class="strip" role="list">${p.slides.map((s, i) => `<figure role="listitem"><img ${s.startsWith('data:') ? `src="${s}"` : `data-src="${s}"`} alt="Slide ${i + 1} van ${p.slides.length}"><figcaption>${i + 1}</figcaption><button class="one" type="button" id="one-${n}-${i}" data-post="${n}" data-slide="${i}">Download foto ${i + 1}</button></figure>`).join('')}</div>
    <div class="steps">
      <button class="btn save" type="button" id="save-${n}"><b>1</b> Bewaar alle ${p.slides.length} foto's</button>
      <button class="btn copy" type="button" id="copy-${n}"><b>2</b> Kopieer caption</button>
    </div>
    <p class="status" id="status-${n}" aria-live="polite"></p>
    <label class="cap-label" for="cap-${n}">Caption</label>
    <textarea id="cap-${n}" class="cap" readonly rows="5">${e(p.text)}</textarea>
    <label class="done"><input type="checkbox" id="done-${n}"> Gepost op TikTok</label>
  </article>`).join('');

  return `<title>Fraternity TikTok-posts</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&display=swap">
<style>
/* Layout: one column of post cards, slides as a swipeable strip like the TikTok carousel itself. */
:root{
  --ink:#161616; --wall:#EFECE6; --card:#FFFFFF; --line:#DAD5CC; --muted:#6A645B; --red:#D3121B; --ok:#1F7A3D; --flag:#8A5200; --flagbg:#FFF1D9;
  --display:"Anton","Impact","Arial Narrow",sans-serif; --label:"Oswald","Arial Narrow",system-ui,sans-serif; --body:system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#F2EFE9;--wall:#121212;--card:#1C1C1C;--line:#2E2E2E;--muted:#A39D93;--red:#FF4A4F;--ok:#5CC27F;--flag:#FFC56B;--flagbg:#2E2410;color-scheme:dark}}
:root[data-theme="dark"]{--ink:#F2EFE9;--wall:#121212;--card:#1C1C1C;--line:#2E2E2E;--muted:#A39D93;--red:#FF4A4F;--ok:#5CC27F;--flag:#FFC56B;--flagbg:#2E2410;color-scheme:dark}
body{background:var(--wall);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.45}
.wrap{max-width:640px;margin:0 auto;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:18px}
.brand{display:flex;align-items:center;gap:8px;font-family:var(--label);font-weight:700;letter-spacing:.14em;font-size:14px;text-transform:uppercase}
.brand svg{height:13px;width:auto;fill:currentColor}
h1{font-family:var(--display);font-weight:400;font-size:clamp(34px,9vw,48px);line-height:1;margin:4px 0 0;text-transform:uppercase;letter-spacing:.01em;text-wrap:balance}
.sub{color:var(--muted);margin:6px 0 0}
.how{margin:0;padding:12px 14px;border-left:3px solid var(--red);background:var(--card);font-size:14px}
.how ol{margin:6px 0 0;padding-left:20px;display:grid;gap:2px}
.post{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.post-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.when{font-family:var(--display);font-size:26px;text-transform:uppercase;line-height:1}
.fmt{font-family:var(--label);text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--muted)}
.matches{list-style:none;margin:-4px 0 0;padding:0;display:grid;gap:4px}
.matches li{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:16px}
.matches b{font-weight:600}
.matches span{font-family:var(--label);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-size:13px;align-self:center}
.flag{margin:0;padding:8px 10px;border-radius:8px;background:var(--flagbg);color:var(--flag);font-size:13.5px}
.strip{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;-webkit-overflow-scrolling:touch}
.strip figure{margin:0;flex:0 0 46%;max-width:240px;scroll-snap-align:start;position:relative}
.strip img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:var(--line)}
.strip .err{position:absolute;left:8px;right:8px;top:40%;text-align:center;font-size:13px;color:var(--flag);background:var(--flagbg);padding:6px;border-radius:6px}
.strip figcaption{position:absolute;left:6px;bottom:54px;background:var(--ink);color:var(--wall);font:600 12px/1 var(--label);padding:4px 7px;border-radius:4px;font-variant-numeric:tabular-nums}
.one{margin-top:6px;width:100%;font:600 13px/1.2 var(--label);text-transform:uppercase;letter-spacing:.05em;padding:10px 6px;border-radius:8px;border:1.5px solid var(--ink);background:var(--card);color:var(--ink);cursor:pointer;min-height:40px}
.one.ok{border-color:var(--ok);color:var(--ok)}
.one:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.strip figcaption{z-index:1}
.steps{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{font:600 15px/1.2 var(--label);text-transform:uppercase;letter-spacing:.06em;padding:14px 10px;border-radius:10px;border:2px solid var(--ink);background:var(--card);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px}
.btn b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--ink);color:var(--card);font-size:12px}
.btn.save{background:var(--red);border-color:var(--red);color:#fff}.btn.save b{background:#fff;color:var(--red)}
.btn:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.btn:disabled{opacity:.55;cursor:default}
.status{margin:-4px 0 0;min-height:1.2em;font-size:13.5px;color:var(--muted)}
.status.ok{color:var(--ok)}
.cap-label{font:600 12px var(--label);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:-8px}
.cap{width:100%;box-sizing:border-box;font:14px/1.45 var(--body);color:var(--ink);background:var(--wall);border:1px solid var(--line);border-radius:8px;padding:10px;resize:vertical}
.done{display:flex;gap:8px;align-items:center;font-size:14px}
.done input{width:20px;height:20px;accent-color:var(--ok)}
.post.is-done{opacity:.6}
.day{font-family:var(--display);font-weight:400;font-size:30px;text-transform:uppercase;margin:14px 0 -6px;letter-spacing:.01em}
.day:first-of-type{margin-top:0}
.empty{background:var(--card);border:1px dashed var(--line);border-radius:14px;padding:20px;text-align:center;color:var(--muted)}
footer{color:var(--muted);font-size:12.5px}
@media (max-width:360px){.one{margin-top:6px;width:100%;font:600 13px/1.2 var(--label);text-transform:uppercase;letter-spacing:.05em;padding:10px 6px;border-radius:8px;border:1.5px solid var(--ink);background:var(--card);color:var(--ink);cursor:pointer;min-height:40px}
.one.ok{border-color:var(--ok);color:var(--ok)}
.one:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.strip figcaption{z-index:1}
.steps{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<div class="wrap">
  <div>
    <div class="brand"><svg viewBox="0 0 100 86" aria-hidden="true"><path fill-rule="evenodd" d="M0 86 L50 0 L100 86 Z M36.5 74 L50 50.5 L63.5 74 Z"/></svg>Fraternity · @${e(handle)}</div>
    <h1>Klaar om te posten</h1>
    <p class="sub">Bijgewerkt ${e(made)}</p>
  </div>
  <div class="how">
    <b>Zo post je er een</b>
    <ol>
      <li>Tik <b>Download foto 1</b>, <b>2</b>, <b>3</b>… onder elke foto (of <b>Bewaar alle foto's</b> voor alles achter elkaar) en kies "Bewaar afbeelding".</li>
      <li>Tik <b>Kopieer caption</b>.</li>
      <li>In TikTok: <b>+</b> → Foto's → kies de foto's op volgorde → plak de caption → kies een geluid → Plaats.</li>
    </ol>
  </div>
  ${cards || '<p class="empty">Er staan nu geen posts klaar. De volgende verschijnen hier na de ochtendrun.</p>'}
  <footer>Alle feiten komen uit de geverifieerde Fraternity-matchbestanden. Beelden: eigen posters.</footer>
</div>
<script>
(function(){
  var POSTS = ${JSON.stringify(posts.map((p) => ({ id: p.id, date: p.date, n: p.slides.length, text: p.text })))};
  var cache = {};
  function imgAt(i, j){ return document.querySelectorAll('.post')[i].querySelectorAll('.strip img')[j]; }
  function getBlob(i, j){
    var k = i + '-' + j; if (cache[k]) return cache[k];
    var img = imgAt(i, j), src = img.getAttribute('data-src') || img.src;
    if (src.indexOf('data:') === 0) {
      var bin = atob(src.split(',')[1]); var a = new Uint8Array(bin.length);
      for (var x = 0; x < bin.length; x++) a[x] = bin.charCodeAt(x);
      cache[k] = Promise.resolve(new Blob([a], { type: 'image/jpeg' }));
    } else cache[k] = fetch(src).then(function(r){ if (!r.ok) throw new Error(r.status); return r.blob(); });
    return cache[k];
  }
  // Photos are the artifact's own files: fetch them and show them as blob: URLs (the viewer's
  // frame allows blob: images everywhere), one post at a time as it scrolls into view.
  function loadCard(card, i){
    if (card.dataset.loaded) return; card.dataset.loaded = '1';
    card.querySelectorAll('.strip img').forEach(function(img, j){
      if (!img.getAttribute('data-src')) return;
      getBlob(i, j).then(function(b){ img.src = URL.createObjectURL(b); })
        .catch(function(){ delete cache[i + '-' + j]; card.dataset.loaded = ''; var m = document.createElement('div'); m.className = 'err'; m.textContent = 'Foto kon niet laden. Trek de pagina omlaag om te vernieuwen.'; img.parentNode.appendChild(m); });
    });
  }
  var cards = document.querySelectorAll('.post');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (en.isIntersecting) { loadCard(en.target, +en.target.dataset.i); io.unobserve(en.target); } }); }, { rootMargin: '800px 0px' });
    cards.forEach(function(c){ io.observe(c); });
  } else cards.forEach(function(c, i){ loadCard(c, i); });
  if (cards[0]) loadCard(cards[0], 0); if (cards[1]) loadCard(cards[1], 1);
  async function fileAt(i, j){ var p = POSTS[i]; return new File([await getBlob(i, j)], 'fraternity-' + p.date + '-' + (i + 1) + '-' + String(j + 1).padStart(2, '0') + '.jpg', { type: 'image/jpeg' }); }
  function setStatus(i, msg, ok){ var s = document.getElementById('status-' + i); s.textContent = msg; s.className = 'status' + (ok ? ' ok' : ''); }
  var dl = null;
  if (window.claude && window.claude.use) window.claude.use('downloads').then(function(d){ dl = d; }).catch(function(){});
  function key(i){ return 'fraternity-done-' + POSTS[i].id; }
  async function saveOne(i, j, btn){
    var p = POSTS[i];
    var file;
    try { file = await fileAt(i, j); } catch (e) { setStatus(i, 'Foto nog niet geladen. Probeer het zo opnieuw.'); return; }
    if (!dl && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); btn.textContent = '✓ Foto ' + (j + 1); btn.classList.add('ok'); } catch (e) {}
      return;
    }
    if (!dl) { setStatus(i, 'Downloaden lukt hier niet. Houd de foto ingedrukt en kies "Bewaar in Foto’s".'); return; }
    btn.disabled = true;
    try { await dl.save({ filename: file.name, data: file }); btn.textContent = '✓ Foto ' + (j + 1) + ' bewaard'; btn.classList.add('ok'); }
    catch (err) { if (!(err && err.code === 'declined')) setStatus(i, err && err.code === 'rate_limited' ? 'Even wachten en opnieuw tikken.' : 'Downloaden lukt hier niet. Houd de foto ingedrukt en kies "Bewaar in Foto’s".'); }
    btn.disabled = false;
  }
  document.querySelectorAll('.one').forEach(function(b){ b.addEventListener('click', function(){ saveOne(+b.dataset.post, +b.dataset.slide, b); }); });
  POSTS.forEach(function(p, i){
    var done = document.getElementById('done-' + i), card = document.querySelectorAll('.post')[i];
    try { if (localStorage.getItem(key(i)) === '1') { done.checked = true; card.classList.add('is-done'); } } catch (e) {}
    done.addEventListener('change', function(){ card.classList.toggle('is-done', done.checked); try { localStorage.setItem(key(i), done.checked ? '1' : '0'); } catch (e) {} });

    document.getElementById('copy-' + i).addEventListener('click', function(){
      var ta = document.getElementById('cap-' + i);
      function fallback(){ ta.focus(); ta.select(); setStatus(i, 'Tekst is geselecteerd: tik Kopiëren.'); }
      try { navigator.clipboard.writeText(p.text).then(function(){ setStatus(i, 'Caption gekopieerd. Plak hem in TikTok.', true); }, fallback); } catch (e) { fallback(); }
    });

    var btn = document.getElementById('save-' + i);
    btn.addEventListener('click', async function(){
      var files = [];
      try { for (var j = 0; j < p.n; j++) files.push(await fileAt(i, j)); } catch (e) { setStatus(i, 'Foto\u2019s nog niet geladen. Probeer het zo opnieuw.'); return; }
      // Outside the Claude app (normal phone browser): one share sheet with all photos.
      if (!dl && navigator.canShare && navigator.canShare({ files: files })) {
        try { await navigator.share({ files: files }); setStatus(i, 'Gedeeld. Kies "Bewaar ' + p.n + ' afbeeldingen".', true); } catch (e) { setStatus(i, 'Niet opgeslagen.'); }
        return;
      }
      if (!dl) { setStatus(i, 'Opslaan lukt hier niet. Houd een foto ingedrukt en kies "Bewaar in Foto’s".'); return; }
      btn.disabled = true;
      for (var j2 = 0; j2 < files.length; j2++) {
        setStatus(i, 'Foto ' + (j2 + 1) + ' van ' + files.length + '…');
        try { await dl.save({ filename: files[j2].name, data: files[j2] }); }
        catch (err) {
          if (err && err.code === 'rate_limited') { await new Promise(function(r){ setTimeout(r, 1200); }); j2--; continue; }
          setStatus(i, err && err.code === 'declined' ? 'Gestopt bij foto ' + (j2 + 1) + '. Tik opnieuw om verder te gaan.' : 'Opslaan lukt hier niet. Houd een foto ingedrukt en kies "Bewaar in Foto’s".');
          btn.disabled = false; return;
        }
      }
      btn.disabled = false;
      setStatus(i, 'Alle ' + files.length + ' foto’s bewaard. Nu de caption kopiëren.', true);
    });
  });
})();
</script>
`;
}

// Writes the page plus <page>.files.json: {publishedPath: localSlidePath} to pass as the
// Artifact tool's `files` when publishing (slides are served next to the page).
function writePhonePack(ctx, file, opts = {}) {
  const { html, files, count } = buildPhonePack(ctx, opts);
  const out = file || path.join(ctx.config.paths.data, 'phone', 'klaar-om-te-posten.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  const map = out.replace(/\.html$/, '') + '.files.json';
  fs.writeFileSync(map, JSON.stringify(files, null, 2));
  return { page: out, files: map, posts: count, slides: Object.keys(files).length };
}
module.exports = { buildPhonePack, writePhonePack, pickPosts };
