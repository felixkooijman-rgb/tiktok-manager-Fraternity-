'use strict';
// Reads the verified match files + rendered posters from the Fraternity repo. This is the
// primary, fact-checked knowledge base: captions may only state facts that appear here.
const fs = require('fs');
const path = require('path');
const { readJson } = require('../../core/util');

function loadCatalog(config) {
  const dir = config.paths.fraternity;
  const mdir = path.join(dir, 'matches');
  if (!fs.existsSync(mdir)) return [];
  const out = [];
  for (const f of fs.readdirSync(mdir).filter((x) => /^\d{4}-.*\.json$/.test(x)).sort()) {
    const data = readJson(path.join(mdir, f));
    if (!data || !data.match) continue;
    const theme = readJson(path.join(dir, 'poster', 'themes', `${data.theme}.json`), {});
    const posters = {};
    for (const variant of [null, ...Object.keys(data.variants || {})]) {
      const od = path.join(dir, 'output', variant ? `${data.slug}-${variant}` : data.slug);
      const preview = path.join(od, 'preview.jpg');
      if (fs.existsSync(preview)) posters[variant || 'default'] = { preview, shop: path.join(od, 'shop-2048.jpg'), dir: od };
    }
    const v = data.verification || {};
    out.push({
      slug: data.slug,
      file: path.join(mdir, f),
      match: data.match,
      goals: data.goals || [],
      featured: data.featured || {},
      lineups: data.lineups,
      theme,
      posters,
      hasPoster: Object.keys(posters).length > 0,
      collection: data.collection || null,
      sources: v.sources || [],
      confirmed: v.confirmed || [],
      needsManualCheck: v.needs_manual_check || [],
    });
  }
  return out;
}

module.exports = function fraternityCatalog({ config }) {
  return {
    name: 'fraternity-catalog',
    async collect() {
      const catalog = loadCatalog(config);
      return catalog.map((m) => ({
        source: 'fraternity-catalog', kind: 'catalog-item', key: m.slug,
        title: `${m.match.home.name} ${m.match.score.home}-${m.match.score.away} ${m.match.away.name} (${m.match.date})`,
        url: null, slug: m.slug, hasPoster: m.hasPoster,
      }));
    },
  };
};
module.exports.loadCatalog = loadCatalog;
