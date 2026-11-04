'use strict';
// Plugin registry: every provider (LLM, image source, research source, publisher, media host,
// analytics) registers under a kind + name. New models/tools/platforms = one new file + one line here.
const providers = {};

function register(kind, name, factory) {
  providers[kind] = providers[kind] || {};
  providers[kind][name] = factory;
}
function list(kind) { return Object.keys(providers[kind] || {}); }
function create(kind, name, ctx) {
  const f = (providers[kind] || {})[name];
  if (!f) throw new Error(`Unknown ${kind} provider "${name}". Registered: ${list(kind).join(', ')}`);
  return f(ctx);
}

function loadBuiltins() {
  if (loadBuiltins.done) return; loadBuiltins.done = true;
  register('llm', 'anthropic', (c) => require('../providers/llm/anthropic')(c));
  register('llm', 'none', (c) => require('../providers/llm/none')(c));

  register('research', 'fraternity-catalog', (c) => require('../providers/research/fraternity-catalog')(c));
  register('research', 'anniversaries', (c) => require('../providers/research/anniversaries')(c));
  register('research', 'rss-news', (c) => require('../providers/research/rss-news')(c));
  register('research', 'google-trends', (c) => require('../providers/research/google-trends')(c));
  register('research', 'shop-products', (c) => require('../providers/research/shop-products')(c));
  register('research', 'manual-trends', (c) => require('../providers/research/manual-trends')(c));

  register('images', 'fraternity-poster', (c) => require('../providers/images/fraternity-poster')(c));
  register('images', 'unsplash', (c) => require('../providers/images/stock').unsplash(c));
  register('images', 'pexels', (c) => require('../providers/images/stock').pexels(c));
  register('images', 'pixabay', (c) => require('../providers/images/stock').pixabay(c));
  register('images', 'wikimedia', (c) => require('../providers/images/stock').wikimedia(c));
  register('aiImages', 'openai', (c) => require('../providers/images/ai-openai')(c));
  register('aiImages', 'none', () => null);

  register('publish', 'tiktok', (c) => require('../providers/publish/tiktok')(c));
  register('publish', 'manual-export', (c) => require('../providers/publish/manual-export')(c));

  register('hosting', 'command', (c) => require('../providers/hosting/command')(c));
  register('hosting', 'local', (c) => require('../providers/hosting/local')(c));

  register('analytics', 'tiktok-display', (c) => require('../providers/analytics/tiktok-display')(c));
}

module.exports = { register, create, list, loadBuiltins };
