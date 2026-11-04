# Fraternity – TikTok-stijlgids

Account: **@fraternitysport** · shop: **fraternitysport.eu** · product: premium posters van (vooral Nederlandse) voetbalmomenten, €19,99 per poster (Shopify, 4 nov 2026).

> **Hoe deze gids is opgebouwd.** Het eerste deel is afgeleid van de bestaande Fraternity-merkbestanden: de 17 geverifieerde posters, thema's, fonts en het merkteken in de `Fraternity`-repo, plus de productlijst in de Shopify-shop. Het TikTok-profiel zelf kon nog niet worden gelezen: tiktok.com is afgeschermd voor scrapers en TikTok heeft geen publieke API zonder login. Na het koppelen via OAuth vult `npm run analyze` het blok **"Gemeten op TikTok"** onderaan met echte cijfers: hashtags, posturen, covertinten en topposts. Pas dan de regels hieronder aan als het account iets anders laat zien.

## 1. Merk in één zin
Elk voetbalmoment als verzamelobject: strak getypografeerd, gebaseerd op het echte wedstrijdshirt, feitelijk 100% juist.

## 2. Visuele identiteit
| Element | Regel |
|---|---|
| Formaat | Fotocarrousel, 1080 × 1920 (9:16), 4–7 slides |
| Display-font | **Anton** (OFL), hoofdletters: minuten, namen, scores |
| Tekst-font | **Oswald** (OFL), hoofdletters, ruime letterspatiëring: kickers, meta |
| Basiskleuren | Inkt `#161616` (lijst/achtergrond), muur `#EFECE6` (posterslides), wit |
| Accent | Clubkleuren uit het posterthema (shirt-basis + strepen), als kleurband onderaan en als accent op tekst (alleen lichte tinten op donker) |
| Merk | Driehoekmerk + **FRATERNITY**-woordmerk rechtsonder; nooit vervormen of opnieuw tekenen |
| Lijnen | Dunne horizontale regels zoals op de posters |
| Beeld | De poster zelf is de held. Hook-slide = vervaagde poster + grote typografie. Geen clublogo's, sponsors of fabrikantlogo's |
| Minuutnotatie | `90+3'`, scores `3:2` op slides (zoals op de posters), `3-2` in captions |

## 3. Carrousel-opbouw
1. **Hook** – één groot gegeven (minuut, naam, datum of vraag), max ±6 woorden.
2. **Poster** – op een lichte muur, zodat de donkere lijst zichtbaar blijft.
3. **Context** – doelpunten/verloop uit de geverifieerde matchdata.
4. **CTA** – merk + "Poster? Link in bio."

## 4. Formats (contentcategorieën)
| ID | Format | Doel |
|---|---|---|
| `poster-reveal` | Poster reveal | Product laten zien, verloop vertellen |
| `on-this-day` | Op deze dag | Jubileum, op de dag zelf gepland |
| `quiz` | Voetbalquiz | Reacties (antwoord pas op slide 3) |
| `framed-vs-frameless` | Met of zonder lijst | Reacties A/B, interieurgevoel |
| `collection-pick` | Welke hang jij op? | Reacties 1–4, collectie tonen |
| `last-minute` | Tot het laatste fluitsignaal | Ranking van late goals, shares |
| `design-breakdown` | Van shirt naar poster | Vakmanschap, merkverhaal |

## 5. Tekst & toon
- Captions in het **Nederlands**, kort (± 120–220 tekens), eindigen met een vraag.
- Max. 2 emoji. Geen clickbait, geen superlatieven die we niet kunnen onderbouwen ("beste ooit", "officieel").
- **Alleen feiten uit de geverifieerde matchbestanden** (`verification.confirmed`). Punten in `needs_manual_check` worden in het dashboard getoond.
- Hashtags: 4–6 → `#fraternity #voetbalposter` + format-tag + club/competitie + `#voetbal`.

## 6. Wat we níet doen
- Posts van andere creators of fotografen hergebruiken.
- Wedstrijdfoto's zonder licentie (persbureaus). Stockfoto's alleen met vastgelegde licentie, en alleen als sfeerbeeld.
- AI-beelden van echte spelers, clublogo's of shirts met sponsors. AI-beeld = altijd label "AI-gegenereerd" + handmatige goedkeuring.
- Gevoelige onderwerpen (overlijden, rellen, racisme, blessures, politiek) zonder goedkeuring.

## 7. Gemeten op TikTok
<!-- AUTO:ACCOUNT-ANALYSIS:START -->
_Nog niet gemeten. Koppel TikTok in het dashboard en draai `npm run analyze`._
<!-- AUTO:ACCOUNT-ANALYSIS:END -->
