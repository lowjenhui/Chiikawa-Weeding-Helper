# Weed Ahead: a Chiikawa Pocket weeding helper

**Open the helper: https://lowjenhui.github.io/Chiikawa-Weeding-Helper/app/**

It runs in your browser (phone or desktop), with nothing to install or sign in to.

## Try out weeding strategies before you spend stamina

Weeding boards in Chiikawa Pocket aren't random. They come from a fixed cycle of 20 layouts, so the depth on the sign tells you every cell below you. Weed Ahead uses that to show you the board ahead of time, so you can test a plan before you commit stamina and tool charges:

- **See what's coming.** Enter the depth from the sign to see your current board, the rows below it, and where the next big Whistle Candy blocks are.
- **Compare routes.** Enter your stamina, Sasumata and Subjugation Rod charges. The helper draws up to three routes to the next 2×4 block: within budget, with no tools, and over budget. It shows what each one costs.
- **Try "what if".** Change your tool budget, candy bonus or the higher-bar setting, and see how the routes change. That way you can choose to save charges or spend them.
- **Track your board.** Tap cells to mark them cleared as you play. Your marks are saved on your own device.

The route planner is new and still being checked against real play, so take its routes as suggestions.

## Unofficial fan tool

This is an unofficial fan project. It isn't affiliated with or endorsed by Applibot or the Chiikawa rights holders. It doesn't touch the game: there's no login, no reading of your account, and no automated taps. It only shows you information.

## Data source

The board layouts and rewards come from the community datamine at [Naguroka/chiikawa-pocket-datamine](https://github.com/Naguroka/chiikawa-pocket-datamine) (masterdata 250330.1.0), which was checked against a live board in November 2026. The raw tables are in `weeding_masterdata/`. If a game update changes the layouts, the helper may be wrong until the data is refreshed.

## For developers

```bash
node app/build.mjs && node --test app/core.test.mjs
```

`build.mjs` turns `weeding_masterdata/` into `app/data.js` and the single-file `app/index.html`.

## Licence

The code in `app/` is MIT-licensed (see `LICENSE`). The game data in `weeding_masterdata/` belongs to its rights holders and isn't covered by that licence.
