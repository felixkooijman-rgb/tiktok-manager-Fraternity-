'use strict';
// Licensed stock sources. Each result carries its licence + attribution so QA can enforce rights.
// Only used for supporting slides (e.g. stadium atmosphere) – never to depict a specific
// real match unless the photo's own description says so.
const fs = require('fs');
const path = require('path');

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'fraternity-tiktok-agent/1.0', ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return res.json();
}
async function download(url, file) {
  const res = await fetch(url, { headers: { 'user-agent': 'fraternity-tiktok-agent/1.0' } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
function wrap(name, searchFn) {
  return {
    name,
    async search(query, n = 5) { return (await searchFn(query, n)).map((r) => ({ ...r, provider: name, aiGenerated: false })); },
    async fetch(result, file) {
      await download(result.downloadUrl, file);
      if (result.trackDownload) fetch(result.trackDownload).catch(() => {});
      return { ...result, path: file };
    },
  };
}

module.exports.unsplash = ({ config }) => {
  const key = config.env.UNSPLASH_ACCESS_KEY; if (!key) return null;
  return wrap('unsplash', async (q, n) => {
    const j = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`, { Authorization: `Client-ID ${key}` });
    return j.results.map((p) => ({ id: p.id, description: p.alt_description || p.description || '', downloadUrl: p.urls.full, trackDownload: `${p.links.download_location}&client_id=${key}`,
      sourceUrl: p.links.html, source: `Unsplash – ${p.user.name}`, license: { type: 'Unsplash License', url: 'https://unsplash.com/license', commercialUse: true, attributionRequired: false, attribution: `Foto: ${p.user.name} / Unsplash` } }));
  });
};
module.exports.pexels = ({ config }) => {
  const key = config.env.PEXELS_API_KEY; if (!key) return null;
  return wrap('pexels', async (q, n) => {
    const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`, { Authorization: key });
    return j.photos.map((p) => ({ id: String(p.id), description: p.alt || '', downloadUrl: p.src.large2x, sourceUrl: p.url, source: `Pexels – ${p.photographer}`,
      license: { type: 'Pexels License', url: 'https://www.pexels.com/license/', commercialUse: true, attributionRequired: false, attribution: `Foto: ${p.photographer} / Pexels` } }));
  });
};
module.exports.pixabay = ({ config }) => {
  const key = config.env.PIXABAY_API_KEY; if (!key) return null;
  return wrap('pixabay', async (q, n) => {
    const j = await getJson(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&orientation=vertical&per_page=${Math.max(3, n)}&safesearch=true`);
    return j.hits.map((p) => ({ id: String(p.id), description: p.tags, downloadUrl: p.largeImageURL, sourceUrl: p.pageURL, source: `Pixabay – ${p.user}`,
      license: { type: 'Pixabay Content License', url: 'https://pixabay.com/service/license-summary/', commercialUse: true, attributionRequired: false, attribution: `Beeld: ${p.user} / Pixabay` } }));
  });
};
const OK_LICENSES = /^(cc0|public domain|pd|cc by( |-)?\d|cc by-sa( |-)?\d)/i;
module.exports.wikimedia = () => wrap('wikimedia', async (q, n) => {
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${n * 2}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600`);
  return Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii) return null;
    const md = ii.extmetadata || {};
    const lic = (md.LicenseShortName?.value || '').trim();
    if (!OK_LICENSES.test(lic)) return null; // skip non-free / unclear licences
    const artist = (md.Artist?.value || 'onbekend').replace(/<[^>]+>/g, '').trim();
    return { id: String(p.pageid), description: (md.ImageDescription?.value || p.title).replace(/<[^>]+>/g, '').slice(0, 200), downloadUrl: ii.thumburl || ii.url, sourceUrl: ii.descriptionurl, source: `Wikimedia Commons – ${artist}`,
      license: { type: lic, url: md.LicenseUrl?.value || ii.descriptionurl, commercialUse: true, attributionRequired: !/cc0|public domain|^pd/i.test(lic), shareAlike: /sa/i.test(lic), attribution: `Foto: ${artist} / Wikimedia Commons (${lic})` } };
  }).filter(Boolean).slice(0, n);
});
module.exports.download = download;
