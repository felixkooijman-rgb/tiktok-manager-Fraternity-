'use strict';
// The dashboard serves data/posts/<id>/<file> at /media/<id>/<file>. Use this when the dashboard
// itself runs behind PUBLIC_MEDIA_BASE_URL (e.g. https://media.yourdomain.nl/media), verified in TikTok.
module.exports = function localHost({ config }) {
  const base = config.env.PUBLIC_MEDIA_BASE_URL;
  if (!base) return null;
  return { name: 'local', async upload(post) { return post.slides.map((s) => `${base.replace(/\/$/, '')}/${post.id}/${s.file}`); } };
};
