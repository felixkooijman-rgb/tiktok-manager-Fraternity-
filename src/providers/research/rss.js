'use strict';
// Minimal RSS/Atom parser (titles, links, dates) – enough for trend signals.
function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
function tag(block, name) { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; }
function parseRss(xml) {
  const items = [];
  const re = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[0];
    let link = tag(b, 'link');
    if (!link) { const l = b.match(/<link[^>]*href="([^"]+)"/i); link = l ? l[1] : ''; }
    items.push({ title: tag(b, 'title'), link, date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published'), summary: tag(b, 'description').slice(0, 400), traffic: tag(b, 'ht:approx_traffic') });
  }
  return items;
}
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'fraternity-tiktok-agent/1.0 (+content research)' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}
module.exports = { parseRss, fetchText };
