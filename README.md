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

## How it works: the 20-board cycle

- Each weeding board is a fixed layout of 6 columns × 7 rows. The game calls these layouts "chunks".
- After the tutorial boards, the game repeats the same 20 chunks in the same order. 20 chunks × 7 rows makes one **140 m cycle**. The game actually loops over a list of 143 chunks (7 cycles plus 3 extra chunks), so every 1,001 m the pattern slips by 21 m. The helper allows for this.
- 1 m on the depth sign is 1 row. So once you know your depth, the helper knows where you are in the cycle and can show every cell below you: its grass, rewards, hearts, tool pickups and big blocks.
- Each cycle has one big **2×4 block** (the biggest Whistle Candy payout) plus a few 2×2 blocks. The planner aims for the next 2×4 block.

## How to use it

**1. Enter your depth.** Read the depth on the sign in the game (in metres) and type it into the top box. The sign's depth belongs to the row just above the dashed red line. Use **−1 / +1** as you clear rows.

- The strip under the depth shows where you are in the 20-chunk cycle ("You: 6 of 20"). Pink segments are chunks with big blocks.
- The cards below it list the next big blocks, what they pay, and how many metres away they are.

**2. Check the board matches.** "Your board now" should look like your screen in the game. If it doesn't, nudge the depth by ±1 until it does. Open **How to read the board** at the bottom for what each icon and colour means.

**3. Enter your resources** under "Route to the 2×4 block":

| Box | What to enter |
|---|---|
| Stamina | Your current weeding stamina. |
| Sasumata (L) | Sasumata charges you hold. |
| Rod (R) | Subjugation Rod charges you hold. |
| Candy bonus % | Your Whistle Candy bonus from Study, if any. It only changes the candy amounts shown. |
| Tools last (blocks) | How many 2×4 blocks your charges should last. Charges don't refill, so the planner spends about your stock ÷ this number per block, plus any charges you pick up on the way. Lower it to spend tools more freely. |
| Higher bar + Min saved / charge | Tick this to add a route that only uses a charge when it saves at least this much stamina. |

**4. Compare the routes.** Up to three route cards appear:

- **Within budget**: the cheapest route using your per-block share of charges.
- **No tools**: everything by hand, so you keep all your charges.
- **Over budget**: cheaper in stamina but uses more charges than your share. It's only shown when it actually helps.
- **Saves ≥ N each**: the Higher bar route.

Each card shows **net stamina** (stamina spent minus hearts collected) and how many charges it uses. Tap a card to draw it on the board.

**5. Follow the steps.** On the board, the numbered cells are the route, in order:

- **Pink** = tap by hand.
- **Blue "L"** = use Sasumata on that column.
- **Yellow "R"** = use the Rod, tapping that cell.
- **Dashed outlines** = cells that a tool step clears.

**6. Mark what you clear.** Tap cells on the helper as you clear them in the game, and the routes update. Changing any number above, or the depth, also replans. **Unmark all cells** starts fresh. Your depth, marks and settings are saved in your browser on this device.

**Testing strategies:** change the numbers to ask "what if". For example, what if I save my Rods? Is it worth chasing that heart? How far does my stamina go? Compare the net stamina on each card before you spend anything in the game.

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
