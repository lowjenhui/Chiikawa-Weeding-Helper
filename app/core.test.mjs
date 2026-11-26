// Run: node app/build.mjs && node --test app/core.test.mjs
// Checks the board model against the three live screenshots from 22 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { create } = require('./core.js');
const src = readFileSync(new URL('./data.js', import.meta.url), 'utf8');
const DATA = new Function(src + '; return WEED_DATA;')();
const W = create(DATA);

// Observed classes per cell: l light, D dark, . empty/cleared (wildcard),
// w1/w2/w3 Whistle Candy icons, G gem, h heart, S Sasumata pickup, SC small candy, Cap capsule.
function cls(c) {
  if (c.src === 'empty') return '.';
  if (c.src === 'cap') return 'Cap';
  if (c.kind === 'wc') return { 30: 'w1', 100: 'w2', 300: 'w3' }[c.amt];
  if (c.kind === 'gem') return 'G';
  if (c.kind === 'heart') return 'h';
  if (c.kind === 'sas') return 'S';
  if (c.kind === 'sc') return 'SC';
  return c.h === 2 ? 'D' : 'l';
}
// The 22 Nov screenshots were taken under the old offset (71). Shifting their depth by
// OLD_SHIFT keeps them as checks on the layouts under the current offset (29).
const OLD_SHIFT = 42;
function check(depth, obs) {
  const rows = W.rowsFrom(depth, 7);
  obs.trim().split('\n').forEach((line, k) => {
    line.trim().split(/\s+/).forEach((o, j) => {
      if (o === '.' || o === '?') return; // cleared or locked-empty (ambiguous on screen)
      assert.equal(cls(rows[k].cells[j]), o, `depth ${depth} R${k + 1}C${j + 1}`);
    });
  });
}

test('depth maps to the verified cycle rows', () => {
  assert.equal(W.cycleRow(25488), 37);
  assert.equal(W.rowAt(25488).chunkId, 201);
  assert.equal(W.rowAt(25488).chunkRow, 3);
  assert.equal(W.cycleRow(23836 + OLD_SHIFT), 107);
  assert.equal(W.cycleRow(23843 + OLD_SHIFT), 114);
  assert.equal(W.cycleRow(23844 + OLD_SHIFT), 115);
  const r = W.rowAt(23836 + OLD_SHIFT);
  assert.equal(r.chunkId, 204);
  assert.equal(r.chunkRow, 3);
  assert.equal(r.cyclePos, 16);
});

test('screenshot at 23,836 m matches', () => check(23836 + OLD_SHIFT, `
D l D D . D
D S D D . D
D h D D . D
D l D D . D
G D . . . l
l l . D D D
D D l h D D`));

test('screenshot at 23,843 m matches (? = locked empty)', () => check(23843 + OLD_SHIFT, `
D w3 D . D D
D l D . D D
D w2 D . D D
D w1 . . D SC
D G D . l ?
l ? G . l ?
l l l l w1 Cap`));

test('screenshot at 23,844 m matches after Sasumata', () => check(23844 + OLD_SHIFT, `
D . D . D D
D . D . D D
D . . . D SC
D . D . l ?
l . G . l ?
. . . l w1 Cap
D D l l ? D`));

// Live screenshot, 25 Nov 2026. SC = small candy (wrapped sweet icon).
test('screenshot at 25,488 m matches', () => check(25488, `
? D . D SC D
SC . . l ? D
. . l l w2 D
G . l l ? D
D . l ? l l
w1 . l ? G D
l D SC l l D`));

test('next big blocks from the 23,844 m board', () => {
  const bb = W.bigBlocksAhead(23844 + OLD_SHIFT, 140);
  assert.equal(bb[0].size, 4);
  assert.equal(bb[0].topDepth, 23863 + OLD_SHIFT);
  assert.deepEqual(bb[0].rewards, { wc: 500, gem: 100 });
  const eight = bb.find((b) => b.size === 8);
  assert.equal(eight.topDepth, 23920 + OLD_SHIFT); // chunk 401 (cycle pos 8), rows 3-4 -> cycle row 51
  assert.deepEqual(eight.rewards, { wc: 4000, gem: 200, heart: 1 });
  assert.equal(eight.cells.length, 8);
});

test('the cycle totals match the analysis', () => {
  const { totals, stamina } = W.totalsFor(0, 140);
  assert.equal(stamina, 886); // 899 less 7 + 3 + 3: each big block costs 1 in total
  assert.equal(totals.wc, 10210);
  assert.equal(totals.gem, 2550);
});

const sorted = (a) => [...a].sort();

