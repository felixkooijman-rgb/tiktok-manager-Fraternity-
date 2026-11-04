# Fraternity TikTok-agent

Autonome, modulaire TikTok-contentagent voor **@fraternitysport** (Fraternity voetbalposters, shop fraternitysport.eu).

Elke dag doet de agent het volgende: trends en onderwerpen verzamelen, minstens 5 ideeën bedenken, de beste kiezen, slides maken in de Fraternity-huisstijl, caption en hashtags schrijven, kwaliteit en rechten controleren, inplannen of publiceren, statistieken ophalen en het schema bijsturen. Het dashboard laat je posts goedkeuren, aanpassen, verwijderen en volgen.

De feiten komen **uitsluitend** uit de geverifieerde matchbestanden in de [Fraternity](../Fraternity)-repo (`matches/*.json`). De beelden zijn de eigen posters uit die repo. Daardoor verzint de agent geen feiten en gebruikt hij geen beelden zonder rechten.

```
 research ─▶ ideation ─▶ selectie ─▶ beelden ─▶ slides+caption ─▶ QA ─▶ planning ─▶ publiceren ─▶ analytics ─▶ optimizer
 (STAP 1)    (2)          (3)        (4)        (5)                (6)   (7)          (7)          (8)          (9) ─┐
     ▲                                                                                                             │
     └──────────────────────────────── format- en tijdslotgewichten ◀──────────────────────────────────────────────┘
```

## Snel starten

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm test
```

`npm test` rendert één post per format zonder te publiceren. Zet daarbij eventueel `DATA_DIR=/tmp/x` om je echte data niet te vullen.

```bash
npm start
```

`npm start` start het dashboard op http://localhost:4300 met de ingebouwde planner: publiceren elke 5 minuten en de dagelijkse run om 07:05 (Europe/Amsterdam).

Losse stappen:

```bash
npm run daily
```

```bash
npm run analyze
```

```bash
npm run publish-due
```

```bash
npm run metrics
```

Vereist: Node 20+ en de Fraternity-repo naast deze repo (of `FRATERNITY_DIR` in `.env`). De fonts, het merkteken, de matchdata en de posters komen daaruit.

## TikTok koppelen (officiële API)

1. Maak een app op [developers.tiktok.com](https://developers.tiktok.com/) en voeg deze producten toe:
   - **Login Kit**, met redirect-URI = `TIKTOK_REDIRECT_URI`
   - **Content Posting API** (Direct Post aan)
   - **Display API**
2. Vraag de scopes aan: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`, `video.publish`, `video.upload`.
3. **Verifieer je domein of URL-prefix** in het portal. Fotoposts kunnen alleen via `PULL_FROM_URL` vanaf een geverifieerd domein, bijvoorbeeld `https://media.fraternitysport.eu/`. Twee manieren:
   - `MEDIA_SYNC_COMMAND` uploadt de slides naar je host (rclone, aws s3, …).
   - Of laat het dashboard achter dat domein draaien: het serveert `/media/<post>/<slide>.jpg`.
4. Vul `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` en `PUBLIC_MEDIA_BASE_URL` in `.env` in.
5. Kies in het dashboard **Instellingen → Koppel TikTok** en log in als @fraternitysport.
6. Kies daar ook bewust de zichtbaarheid. TikTok wil dat die per account of post gekozen wordt en niet als stille standaard.
7. Draai `npm run analyze`. Dat analyseert je bestaande posts en vult het meetblok in `config/style-guide.md` en de startwaarden voor de tijdslots.

**Beperkingen van TikTok:**
- Zolang je app niet door TikTok is **geaudit**, worden API-posts alleen privé (`SELF_ONLY`) geplaatst. Vraag de audit aan zodra alles werkt.
- Alternatief: zet de modus op *"Als concept naar TikTok-inbox"* (`MEDIA_UPLOAD`). Je rondt de post dan af in de app, met een trending geluid.
- "Favorieten" geeft de Display API niet terug. Die vul je eventueel per post in via het dashboard.
- Zonder koppeling of host maakt de agent per post een map in `data/exports/` met genummerde slides, `caption.txt` en een checklist voor handmatig posten.

## Goedkeuren en veiligheid

`config/agent.config.json → approval.mode`:
- `all`: elke post wacht op jouw klik.
- `sensitive-only` (standaard): alleen gemarkeerde posts wachten. Dat zijn posts over nieuws, met gevoelige woorden, met AI-beeld of met een herschreven caption die QA niet vertrouwt.
- `none`: posts gaan zonder goedkeuring de planning in.

