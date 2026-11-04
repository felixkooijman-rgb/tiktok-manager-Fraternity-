'use strict';
// Slide templates (HTML → 1080×1920 JPEG via Chromium). House style = Fraternity posters:
// Anton (display) + Oswald (text), uppercase, thin rules, dark #161616 frame, club colours,
// triangle mark + FRATERNITY wordmark. Add a template = add a function to TEMPLATES.
const fs = require('fs');
const path = require('path');
const { escapeHtml: e } = require('../core/util');

const W = 1080, H = 1920;
const INK = '#161616';
const WALL = '#EFECE6';

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', ttf: 'font/ttf', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function palette(theme = {}) {
  const c = theme.colors || {};
  const shirt = theme.shirt || {};
  const cols = [shirt.base || c.background, ...(shirt.layers || []).map((l) => l.color), c.text, c.accent].filter(Boolean);
  const uniq = [...new Set(cols.map((x) => x.toUpperCase()))];
  const primary = (shirt.base || c.background || '#E1181F').toUpperCase();
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  // Accent text sits on #161616: needs real contrast, so only fairly light colours qualify.
  const accent = uniq.find((x) => lum(x) > 0.38 && lum(x) < 0.92) || '#FFFFFF';
  return { all: uniq.slice(0, 5), primary, accent };
}

function baseCss(fonts) {
  return `
  @font-face{font-family:Anton;src:url(${dataUri(path.join(fonts, 'Anton-Regular.ttf'))})}
  @font-face{font-family:Oswald;src:url(${dataUri(path.join(fonts, 'Oswald-Variable.ttf'))});font-weight:200 700}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;background:${INK};color:#fff;overflow:hidden}
  body{font-family:Oswald,sans-serif;text-transform:uppercase;position:relative}
  .safe{position:absolute;left:80px;right:80px;top:150px;bottom:330px;display:flex;flex-direction:column}
  .anton{font-family:Anton,sans-serif;font-weight:400;letter-spacing:1px;line-height:.95}
  .rule{height:3px;background:currentColor;opacity:.85;margin:28px 0}
  .kicker{font-size:40px;font-weight:600;letter-spacing:6px}
  .meta{font-size:34px;font-weight:500;letter-spacing:3px;opacity:.92}
  .brand{position:absolute;right:80px;bottom:250px;display:flex;align-items:center;gap:12px;font-size:34px;font-weight:700;letter-spacing:2px}
  .brand svg{height:28px;width:auto;fill:currentColor}
  .stripes{position:absolute;left:0;right:0;bottom:0;height:22px;display:flex}
  .stripes i{flex:1}
  .bgimg{position:absolute;inset:-40px;background-size:cover;background-position:center 35%;filter:blur(18px) saturate(1.1);transform:scale(1.08)}
  .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(22,22,22,.55),rgba(22,22,22,.82) 60%,rgba(22,22,22,.95))}
  `;
}

const mark = (svg) => svg.replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '');
const brand = (ctx) => `<div class="brand">${mark(ctx.markSvg)}<span>${e(ctx.brandName)}</span></div>`;
const stripes = (pal) => `<div class="stripes">${pal.all.map((c) => `<i style="background:${c}"></i>`).join('')}</div>`;

