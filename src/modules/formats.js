'use strict';
// Content formats. Each format: eligibility on a catalog entry, slide specs and a Dutch caption –
// built ONLY from verified match data (catalog) or computed values (dates, rankings).
const { minuteLabel } = require('../core/util');

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const nlDate = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const dotDate = (ymd) => ymd.split('-').reverse().join('.');
const PHASE_NL = [[/quarter-final/i, 'kwartfinale'], [/semi-final/i, 'halve finale'], [/round of 16/i, 'achtste finale'], [/^final$|\bfinal$/i, 'finale'], [/group ([a-h])/i, 'groep $1'], [/league phase/i, 'competitiefase'], [/first round/i, 'eerste ronde'], [/second round/i, 'tweede ronde'], [/matchday (\d+)/i, 'speelronde $1']];
const COMP_NL = [[/^World Cup (\d{4})/i, 'WK $1'], [/^European Championship (\d{4})|^Euro (\d{4})/i, 'EK $1$2']];
function tr(s, map) { for (const [re, to] of map) if (re.test(s)) return s.replace(re, to); return s; }
const comp = (m) => tr(m.match.competition || '', COMP_NL);
const phase = (m) => (m.match.phase ? tr(m.match.phase, PHASE_NL) : '');
const TEAM_NL = { Netherlands: 'Nederland', Argentina: 'Argentinië', Brazil: 'Brazilië', Spain: 'Spanje', 'Soviet Union': 'Sovjet-Unie', Germany: 'Duitsland', 'West Germany': 'West-Duitsland', France: 'Frankrijk', Italy: 'Italië', England: 'Engeland', Belgium: 'België', Portugal: 'Portugal', Uruguay: 'Uruguay' };
const nlTeam = (n) => TEAM_NL[n] || n;
const score = (m) => `${nlTeam(m.match.home.name)} ${m.match.score.home}-${m.match.score.away} ${nlTeam(m.match.away.name)}`;
const scoreUp = (m) => `${(m.match.home.display || m.match.home.name).toUpperCase()} ${m.match.score.home}:${m.match.score.away} ${(m.match.away.display || m.match.away.name).toUpperCase()}`;

function hero(m) {
  const p = m.featured.player, c = m.featured.club, mo = m.featured.moment || {};
  const minute = mo.minute != null ? minuteLabel(mo) : null;
  const shootout = mo.kind === 'shootout';
  if (p) return { name: p.full_name, short: p.display, number: p.number, minute, isClub: false, shootout };
  return { name: c?.display || m.match.home.name, short: c?.display || '', number: null, minute, isClub: true, shootout };
}
function goalRows(m) {
  const g = m.goals.map((x) => ({ value: minuteLabel(x), label: `${x.player}${x.type === 'own_goal' ? ' (e.d.)' : x.type === 'penalty' ? ' (pen.)' : ''} · ${nlTeam(m.match[x.team].name)}`, hl: m.featured.player && x.player === m.featured.player.full_name && x.minute === m.featured.moment?.minute }));
  if (m.match.penalties) g.push({ value: `${m.match.penalties.home}-${m.match.penalties.away}`, label: 'na strafschoppen', hl: true });
  return g.slice(0, 7);
}
const matchLine = (m) => [comp(m), phase(m)].filter(Boolean).join(' · ');
const momentText = (m) => { const h = hero(m); return h.shootout ? 'de strafschoppenserie' : h.minute ? `de ${h.minute}` : 'deze wedstrijd'; };
const lateKey = (m) => (m.featured.moment.minute || 0) * 100 + (m.featured.moment.stoppage || 0);
const posterImg = (m, ctx, v) => ctx.poster(m, v);
const stillToCheck = (m) => m.needsManualCheck.length;

