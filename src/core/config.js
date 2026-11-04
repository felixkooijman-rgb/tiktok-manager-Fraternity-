'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Minimal .env loader (no dependency). Existing env vars win.
function loadEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

let cached;
function getConfig() {
  if (cached) return cached;
  loadEnv();
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'agent.config.json'), 'utf8'));
  cfg.paths = {
    root: ROOT,
    data: path.resolve(ROOT, process.env.DATA_DIR || 'data'),
    fraternity: path.resolve(ROOT, process.env.FRATERNITY_DIR || '../Fraternity'),
  };
  cfg.paths.posts = path.join(cfg.paths.data, 'posts');
  cfg.paths.exports = path.join(cfg.paths.data, 'exports');
  cfg.paths.fonts = path.join(cfg.paths.fraternity, 'poster', 'fonts');
  cfg.env = process.env;
  cached = cfg;
  return cfg;
}

module.exports = { getConfig, ROOT };
