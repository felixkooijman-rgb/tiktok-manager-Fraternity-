'use strict';
const fs = require('fs');

function readJson(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }

// Wall-clock parts of a Date in a given IANA time zone.
function zonedParts(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, weekday: p.weekday };
}

// Convert a local wall-clock time (YYYY-MM-DD + HH:MM in tz) to a UTC Date.
function zonedToUtc(ymd, hm, tz) {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    guess += Date.UTC(y, m - 1, d, hh, mm) - asUtc;
  }
  return new Date(guess);
}

function localYmd(date, tz) { const p = zonedParts(date, tz); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; }
function addDays(ymd, n) { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function minuteLabel(g) { return g.stoppage ? `${g.minute}+${g.stoppage}'` : `${g.minute}'`; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function sample(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }

module.exports = { readJson, zonedParts, zonedToUtc, localYmd, addDays, minuteLabel, escapeHtml, sample };