test('Sasumata clears the column plus the bottom row either side', () => {
  const T = 100;
  assert.deepEqual(sorted(W.toolCells('sas', T, 0, 3)),
    sorted(['100:3', '101:3', '102:3', '103:3', '104:3', '105:3', '106:3', '106:2', '106:4']));
  assert.deepEqual(sorted(W.toolCells('sas', T, 0, 1)),
    sorted(['100:1', '101:1', '102:1', '103:1', '104:1', '105:1', '106:1', '106:2'])); // C1 drops its off-board side
});

test('Rod clears 13 cells, reaching below the board and clipped at the top and sides', () => {
  const T = 100;
  const low = W.toolCells('rod', T, 106, 3); // R7
  assert.equal(low.length, 13);
  assert.ok(low.includes('107:2') && low.includes('107:4') && low.includes('108:3')); // R8 x3, R9 x1
  assert.deepEqual(sorted(W.toolCells('rod', T, 100, 1)), sorted(['100:1', '100:2', '101:1', '101:2', '102:1', '100:3']));
});

test('an empty patch not touching cleared ground does not unlock its neighbours', () => {
  // R2C2 (25,489) is empty but R1C2 is dark grass, so only R2C1 (reached from the empty R1C1) connects it.
  const r = W.planRoutes(25488, {})[0];
  assert.deepEqual([r.steps[0].row, r.steps[0].col], [25489, 1]);
});

test('a big block pops for 1 stamina and pays all its cells', () => {
  const r = W.planRoutes(25488, {})[0];
  const last = r.steps[r.steps.length - 1];
  assert.equal(last.cost, 1);
  assert.equal(last.cells.length, 8);
  const got = {};
  for (const k of last.cells) { const [d, c] = k.split(':').map(Number); const cell = W.rowAt(d).cells[c - 1]; got[cell.kind] = (got[cell.kind] || 0) + cell.amt; }
  assert.deepEqual(got, { wc: 4000, gem: 200, heart: 1 });
});

test('route planner from 25,488 m with 22 Sasumata and 29 Rod stays within the per-leg budget', () => {
  const t0 = Date.now();
  const routes = W.planRoutes(25488, { sas: 22, rod: 29 });
  assert.ok(Date.now() - t0 < 1000);
  for (const r of routes) {
    const last = r.steps[r.steps.length - 1];
    assert.equal(r.target.topDepth, 25502);
    assert.equal(last.kind, 'hand');
    assert.equal(last.cells.length, 8);
  }
  const b = routes[0];
  assert.equal(b.kind, 'budget');
  assert.ok(b.sasAllow >= 2 && b.rodAllow >= 2);
  assert.ok(b.sasUsed <= b.sasAllow && b.rodUsed <= b.rodAllow);
  const none = routes.find((r) => r.kind === 'none');
  assert.ok(none && none.sasUsed + none.rodUsed === 0 && none.net <= 12);
  assert.ok(b.net < none.net);
});

test('lastBlocks 100 leaves no stock share: only picked-up charges are spent', () => {
  const routes = W.planRoutes(25488, { sas: 22, rod: 29, lastBlocks: 100 });
  const r = routes[0];
  assert.ok(r.sasUsed <= r.sasGained && r.rodUsed <= r.rodGained);
  for (const x of routes.filter((x) => x.kind !== 'over')) assert.ok(x.sasUsed <= x.sasGained && x.rodUsed <= x.rodGained);
});

test('minSave adds a fixed-bar route first', () => {
  const routes = W.planRoutes(25488, { sas: 22, rod: 29, minSave: 5 });
  assert.equal(routes[0].kind, 'bar');
  assert.ok(routes.length <= 3 && !routes.some((r) => r.kind === 'over'));
  assert.ok(routes[0].sasUsed <= 22 + routes[0].sasGained && routes[0].rodUsed <= 29 + routes[0].rodGained);
  assert.ok(routes.some((r) => r.kind === 'budget') && routes.some((r) => r.kind === 'none'));
});

test('without charges there is exactly one route, with no tools', () => {
  const routes = W.planRoutes(25488, { sas: 0, rod: 0 });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].kind, 'none');
});

test('a popped 2x4 stops being the route target', () => {
  const first = W.planRoutes(25488, { sas: 22, rod: 29 })[0].target;
  assert.equal(first.topDepth, 25502);
  const cleared = new Set(first.cells.map((c) => c.depth + ':' + c.col));
  const next = W.planRoutes(25488, { sas: 22, rod: 29, cleared })[0].target;
  assert.equal(next.topDepth, 25502 + 140);
});