const FORMATS = {
  'poster-reveal': {
    label: 'Poster reveal', eligible: (m) => m.hasPoster,
    hook: (m) => `${hero(m).short || hero(m).name} ${hero(m).minute || ''}`.trim(),
    async slides(m, ctx) {
      const h = hero(m); const img = await posterImg(m, ctx, 'framed');
      return [
        { type: 'hook', bg: img, kicker: matchLine(m), title: h.minute || h.short, sub: `${scoreUp(m)} · ${dotDate(m.match.date)}`, size: 260 },
        { type: 'poster', image: img, label: scoreUp(m), sub: `${m.match.stadium} · ${dotDate(m.match.date)}` },
        { type: 'facts', kicker: 'Het verloop', title: scoreUp(m), rows: goalRows(m), image: await posterImg(m, ctx, 'frameless') },
        { type: 'cta', title: ctx.config.brand.cta, },
      ];
    },
    caption: (m) => `${hero(m).name} in ${momentText(m)}. ${score(m)}, ${matchLine(m)} (${nlDate(m.match.date)}). Welk moment moet de volgende poster worden? 👇`,
    title: (m) => `${hero(m).short} ${hero(m).minute || ''} · ${score(m)}`.replace(/\s+/g, ' '),
  },

  'on-this-day': {
    label: 'Op deze dag', eligible: (m, sig) => m.hasPoster && sig?.kind === 'anniversary',
    async slides(m, ctx, sig) {
      const h = hero(m); const img = await posterImg(m, ctx, 'framed');
      return [
        { type: 'hook', bg: img, kicker: `Op deze dag · ${sig.years} jaar geleden`, title: dotDate(m.match.date), sub: `${scoreUp(m)} · ${h.short} ${h.minute || ''}`, size: 200 },
        { type: 'poster', image: img, label: scoreUp(m), sub: matchLine(m) },
        { type: 'facts', kicker: `${m.match.stadium}, ${m.match.city}`, title: 'Zo ging het', rows: goalRows(m), image: await posterImg(m, ctx, 'frameless') },
        { type: 'cta', title: ctx.config.brand.cta },
      ];
    },
    caption: (m, sig) => `Vandaag precies ${sig.years} jaar geleden: ${score(m)} (${matchLine(m)}). ${hero(m).name} in ${momentText(m)}. Waar keek jij? 📺`,
    title: (m, sig) => `${sig.years} jaar geleden: ${score(m)}`,
    scheduleOn: (sig) => sig.date,
  },

  quiz: {
    label: 'Quiz', eligible: (m) => m.hasPoster && !!m.featured.player && m.featured.moment?.minute != null,
    async slides(m, ctx) {
      const h = hero(m); const img = await posterImg(m, ctx, 'frameless');
      return [
        { type: 'hook', kicker: 'Voetbalquiz', title: `Wie scoorde in de ${h.minute}?`, sub: `${scoreUp(m)} · ${dotDate(m.match.date)}`, footer: 'Swipe voor het antwoord →', size: 150 },
        { type: 'facts', kicker: 'Hint', title: matchLine(m), rows: [{ value: h.minute, label: m.match.stadium }, ...(h.number ? [{ value: `#${h.number}`, label: 'rugnummer' }] : [])] },
        { type: 'poster', image: img, label: `${h.name}`, sub: `${h.minute} · ${scoreUp(m)}` },
        { type: 'cta', title: 'Wist jij het?', sub: ctx.config.brand.cta },
      ];
    },
    caption: (m) => `Wie scoorde in de ${hero(m).minute} van ${score(m)}? Zet je antwoord in de comments vóór je swipet 👀`,
    title: (m) => `Quiz: wie scoorde in de ${hero(m).minute}?`,
  },

  // Guess the poster: zoomed detail (kit colours + number) → blurred poster with verified hints → reveal.
  'raad-de-poster': {
    label: 'Raad de poster', eligible: (m) => m.hasPoster && !!m.featured.player,
    async slides(m, ctx) {
      const img = await posterImg(m, ctx, 'frameless');
      const h = hero(m);
      const comp1 = comp(m).replace(/\s*\d{4}$/, '');
      return [
        { type: 'cover', image: await posterImg(m, ctx, 'framed'), kicker: 'Fraternity voetbalquiz', title: 'Raad de poster', sub: 'Welk moment zit hierachter?', footer: 'Swipe voor hint 1 →', size: 170 },
        { type: 'clue', image: img, zoom: 3.2, fx: 0.5, fy: 0.69, kicker: 'Raad de poster · hint 1', title: 'Welk moment is dit?', footer: 'Swipe voor hint 2 →', size: 130 },
        { type: 'clue', image: img, zoom: 1, fx: 0.5, fy: 0.5, blur: 48, kicker: 'Hint 2', title: 'Nog steeds niet?', hints: [`Jaar: ${m.match.date.slice(0, 4)}`, `Toernooi: ${comp1}`, ...(h.number ? [`Rugnummer: ${h.number}`] : [])], footer: 'Antwoord in de comments, dan swipen →', size: 120 },
        { type: 'poster', image: await posterImg(m, ctx, 'framed'), label: `${h.short} ${h.minute || ''}`.trim(), sub: `${scoreUp(m)} · ${dotDate(m.match.date)}` },
        { type: 'cta', title: 'Had jij hem?', sub: ctx.config.brand.cta },
      ];
    },
    caption: (m) => {
      const hint = `${comp(m).replace(/\s*\d{4}$/, '')}, ${m.match.date.slice(0, 4)}${hero(m).number ? `, rugnummer ${hero(m).number}` : ''}`;
      const lines = [
        `Raad de poster 🔍 Hint: ${hint}. Welk moment zit hierachter? Zet je gok in de comments vóór je doorswipet.`,
        `Herken jij dit shirt? 👀 ${hint}. Gok eerst, swipe daarna.`,
        `Eén cijfer, één shirt, één moment. ${hint}. Weet jij welke poster dit is? Comment je antwoord vóór slide 4.`,
      ];
      return lines[[...m.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % lines.length];
    },
    title: () => 'Raad de poster: welk moment is dit?',
  },

  'framed-vs-frameless': {
    label: 'Met of zonder lijst', eligible: (m) => !!(m.posters.framed && m.posters.frameless),
    async slides(m, ctx) {
      const a = await posterImg(m, ctx, 'framed'), b = await posterImg(m, ctx, 'frameless');
      return [
        { type: 'hook', bg: a, kicker: scoreUp(m), title: 'Met of zonder lijst?', sub: 'A of B – zeg het in de comments', size: 170 },
        { type: 'poster', image: a, label: 'A · met lijst', sub: scoreUp(m) },
        { type: 'poster', image: b, label: 'B · zonder lijst', sub: scoreUp(m) },
        { type: 'cta', title: 'A of B?', sub: ctx.config.brand.cta },
      ];
    },
    caption: (m) => `Zelfde moment, twee versies: ${hero(m).name}, ${score(m)}. A met lijst of B zonder? 🖼️`,
    title: (m) => `A of B? ${score(m)}`,
  },

  'collection-pick': {
    label: 'Kies je favoriet', group: 4, eligible: (m) => m.hasPoster,
    async slides(ms, ctx) {
      const imgs = []; for (const m of ms) imgs.push(await posterImg(m, ctx, 'framed'));
      return [
        { type: 'grid', title: 'Welke hang jij op?', sub: '1, 2, 3 of 4?', images: imgs },
        ...ms.map((m, i) => ({ type: 'poster', image: imgs[i], label: `${i + 1} · ${hero(m).short} ${hero(m).minute || ''}`.trim(), sub: `${scoreUp(m)} · ${m.match.date.slice(0, 4)}` })),
        { type: 'cta', title: 'Jouw keuze?', sub: ctx.config.brand.cta },
      ];
    },
    caption: (ms) => `Vier momenten uit de collectie: ${ms.map((m, i) => `${i + 1}) ${hero(m).short} – ${score(m)} (${m.match.date.slice(0, 4)})`).join(', ')}. Welke hang jij op?`,
    title: () => 'Welke hang jij op? 1, 2, 3 of 4',
  },

  'last-minute': {
    label: 'Last-minute ranking', group: 4,
    eligible: (m) => m.hasPoster && (m.featured.moment?.minute || 0) >= 90 && m.featured.moment?.kind === 'goal',
    async slides(ms, ctx) {
      const sorted = [...ms].sort((a, b) => lateKey(b) - lateKey(a));
      const imgs = []; for (const m of sorted) imgs.push(await posterImg(m, ctx, 'framed'));
      return [
        { type: 'hook', bg: imgs[0], kicker: 'Uit de Fraternity-collectie', title: 'Tot het laatste fluitsignaal', sub: `${sorted.length} goals in of na de 90e minuut`, size: 150 },
        { type: 'facts', kicker: 'Gesorteerd op minuut', title: 'Hoe laat?', image: imgs[0], rows: sorted.map((m, i) => ({ value: hero(m).minute, label: `${hero(m).short} · ${m.match.date.slice(0, 4)}`, hl: i === 0 })) },
        ...sorted.map((m, i) => ({ type: 'poster', image: imgs[i], label: `${hero(m).minute} · ${hero(m).short}`, sub: scoreUp(m) })),
        { type: 'cta', title: ctx.config.brand.cta },
      ];
    },
    caption: (ms) => `Laat, later, laatst: ${[...ms].sort((a, b) => lateKey(b) - lateKey(a)).map((m) => `${hero(m).short} ${hero(m).minute}`).join(' · ')}. Welke goal mist er in dit rijtje?`,
    title: () => 'Tot het laatste fluitsignaal',
  },

  // Two (or more) chosen posters, two photos each (with and without frame). Built on request.
  duo: {
    label: 'Posters naast elkaar', group: 2, manual: true,
    eligible: (m) => !!(m.posters.framed && m.posters.frameless),
    async slides(ms, ctx) {
      const out = [];
      const first = await posterImg(ms[0], ctx, 'framed');
      out.push({ type: 'hook', bg: first, kicker: ms.map((m) => `${hero(m).short}`).join(' · '), title: ms.map((m) => hero(m).minute || hero(m).short).join(' & '), sub: ms.map((m) => `${scoreUp(m)} · ${m.match.date.slice(0, 4)}`).join('  |  ').replace(/\s{2,}/g, ' '), size: 190 });
      for (const m of ms) {
        const h = hero(m);
        out.push({ type: 'poster', image: await posterImg(m, ctx, 'framed'), label: `${h.short} ${h.minute || ''}`.trim(), sub: `${scoreUp(m)} · met lijst` });
        out.push({ type: 'poster', image: await posterImg(m, ctx, 'frameless'), label: `${h.short} ${h.minute || ''}`.trim(), sub: `${scoreUp(m)} · zonder lijst` });
      }
      out.push({ type: 'cta', title: 'Welke hang jij op?', sub: ctx.config.brand.cta });
      return out;
    },
    caption: (ms) => `${ms.map((m) => `${hero(m).name} in ${momentText(m)} van ${score(m)} (${comp(m)}${/\d{4}/.test(comp(m)) ? '' : `, ${m.match.date.slice(0, 4)}`})`).join(' en ')}. Met of zonder lijst, en welke hang jij op? 👇`,
    title: (ms) => ms.map((m) => `${hero(m).short} ${hero(m).minute || ''}`.trim()).join(' & '),
  },

  'design-breakdown': {
    label: 'Van shirt naar poster', eligible: (m) => m.hasPoster && !!m.theme?.shirt,
    async slides(m, ctx) {
      const img = await posterImg(m, ctx, 'frameless');
      const approx = m.needsManualCheck.some((x) => /lettering|font|approximat/i.test(x));
      const { palette } = require('../compose/slides');
      return [
        { type: 'hook', bg: img, kicker: 'Zo ontwerpen we', title: 'Van shirt naar poster', sub: scoreUp(m), size: 170 },
        { type: 'swatches', kicker: scoreUp(m), title: 'De kleuren', colors: palette(m.theme).all.slice(0, 4), lines: [
          `Achtergrond = de voorkant van het shirt uit ${m.match.date.slice(0, 4)}`,
          'Naam en nummer in de stijl van de shirtbedrukking' + (approx ? ' (benadering met een open font)' : ''),
          'Geen clublogo’s of sponsors – alleen kleuren en strepen'] },
        { type: 'poster', image: img, label: 'Het resultaat', sub: scoreUp(m) },
        { type: 'cta', title: ctx.config.brand.cta },
      ];
    },
    caption: (m) => `Van shirt naar poster: de kleuren van het shirt uit ${score(m)} (${nlDate(m.match.date)}) zijn de basis van dit ontwerp. Welk shirt moeten we hierna doen?`,
    title: (m) => `Van shirt naar poster · ${score(m)}`,
  },
};

module.exports = { FORMATS, hero, score, nlDate, matchLine, stillToCheck };
