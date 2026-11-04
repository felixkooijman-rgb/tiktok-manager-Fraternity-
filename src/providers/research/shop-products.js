'use strict';
// Products in the Fraternity Shopify shop (public /products.json). Used as a SIGNAL only:
// "this moment is sold as a poster but has no verified match file / TikTok post yet" → poster
// request for the football-poster-designer agent. Product titles are never used as facts.
const { loadCatalog } = require('./fraternity-catalog');
module.exports = function shopProducts({ config, log }) {
  return {
    name: 'shop-products',
    async collect() {
      const url = config.research.shopProductsUrl; if (!url) return [];
      let products = [];
      try {
        const res = await fetch(url, { headers: { 'user-agent': 'fraternity-tiktok-agent/1.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        products = (await res.json()).products || [];
      } catch (e) { log.warn(`shop-products: ${e.message}`); return []; }
      const catalog = loadCatalog(config);
      const base = new URL(url).origin;
      return products.filter((p) => /poster|moment|goal|victory|wins|final|stadion|kuip/i.test(`${p.title} ${p.product_type} ${(p.tags || []).join(' ')}`)).map((p) => {
        const text = p.title.toLowerCase();
        const related = catalog.filter((m) => [m.match.home.name, m.match.away.name, m.featured.player?.display].filter(Boolean).every((n) => text.includes(String(n).toLowerCase().split(' ').slice(-1)[0]))).map((m) => m.slug);
        return { source: 'shop-products', kind: 'shop-product', key: `shop:${p.handle}`, title: p.title, url: `${base}/products/${p.handle}`, related };
      });
    },
  };
};
