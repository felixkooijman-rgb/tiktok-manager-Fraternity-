'use strict';
const registry = require('./registry');
let llm;
function getLlm(ctx) {
  if (llm !== undefined) return llm;
  const choice = ctx.config.providers.llm;
  llm = null;
  if (choice === 'auto') { llm = registry.create('llm', 'anthropic', ctx); }
  else if (choice && choice !== 'none') llm = registry.create('llm', choice, ctx);
  return llm;
}
module.exports = { getLlm };
