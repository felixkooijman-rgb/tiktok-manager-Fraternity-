#!/usr/bin/env node
'use strict';
// fraternity-tiktok-agent CLI
//   daily [--count n] [--today]  full autonomous loop (STAP 1–9)
//   research | ideas   run single steps (dry: prints, stores signals/ideas)
//   build <ideaId>     build a post for a stored idea
//   publish-due        publish/export posts whose time has come + check TikTok status
//   metrics            fetch TikTok stats + re-optimise
//   analyze-account    analyse the existing TikTok account → style guide
//   auth               print the TikTok login URL (callback handled by the dashboard)
//   dashboard | serve  web dashboard + built-in scheduler (daily run + publish every 5 min)
//   phone-pack [file]  mobile page with the next posts: save photos + copy caption
//   selftest           render one post of every format without publishing
const { createContext } = require('./core/context');

async function main() {
  const [cmd = 'help', ...args] = process.argv.slice(2);
  const ctx = createContext();
  const { chromium } = require('playwright');
  switch (cmd) {
    case 'daily': {
      const count = args.includes('--count') ? +args[args.indexOf('--count') + 1] : undefined;
      if (args.includes('--today')) ctx.config.schedule.planAheadDays = 0; // only plan posts for today
      const { built } = await require('./workflow/daily').runDaily(ctx, { count });
      console.log(`\n${built.length} post(s) gemaakt. Dashboard: npm run dashboard`);
      break;
    }
    case 'research': { const s = await require('./modules/research').runResearch(ctx); console.log(s.filter((x) => x.kind !== 'catalog-item').map((x) => `${x.kind}\t${x.title}`).join('\n')); break; }
    case 'ideas': {
      const signals = await require('./modules/research').runResearch(ctx);
      const ideas = await require('./modules/ideation').generateIdeas(ctx, signals);
      console.log(ideas.map((i) => `[${i.score}] ${i.label}\t${i.why}`).join('\n')); break;
    }
    case 'build': {
      const idea = ctx.store.get('ideas', args[0]); if (!idea) throw new Error('idee niet gevonden');
      const b = await chromium.launch();
      try { const p = await require('./modules/post-builder').buildPost(ctx, idea, { browser: b }); console.log(p.id, p.status, p.qa); } finally { await b.close(); }
      break;
    }
    case 'publish-due': console.log(`${await require('./modules/publisher').publishDue(ctx)} post(s) verwerkt`); break;
    case 'metrics': console.log(await require('./modules/analytics').collectMetrics(ctx), require('./modules/optimizer').optimize(ctx)); break;
    case 'analyze-account': {
      const b = await chromium.launch();
      try { const r = await require('./modules/account-analysis').analyzeAccount(ctx, { browser: b }); console.log(JSON.stringify(r, null, 2).slice(0, 3000)); } finally { await b.close(); }
      break;
    }
    case 'auth': {
      const { authorizeUrl } = require('./auth/tiktok-oauth');
      if (!ctx.config.env.TIKTOK_CLIENT_KEY) throw new Error('TIKTOK_CLIENT_KEY ontbreekt in .env');
      const { url, state } = authorizeUrl(ctx.config); ctx.store.meta('oauthState', state);
      console.log(`Open deze URL, log in met @${ctx.config.brand.handle || 'je account'} en keur goed (dashboard moet draaien voor de callback):\n\n${url}\n`);
      break;
    }
    case 'dashboard': case 'serve': require('./dashboard/server').start(ctx); return;
    case 'phone-pack': console.log(JSON.stringify(require('./modules/phone-pack').writePhonePack(ctx, args.find((a) => !a.startsWith('--')), { linked: args.includes('--linked') }), null, 2)); break;
    case 'selftest': await require('./selftest').run(ctx); break;
    default: console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(2, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  }
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
