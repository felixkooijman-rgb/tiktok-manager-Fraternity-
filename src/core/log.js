'use strict';
const ts = () => new Date().toISOString().slice(11, 19);
module.exports = {
  info: (...a) => console.log(`[${ts()}]`, ...a),
  warn: (...a) => console.warn(`[${ts()}] WARN`, ...a),
  error: (...a) => console.error(`[${ts()}] ERROR`, ...a),
  step: (n, t) => console.log(`\n[${ts()}] ── STAP ${n}: ${t}`),
};
