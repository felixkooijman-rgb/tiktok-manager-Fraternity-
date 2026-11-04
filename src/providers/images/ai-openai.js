'use strict';
// Optional AI image generation (OpenAI Images API). Swap in any other model by adding a provider
// with the same generate({prompt,file}) signature. AI images: never real players/crests/logos,
// always flagged for approval and labelled as AI-generated on TikTok.
const fs = require('fs');
const path = require('path');
module.exports = function openaiImages({ config }) {
  const key = config.env.OPENAI_API_KEY; if (!key) return null;
  return {
    name: 'openai-images',
    async generate({ prompt, file, size = '1024x1536' }) {
      const guard = ' No real people, no recognisable players, no club crests, no logos, no sponsor marks, no text.';
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt: prompt + guard, size }),
      });
      if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64'));
      return { path: file, provider: this.name, source: `AI-generated (${config.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'})`, prompt, aiGenerated: true,
        license: { type: 'AI-generated (provider terms)', commercialUse: true, attributionRequired: false } };
    },
  };
};
