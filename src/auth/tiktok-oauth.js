'use strict';
// TikTok Login Kit (OAuth 2.0, web flow). Tokens live in data/tiktok-token.json (gitignored).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish', 'video.upload'];
const API = 'https://open.tiktokapis.com';

function tokenFile(config) { return path.join(config.paths.data, 'tiktok-token.json'); }
function readToken(config) { try { return JSON.parse(fs.readFileSync(tokenFile(config), 'utf8')); } catch { return null; } }
function writeToken(config, t) {
  fs.mkdirSync(config.paths.data, { recursive: true });
  const now = Date.now();
  const tok = { ...t, obtained_at: now, access_expires_at: now + (t.expires_in || 0) * 1000, refresh_expires_at: now + (t.refresh_expires_in || 0) * 1000 };
  fs.writeFileSync(tokenFile(config), JSON.stringify(tok, null, 2), { mode: 0o600 });
  return tok;
}

function authorizeUrl(config, state = crypto.randomBytes(12).toString('hex')) {
  const q = new URLSearchParams({ client_key: config.env.TIKTOK_CLIENT_KEY, scope: SCOPES.join(','), response_type: 'code', redirect_uri: config.env.TIKTOK_REDIRECT_URI, state });
  return { url: `https://www.tiktok.com/v2/auth/authorize/?${q}`, state };
}

async function tokenRequest(config, params) {
  const res = await fetch(`${API}/v2/oauth/token/`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
    body: new URLSearchParams({ client_key: config.env.TIKTOK_CLIENT_KEY, client_secret: config.env.TIKTOK_CLIENT_SECRET, ...params }),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`TikTok token: ${j.error || res.status} ${j.error_description || ''}`);
  return writeToken(config, j);
}
const exchangeCode = (config, code) => tokenRequest(config, { code, grant_type: 'authorization_code', redirect_uri: config.env.TIKTOK_REDIRECT_URI });

async function getAccessToken(config) {
  let t = readToken(config);
  if (!t) return null;
  if (Date.now() > t.access_expires_at - 5 * 60e3) {
    if (Date.now() > t.refresh_expires_at) return null;
    t = await tokenRequest(config, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  }
  return t.access_token;
}

async function api(config, method, pathname, body) {
  const token = await getAccessToken(config);
  if (!token) throw Object.assign(new Error('TikTok not connected (run: npm run auth, or use the dashboard "Koppel TikTok")'), { code: 'not_connected' });
  const res = await fetch(`${API}${pathname}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j.error && j.error.code && j.error.code !== 'ok')) {
    throw Object.assign(new Error(`TikTok ${pathname}: ${j.error?.code || res.status} ${j.error?.message || ''}`), { code: j.error?.code, status: res.status });
  }
  return j.data;
}

module.exports = { SCOPES, authorizeUrl, exchangeCode, getAccessToken, readToken, api };