const TEMPLATES = {
  // Big hook over a blurred version of the poster.
  hook: (s, ctx) => `
    ${s.bg ? `<div class="bgimg" style="background-image:url(${dataUri(s.bg)})"></div><div class="shade"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 20%,${ctx.pal.primary}cc,${INK} 70%)"></div>`}
    <div class="safe" style="justify-content:center">
      ${s.kicker ? `<div class="kicker" style="color:${ctx.pal.accent}">${e(s.kicker)}</div><div class="rule" style="width:120px;color:${ctx.pal.accent}"></div>` : ''}
      <div class="anton" style="font-size:${s.size || 170}px">${e(s.title)}</div>
      ${s.sub ? `<div class="rule"></div><div class="meta" style="font-size:42px">${e(s.sub)}</div>` : ''}
      ${s.footer ? `<div class="meta" style="margin-top:auto;font-size:34px;opacity:.8">${e(s.footer)}</div>` : ''}
    </div>${brand(ctx)}${stripes(ctx.pal)}`,

  // The poster itself, as on a wall: dark background, title line above.
  // The poster as on a wall (light background so the dark frame of framed variants stays visible).
  poster: (s, ctx) => `
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${WALL} 0%,#E2DDD4 100%)"></div>
    <div style="position:absolute;top:120px;left:80px;right:80px;text-align:center;color:${INK}">
      ${s.label ? `<div class="anton" style="font-size:64px">${e(s.label)}</div>` : ''}
      ${s.sub ? `<div class="meta" style="margin-top:10px">${e(s.sub)}</div>` : ''}
    </div>
    <img src="${dataUri(s.image)}" style="position:absolute;left:${(W - 840) / 2}px;top:310px;width:840px;height:1260px;object-fit:contain;filter:drop-shadow(0 28px 36px rgba(0,0,0,.35))">
    <div style="color:${INK}">${brand(ctx)}</div>${stripes(ctx.pal)}`,

  // Fact list: rows of [big value, label]. Only verified data is passed in.
  facts: (s, ctx) => `
    <div class="safe">
      <div class="kicker" style="color:${ctx.pal.accent}">${e(s.kicker || '')}</div>
      <div class="anton" style="font-size:96px;margin-top:16px">${e(s.title)}</div>
      <div class="rule"></div>
      ${s.rows.map((r) => `<div style="display:flex;align-items:baseline;gap:36px;padding:18px 0;border-bottom:2px solid rgba(255,255,255,.18)">
        <div class="anton" style="font-size:80px;min-width:250px;color:${r.hl ? ctx.pal.accent : '#fff'}">${e(r.value)}</div>
        <div style="font-size:44px;font-weight:600;letter-spacing:2px">${e(r.label)}</div></div>`).join('')}
      ${s.image ? `<div style="flex:1;min-height:0;margin-top:50px;display:flex;justify-content:center"><img src="${dataUri(s.image)}" style="height:100%;max-width:100%;object-fit:contain;box-shadow:0 20px 50px rgba(0,0,0,.6)"></div>` : ''}
      ${s.footer ? `<div class="meta" style="margin-top:auto;font-size:30px;opacity:.75;text-transform:none">${e(s.footer)}</div>` : ''}
    </div>${brand(ctx)}${stripes(ctx.pal)}`,

  // 2×2 grid of posters with numbers.
  grid: (s, ctx) => `
    <div style="position:absolute;top:120px;left:80px;right:80px;text-align:center"><div class="anton" style="font-size:96px">${e(s.title)}</div>
    ${s.sub ? `<div class="meta" style="margin-top:12px">${e(s.sub)}</div>` : ''}</div>
    <div style="position:absolute;top:400px;left:90px;right:90px;display:grid;grid-template-columns:1fr 1fr;gap:40px 50px">
      ${s.images.map((im, i) => `<div style="position:relative"><img src="${dataUri(im)}" style="width:100%;aspect-ratio:2/3;object-fit:cover;box-shadow:0 16px 40px rgba(0,0,0,.6)">
      <div class="anton" style="position:absolute;left:-14px;top:-18px;background:${ctx.pal.accent};color:${INK};font-size:54px;width:78px;height:78px;display:flex;align-items:center;justify-content:center">${i + 1}</div></div>`).join('')}
    </div>${brand(ctx)}${stripes(ctx.pal)}`,

  // Colour swatches + short lines: "from shirt to poster".
  swatches: (s, ctx) => `
    <div class="safe">
      <div class="kicker" style="color:${ctx.pal.accent}">${e(s.kicker || '')}</div>
      <div class="anton" style="font-size:110px;margin-top:16px">${e(s.title)}</div>
      <div class="rule"></div>
      <div style="display:flex;gap:24px;margin:20px 0 50px">${s.colors.map((c) => `<div style="flex:1"><div style="height:300px;background:${c};border:3px solid rgba(255,255,255,.35)"></div><div class="meta" style="margin-top:14px;font-size:30px">${c}</div></div>`).join('')}</div>
      ${s.lines.map((l) => `<div style="font-size:40px;font-weight:500;letter-spacing:1px;margin:14px 0;text-transform:none">— ${e(l)}</div>`).join('')}
    </div>${brand(ctx)}${stripes(ctx.pal)}`,

  // Zoomed / blurred part of an image as a guessing clue. zoom = scale, fx/fy = focus point (0–1).
  clue: (s, ctx) => `
    <div style="position:absolute;inset:0;overflow:hidden">
      <img src="${dataUri(s.image)}" style="position:absolute;left:50%;top:50%;width:${W * (s.zoom || 1)}px;height:auto;transform:translate(${-(s.fx ?? 0.5) * 100}%,${-(s.fy ?? 0.5) * 100}%);${s.blur ? `filter:blur(${s.blur}px);` : ''}">
    </div>
    <div class="shade" style="background:linear-gradient(180deg,rgba(22,22,22,.85),rgba(22,22,22,.1) 28%,rgba(22,22,22,.1) 62%,rgba(22,22,22,.92))"></div>
    <div class="safe" style="justify-content:space-between">
      <div><div class="kicker" style="color:${ctx.pal.accent}">${e(s.kicker || '')}</div>
      <div class="anton" style="font-size:${s.size || 120}px;margin-top:14px">${e(s.title)}</div></div>
      <div>${(s.hints || []).map((h) => `<div class="meta" style="font-size:44px;margin-top:10px">${e(h)}</div>`).join('')}
      ${s.footer ? `<div class="meta" style="font-size:32px;opacity:.8;margin-top:22px">${e(s.footer)}</div>` : ''}</div>
    </div>${brand(ctx)}${stripes(ctx.pal)}`,

  // Closing slide.
  cta: (s, ctx) => `
    <div class="safe" style="justify-content:center;align-items:center;text-align:center">
      <div style="width:170px;color:#fff">${mark(ctx.markSvg).replace('<svg', '<svg style="width:170px;height:auto;fill:#fff"')}</div>
      <div class="anton" style="font-size:150px;margin-top:40px;letter-spacing:6px">${e(ctx.brandName)}</div>
      <div class="rule" style="width:420px"></div>
      <div class="anton" style="font-size:84px;color:${ctx.pal.accent};margin-top:10px">${e(s.title)}</div>
      ${s.sub ? `<div class="meta" style="margin-top:30px;font-size:40px">${e(s.sub)}</div>` : ''}
    </div>${stripes(ctx.pal)}`,

  // AI or stock photo full-bleed with headline (credit printed when required by licence).
  photo: (s, ctx) => `
    <img src="${dataUri(s.image)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div class="shade" style="background:linear-gradient(180deg,rgba(22,22,22,.1),rgba(22,22,22,.25) 50%,rgba(22,22,22,.9))"></div>
    <div class="safe" style="justify-content:flex-end"><div class="anton" style="font-size:120px">${e(s.title || '')}</div>
    ${s.sub ? `<div class="meta" style="margin-top:16px">${e(s.sub)}</div>` : ''}</div>
    ${s.credit ? `<div style="position:absolute;left:80px;bottom:255px;font-size:24px;text-transform:none;opacity:.8">${e(s.credit)}</div>` : ''}
    ${brand(ctx)}${stripes(ctx.pal)}`,
};

async function renderSlides(specs, { outDir, theme, config, browser }) {
  const fonts = config.paths.fonts;
  const markFile = path.join(config.paths.fraternity, 'poster', 'assets', 'brand', 'fraternity-mark.svg');
  const ctx = {
    pal: palette(theme),
    markSvg: fs.existsSync(markFile) ? fs.readFileSync(markFile, 'utf8') : '<svg viewBox="0 0 100 86"><path fill-rule="evenodd" d="M0 86 L50 0 L100 86 Z M36.5 74 L50 50.5 L63.5 74 Z"/></svg>',
    brandName: (config.brand.name || 'Fraternity').toUpperCase(),
  };
  const css = baseCss(fonts);
  fs.mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const out = [];
  try {
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const tpl = TEMPLATES[s.type];
      if (!tpl) throw new Error(`unknown slide template ${s.type}`);
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${tpl(s, ctx)}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      // Fit: shrink display text that is wider than its box, then QA: nothing outside the canvas.
      const overflow = await page.evaluate((w) => {
        for (const el of document.querySelectorAll('.anton')) {
          let fs = parseFloat(getComputedStyle(el).fontSize);
          while (el.scrollWidth > el.clientWidth + 1 && fs > 40) { fs -= 4; el.style.fontSize = fs + 'px'; }
        }
        return [...document.querySelectorAll('.safe div:not(:has(img))')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > w - 30 || r.left < 30 || el.scrollWidth > el.clientWidth + 2); }).map((el) => el.textContent.slice(0, 40));
      }, W);
      const file = `${String(i + 1).padStart(2, '0')}-${s.type}.jpg`;
      await page.screenshot({ path: path.join(outDir, file), type: 'jpeg', quality: 92 });
      out.push({ file, path: path.join(outDir, file), type: s.type, width: W, height: H, overflow, text: [s.kicker, s.title, s.sub, s.footer, ...(s.rows || []).map((r) => `${r.value} ${r.label}`), ...(s.lines || [])].filter(Boolean).join(' | ') });
    }
  } finally { await page.close(); }
  return out;
}

module.exports = { renderSlides, palette, TEMPLATES, W, H };
