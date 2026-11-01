# Shark Personality Quiz

A small static website built with HTML, CSS, and browser JavaScript modules. It uses the pixel art and frame exports in `assets/`; quiz questions, shark profiles, and map zones are each kept in their own editable file.

## Run it

Use Node.js 18 or later, then run:

```sh
npm start
```

Open `http://localhost:5173`. The start script uses the lightweight `serve` command; no frontend framework or build step is used.

## Shark art

The current art is in `assets/` as `shark-<key>.png`, for example `assets/shark-thresher.png`. Keep the files transparent and render them with pixelated image scaling. All 14 shark art files are currently present.

## Change questions or scoring

Edit the `QUESTIONS` list in `js/questions.js`. Each answer has two shark keys: the first gets +2 and the second +1. `scoreAnswers()` applies the score tie breaks (more +2 answers, then most recently scored). Edit shark profile copy in `js/sharks.js`; edit the map center, radius, and color in `js/zones.js`. The world map's art is `assets/map-land.svg`.

## Shared live counter (optional)

Without setup, the WHAT page uses a local browser counter initialized at 12,847 and keeps working offline. For one shared count across visitors, use a free Supabase project:

1. In Supabase, open **SQL Editor** and run [`counter.sql`](counter.sql). It creates an atomic quiz counter, prevents duplicate quiz completions per session, and adds an anonymous action log for Shark ID download/share button activations.
2. Copy the project's **Project URL** and **anon/public key** into `url` and `anonKey` in [`js/counter-config.js`](js/counter-config.js). Do not use a service-role key in a browser file.
3. Deploy the static site. The quiz counter will read the shared value and refresh every minute; if the backend is unreachable, the local counter remains available. Download/share analytics are sent without blocking either button. They count button activations, not confirmed file saves or completed posts.

To view action totals in Supabase SQL Editor, run:

```sql
select * from public.get_card_action_counts();
```

The event table stores only a random event UUID, action type, and timestamp. It does not store a name, IP address, or card contents. Repeated button activations count as separate actions; the public client endpoint can be spoofed, so these totals are suitable for basic product analytics rather than fraud-proof reporting.

## Main files

- `index.html`: page shell, navigation, stylesheets, and app entry point.
- `js/app.js`: quiz flow, results, card download/share, info pages, catalogue, map, and counter fallback.
- `js/questions.js`: question copy and scoring rules.
- `js/sharks.js`: shark copy and image paths.
- `js/zones.js`: map coordinates, zone radius, and color.
- `js/bubble.js`, `js/cursor.js`: reusable bubble and custom pixel cursor.
- `css/`: Figma palette, page layout, and interaction styling.

## Quick manual check

Run `npm start`, open the local page, enter a name, and answer all ten questions. Use **BACK** to revisit a question, then finish again and check that both result sharks are shown. Make a Shark ID, download it, and try Share. Visit WHAT, WHY, WHO, and WHERE from the top nav; on WHO open a tile, and on WHERE focus or tap a zone. To check motion support, enable your OS/browser reduced-motion preference and reload. The counter starts at 12,847 until Supabase is configured.
