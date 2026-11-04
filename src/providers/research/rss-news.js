'use strict';
// Football news headlines, matched against clubs/players in the Fraternity catalog. News-driven
// ideas are ALWAYS flagged for approval and must link to the article they react to.
const { parseRss, fetchText } = require('./rss');
const { loadCatalog } = require('./fraternity-catalog');

function entitiesOf(m) {
  const e = new Set([m.match.home.name, m.match.away.name]);
  const p = m.featured.player; if (p) { e.add(p.full_name); e.add(p.full_name.split(' ').slice(-1)[0]); }
  return [...e].filter((x) => x && x.length > 3);
}

module.exports = function rssNews({ config, log }) {
  return {
    name: 'rss-news',
    async collect() {
      const catalog = loadCatalog(config);
      const out = [];
      for (const feed of config.research.rssFeeds) {
        let items = [];
        try { items = parseRss(await fetchText(feed.url)); } catch (e) { log.warn(`rss ${feed.name}: ${e.message}`); continue; }
        for (const it of items.slice(0, 40)) {
          const text = `${it.title} ${it.summary}`.toLowerCase();
          const related = catalog.filter((m) => entitiesOf(m).some((n) => new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text))).map((m) => m.slug);
          out.push({ source: 'rss-news', kind: 'news', key: it.link || it.title, title: it.title, url: it.link, date: it.date, feed: feed.name, related });
        }
      }
      return out;
    },
  };
};
