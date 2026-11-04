'use strict';
// Tiny JSON document store (data/db.json). Atomic writes; swap for SQLite/Postgres by
// implementing the same interface (all/get/insert/update/remove/meta).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConfig } = require('./config');

const COLLECTIONS = ['ideas', 'posts', 'assets', 'research', 'metrics', 'followers', 'runs', 'tasks'];

class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    for (const c of COLLECTIONS) this.db[c] = this.db[c] || [];
    this.db.meta = this.db.meta || {};
  }
  reload() { if (fs.existsSync(this.file)) this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); return this; }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }
  all(c, filter) { const rows = this.db[c] || []; return filter ? rows.filter(filter) : rows; }
  get(c, id) { return (this.db[c] || []).find((r) => r.id === id); }
  insert(c, doc) {
    const row = { id: doc.id || `${c.slice(0, -1)}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`, createdAt: new Date().toISOString(), ...doc };
    this.db[c].push(row);
    this.save();
    return row;
  }
  update(c, id, patch) {
    const row = this.get(c, id);
    if (!row) throw new Error(`${c}/${id} not found`);
    Object.assign(row, typeof patch === 'function' ? patch(row) : patch, { updatedAt: new Date().toISOString() });
    this.save();
    return row;
  }
  remove(c, id) { this.db[c] = this.db[c].filter((r) => r.id !== id); this.save(); }
  meta(key, value) {
    if (value === undefined) return this.db.meta[key];
    this.db.meta[key] = value; this.save(); return value;
  }
}

let instance;
function getStore() {
  if (!instance) instance = new Store(path.join(getConfig().paths.data, 'db.json'));
  return instance;
}
module.exports = { getStore, Store };
