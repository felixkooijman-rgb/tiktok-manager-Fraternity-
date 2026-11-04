'use strict';
const { getConfig } = require('./config');
const { getStore } = require('./store');
const registry = require('./registry');
const log = require('./log');
function createContext() {
  registry.loadBuiltins();
  return { config: getConfig(), store: getStore(), log, registry };
}
module.exports = { createContext };
