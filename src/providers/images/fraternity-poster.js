'use strict';
// Own artwork: the rendered Fraternity posters. Renders a preview with the Fraternity pipeline
// when a verified match file exists but no poster output yet (never with --force).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = function fraternityPoster({ config, log }) {
  return {
    name: 'fraternity-poster',
    license: { type: 'own-work', holder: 'Fraternity', commercialUse: true, attributionRequired: false },
    async forMatch(entry, variant = 'framed') {
      let p = entry.posters[variant] || entry.posters.default || Object.values(entry.posters)[0];
      if (!p) {
        log.info(`render poster preview for ${entry.slug}`);
        try {
          execFileSync('node', ['poster/render.js', path.relative(config.paths.fraternity, entry.file), '--no-print'], { cwd: config.paths.fraternity, stdio: 'inherit' });
        } catch (e) { throw new Error(`poster render failed for ${entry.slug} (fix the match data in the Fraternity repo): ${e.message}`); }
        const od = path.join(config.paths.fraternity, 'output', variant ? `${entry.slug}-${variant}` : entry.slug);
        const alt = path.join(config.paths.fraternity, 'output', entry.slug);
        const dir = fs.existsSync(path.join(od, 'preview.jpg')) ? od : alt;
        p = { preview: path.join(dir, 'preview.jpg'), dir };
      }
      return { path: p.preview, provider: this.name, source: `Fraternity poster ${entry.slug}${variant ? ` (${variant})` : ''}`, sourceUrl: null, license: this.license, aiGenerated: false };
    },
  };
};
