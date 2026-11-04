'use strict';
// Fallback when automatic publishing is unavailable: a ready-to-post folder per post
// (numbered slides + caption.txt + checklist) under data/exports/<date>_<postId>/.
const fs = require('fs');
const path = require('path');
module.exports = function manualExport({ config }) {
  return {
    name: 'manual-export',
    ready: true,
    async publish(post) {
      const dir = path.join(config.paths.exports, `${(post.scheduledAt || new Date().toISOString()).slice(0, 10)}_${post.id}`);
      fs.mkdirSync(dir, { recursive: true });
      post.slides.forEach((s, i) => fs.copyFileSync(s.path, path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`)));
      fs.writeFileSync(path.join(dir, 'caption.txt'), `${post.caption}\n\n${post.hashtags.join(' ')}\n`);
      fs.writeFileSync(path.join(dir, 'README.txt'), [
        `Titel: ${post.title}`, `Gepland: ${post.scheduledAt || '-'}`, '',
        'Handmatig posten in de TikTok-app:', '1. + → Foto → selecteer 01.jpg … in volgorde', '2. Plak caption.txt', '3. Kies een (trending) geluid',
        post.aiGenerated ? '4. Zet "AI-gegenereerde content" AAN' : '4. —', '5. Zet in het dashboard de status op "gepubliceerd" en plak de TikTok-link',
        '', 'Bronnen / rechten:', ...post.credits.map((c) => `- ${c}`),
      ].join('\n'));
      return { exportDir: dir, mode: 'manual' };
    },
  };
};
