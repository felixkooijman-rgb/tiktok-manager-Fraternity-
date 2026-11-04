'use strict';
// Claude via the Messages API (plain fetch, no SDK). Used only to polish captions, proofread and
// brainstorm angles. Facts are always passed in explicitly; output is checked by modules/qa.js.
module.exports = function anthropic({ config }) {
  const key = config.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = config.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  async function complete({ system, prompt, maxTokens = 1200, json = false }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    const text = body.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!json) return text;
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    return m ? JSON.parse(m[0]) : null;
  }
  return { name: `anthropic:${model}`, complete };
};
