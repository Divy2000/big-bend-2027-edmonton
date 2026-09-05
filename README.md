# Big Bend 2027 — Edmonton edition

A single-page trip site for our friend in Edmonton: a four-day, three-night Big Bend National Park camping and dark-sky road trip from Dallas on December 24–27, 2027 (Christmas weekend — a new moon, the darkest three nights of the year). Costs in CAD (with an adjustable exchange-rate assumption), with YEG–DFW flight logistics and the Alberta / U.S. holiday alignment worked out.

Companion site for the same trip, for J in Arizona: `big-bend-2027-arizona`.

## Stack

Static HTML, hand-written CSS and one dependency-free script. No build step, no framework, no trackers, no runtime keys.

- `index.html` — the whole site (19 sections: verdict, ranking, sky, aurora, weather, itinerary, travel, budget, gear, highlights, story, map, risks, FAQ, sources, invitation)
- `core.css` — layout, components, motion, reduced-motion fallbacks
- `theme.css` — this site’s palette and type (Bricolage Grotesque + Instrument Sans via Google Fonts)
- `core.js` — starfield canvas, parallax, reveal choreography, counters, moon-phase renderer, scroll-linked route, sticky verdict, CAD converter
- `assets/` — favicon and social preview image

## Deploy on GitHub Pages

1. Create a repository named `big-bend-2027-edmonton`.
2. Push these files to the `main` branch (the `.nojekyll` file is included).
3. Settings → Pages → Source: “Deploy from a branch” → `main` / `/ (root)` → Save.
4. The site publishes at `https://<your-username>.github.io/big-bend-2027-edmonton/` within a minute or two. All asset paths are relative, so no base-path configuration is needed.

## Photography

The six frames in “The weekend, in pictures” are illustrated placeholders drawn in SVG. To swap in photographs, replace each `<svg>` inside `.story figure` with an `<img loading="lazy" alt="…">` and put the credit in the `<figcaption>`. Public-domain National Park Service images of Big Bend and Unsplash- or CC-licensed Chihuahuan Desert photographs are both appropriate.

## Facts and sources

Every consequential figure (fees, climate averages, moon phases, holidays, fuel economy, fare baselines) is cited in the Sources section of the page, with assumptions stated. Airfare and fuel prices are planning ranges observed in September 2026, not 2027 quotes.

## After publishing

Replace the relative `og:image` path in `index.html` with the absolute URL of your published site (for example `https://<your-username>.github.io/big-bend-2027-edmonton/assets/og.png`) so link previews in iMessage, WhatsApp and Slack pick up the preview image.
