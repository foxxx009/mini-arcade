# Mini Arcade

A small collection of free browser games. No framework, no build step, no runtime dependencies.

| Game | Path | What it is |
| --- | --- | --- |
| **Candy Blast** | `/match3/` | Match-3 puzzle — swap candies, chain combos, striped / bomb / rainbow specials, 25 moves per level |
| Stack Tower | `/stack/` | Drop moving blocks, the overhang gets sliced off |
| 2048 | `/2048/` | The number merging puzzle |
| Snake | `/snake/` | The classic grid game |
| Reflex Test | `/reflex/` | Five-round reaction time measurement in ms |

## Run locally

Any static file server works:

```bash
python -m http.server 8000
# open http://127.0.0.1:8000/
```

## Tests

Headless smoke tests load every page, run every game and assert the core loop works
(for match-3: the board starts full with no pre-made match, a legal swap is consumed,
the score increases, the cascade settles and the board refills).

```bash
npm install jsdom
NODE_PATH=./node_modules node smoke_test.js   # -> ALL SMOKE CHECKS PASSED
```

## Layout

```
index.html          home / game list
match3/  stack/  2048/  snake/  reflex/     one static page per game (SEO)
privacy/  about/                            required pages
assets/style.css   assets/common.js         shared styles, ad loader, high-score storage
games/*.js                                  one file per game
smoke_test.js                               headless tests
```

## Enabling ads

Ad slots are wired but empty by default, so the site renders with no empty boxes.
To turn ads on, create `assets/ad-config.js` and load it before `common.js`:

```js
window.AD_CONFIG = {
  enabled: true,
  interstitialEvery: 3,
  slots: {
    'ad-top': '<script src="...your network snippet..."><\/script>',
    'ad-home': '',
    'ad-game': '',
    'ad-interstitial': ''
  }
};
```

Slot ids present in the markup: `ad-top`, `ad-home`, `ad-game`.
The interstitial renders in an overlay after every N finished rounds.

## Privacy

No accounts, no analytics, no personal data collection. High scores stay in the browser's
local storage. See `/privacy/`.
