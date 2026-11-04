'use strict';
// Google Trends "trending now" RSS for the configured country, filtered on football keywords.
const { parseRss, fetchText } = require('./rss');
module.exports = function googleTrends({ config, log }) {
  return {
    name: 'google-trends',
    async collect() {
      const geo = config.research.googleTrendsGeo;
      let items = [];
      try { items = parseRss(await fetchText(`https://trends.google.com/trending/rss?geo=${geo}`)); } catch (e) { log.warn(`google-trends: ${e.message}`); return []; }
      const kw = config.research.footballKeywords;
      return items.filter((i) => kw.some((k) => `${i.title} ${i.summary}`.toLowerCase().includes(k)))
        .map((i) => ({ source: 'google-trends', kind: 'trend', key: `gt:${i.title}`, title: i.title, url: `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(i.title)}`, traffic: i.traffic }));
    },
  };
};
