'use strict';
// "Op deze dag": catalog matches whose anniversary falls in the coming window. Pure date maths
// on verified dates – no external claims.
const { loadCatalog } = require('./fraternity-catalog');
const { localYmd, addDays } = require('../../core/util');

module.exports = function anniversaries({ config }) {
  return {
    name: 'anniversaries',
    async collect({ today }) {
      const tz = config.schedule.timezone;
      const start = today || localYmd(new Date(), tz);
      const win = config.ideation.anniversaryWindowDays;
      const out = [];
      for (const m of loadCatalog(config)) {
        for (let i = 0; i <= win; i++) {
          const day = addDays(start, i);
          if (day.slice(5) === m.match.date.slice(5) && day > m.match.date) {
            const years = Number(day.slice(0, 4)) - Number(m.match.date.slice(0, 4));
            out.push({ source: 'anniversaries', kind: 'anniversary', key: `${m.slug}@${day}`, slug: m.slug, date: day, years,
              title: `${years} jaar geleden: ${m.match.home.name} ${m.match.score.home}-${m.match.score.away} ${m.match.away.name}`, url: null });
          }
        }
      }
      return out;
    },
  };
};