QA blokkeert een post bij:
- een verkeerd formaat
- tekst buiten beeld
- een ontbrekende licentie of naamsvermelding
- misleidende claims
- dubbele captions
- titels van meer dan 90 tekens
- lege variabelen
- dubbele spaties of herhaalde woorden

Gevoelige onderwerpen worden nooit zonder jouw goedkeuring gepubliceerd.

## Architectuur

| Map | Rol |
|---|---|
| `src/core/` | config (`.env` + `agent.config.json`), JSON-store (`data/db.json`), **plugin-registry**, logging |
| `src/providers/research/` | `fraternity-catalog` (geverifieerde matches), `anniversaries` (op-deze-dag), `rss-news` (NOS/ESPN), `google-trends`, `shop-products` (Shopify `products.json` → posterverzoeken), `manual-trends` (`config/trends.json`) |
| `src/providers/images/` | `fraternity-poster` (eigen werk), `unsplash`/`pexels`/`pixabay`/`wikimedia` (met licentie en naamsvermelding), `ai-openai` (optioneel, altijd met AI-label en goedkeuring) |
| `src/providers/llm/` | `anthropic` (Claude, optioneel: caption-polish en extra ideeën; nieuwe cijfers worden geweigerd) |
| `src/providers/publish/` | `tiktok` (Content Posting API, foto-carrousel), `manual-export` |
| `src/providers/hosting/` | `command` (eigen upload-commando), `local` (dashboard serveert media) |
| `src/providers/analytics/` | `tiktok-display` (views, likes, reacties, shares, volgers) |
| `src/modules/` | `formats` (7 contentformats), `research`, `ideation`, `captions`, `post-builder`, `qa`, `scheduler`, `publisher`, `analytics`, `optimizer`, `account-analysis` |
| `src/compose/slides.js` | HTML-sjablonen → 1080×1920 JPEG via Chromium, met automatisch passende tekst |
| `src/dashboard/` | dashboard + REST-API + ingebouwde planner |
| `.claude/agents/tiktok-trend-researcher.md` | Claude Code-agent voor webonderzoek naar trends en nieuwe posteronderwerpen |

**Uitbreiden:**
- **Nieuw model, beeldtool of platform:** maak een bestand in `src/providers/<soort>/` dat dezelfde functies teruggeeft. Registreer het met één regel in `src/core/registry.js` en zet de naam in `config/agent.config.json → providers`. Voorbeelden: een ander LLM, Runway of Flux voor beelden, Instagram Reels of YouTube Shorts als publish-provider.
- **Nieuw format:** voeg een item toe aan `FORMATS` in `src/modules/formats.js`. Een format bepaalt wanneer het geschikt is, welke slides er komen, de caption en de titel.
- **Nieuw slidesjabloon:** voeg een functie toe aan `TEMPLATES` in `src/compose/slides.js`.

**Hoe de agent leert** (`optimizer`):
- De gewichten per format en per tijdslot komen uit log(views) × engagement.
- Ze worden naar 1,0 getrokken zolang er weinig data is, zodat één virale post de planning niet overneemt.
- 20% van de posts gaat naar een minder geteste tijd, zodat de agent beter leert wanneer je publiek actief is.
- Dezelfde wedstrijd komt pas na 10 dagen terug, behalve op een jubileum. Er komen nooit twee keer hetzelfde format na elkaar.

## Nieuwe posters

Ideeën van het type **"Nieuwe poster nodig"** komen uit shopproducten zonder geverifieerd matchbestand, of uit nieuws en trends die niet in de catalogus staan. De agent maakt daar zelf géén content van.

Laat in de Fraternity-repo de `football-poster-designer`-agent de feiten verifiëren en de poster renderen. Daarna staat de poster automatisch in de catalogus van de TikTok-agent.

## Draaien op een server

Het systeem moet continu draaien om op tijd te publiceren. Opties:
- een kleine VPS, een Raspberry Pi of Railway/Fly met `npm start`, met `data/` op een blijvende schijf
- `systemd` of `pm2` als procesmanager

Zet `DASHBOARD_PASSWORD` zodra het dashboard vanaf internet bereikbaar is. `/media/*` en de OAuth-callback blijven publiek, want TikTok moet de slides kunnen ophalen.
