'use strict';
// TikTok Creative Center, Pinterest and Instagram have no public API for this use and may not be
// scraped. Trend observations go in config/trends.json (by you, or by a Claude Code session doing
// web research); they are read here as signals – formats/sounds/angles, never content to copy.
const path = require('path');
const { readJson } = require('../../core/util');
module.exports = function manualTrends({ config }) {
  return {
    name: 'manual-trends',
    async collect() {
      const list = readJson(path.join(config.paths.root, 'config', 'trends.json'), { trends: [] }).trends || [];
      return list.filter((t) => !t.expires || t.expires >= new Date().toISOString().slice(0, 10))
        .map((t) => ({ source: `manual:${t.platform || 'tiktok'}`, kind: 'format-trend', key: `mt:${t.title}`, title: t.title, url: t.url || null, format: t.format || null, notes: t.notes || '' }));
    },
  };
};
