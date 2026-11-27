// Weeding board core logic. Pure functions, no DOM.
// Runs in the browser (sets globalThis.WeedCore) and in Node (module.exports).
// Data shape (built by app/build.mjs from weeding_masterdata/):
//   DATA.cycle  : [chunkId x20]          the repeating chunk order
//   DATA.chunks : {chunkId: [blockId x42]} 7 rows x 6 columns, row-major
//   DATA.blocks : {blockId: {h, kind, amt, src, big}}
(function (root) {
  'use strict';

  const COLS = 6;
  const CHUNK_ROWS = 7;
  const VIEW_ROWS = 7;
  // Depth d is row d + ROW_SHIFT of the run. After the 20 tutorial chunks (140 rows) the game loops
  // over all 143 Normal chunks (7 cycles of 20, then 3 more), so every 1,001-row loop slips the
  // 20-cycle by 21 rows. Fits every check: 23,836-23,844 m (22 Nov), 25,488 m (25 Nov), 26,219 m (27 Nov).
  // shortcut: ROW_SHIFT 134 fits too; the next loop start (27,173 m for -6, 27,033 m for 134) tells them apart.
  const ROW_SHIFT = -6;

  function create(DATA) {
    const CYCLE_ROWS = DATA.cycle.length * CHUNK_ROWS; // 140
    const LOOP_ROWS = DATA.loop * CHUNK_ROWS; // 1,001

    // 0-based row index into the repeating cycle for the board row at `depth` metres.
    function cycleRow(depth) {
      const r = (depth + ROW_SHIFT - CYCLE_ROWS) % LOOP_ROWS; // row within the current 143-chunk loop
      return ((r % CYCLE_ROWS) + CYCLE_ROWS) % CYCLE_ROWS;
    }

    // Everything known about the board row at `depth` (1 m = 1 row).
    function rowAt(depth) {
      const cr = cycleRow(depth);
      const pos = Math.floor(cr / CHUNK_ROWS);
      const chunkRow = (cr % CHUNK_ROWS) + 1;
      const chunkId = DATA.cycle[pos];
      const ids = DATA.chunks[chunkId].slice((chunkRow - 1) * COLS, chunkRow * COLS);
      return {
        depth,
        chunkId,
        cyclePos: pos + 1,
        chunkRow,
        chunkStartDepth: depth - (chunkRow - 1),
        cells: ids.map((id, i) => ({ id, col: i + 1, ...DATA.blocks[id] })),
      };
    }

    // Rows from the top visible row (depth) downward.
    function rowsFrom(depth, count) {
      const out = [];
      for (let k = 0; k < count; k++) out.push(rowAt(depth + k));
      return out;
    }

    function addReward(totals, cell) {
      if (!cell.kind || cell.kind === 'none') return;
      totals[cell.kind] = (totals[cell.kind] || 0) + cell.amt;
    }

    // Big blocks whose top row lies within [depth, depth + horizon).
    // A block counts once, with the sum of its cells' rewards and the
    // depth at which its top row sits.
    function bigBlocksAhead(depth, horizon) {
      const groups = new Map();
      for (let d = depth; d < depth + horizon + 2; d++) {
        const row = rowAt(d);
        for (const cell of row.cells) {
          if (!cell.big) continue;
          const variant = Math.floor(cell.id / 10); // 20,21,22 = 2x2 kinds; 30,31 = 2x4 kinds
          const key = row.chunkStartDepth + ':' + variant;
          let g = groups.get(key);
          if (!g) {
            g = { key, size: cell.big, topDepth: d, chunkId: row.chunkId, cells: [], rewards: {} };
            groups.set(key, g);
          }
          g.cells.push({ depth: d, col: cell.col });
          addReward(g.rewards, cell);
        }
      }
      return [...groups.values()]
        .filter((g) => g.topDepth < depth + horizon)
        .sort((a, b) => a.topDepth - b.topDepth);
    }

    // Reward totals for a range of rows, skipping cells in `cleared` (Set of "depth:col").
    // A big block costs 1 stamina in total (one tap pops it) [User, 25 Nov 2026].
    function totalsFor(depth, count, cleared) {
      const totals = {};
      const blocks = new Set();
      let stamina = 0;
      for (const row of rowsFrom(depth, count)) {
        for (const cell of row.cells) {
          if (cleared && cleared.has(row.depth + ':' + cell.col)) continue;
          if (cell.big) blocks.add(row.chunkStartDepth + ':' + Math.floor(cell.id / 10));
          else stamina += cell.h;
          addReward(totals, cell);
        }
      }
      return { totals, stamina: stamina + blocks.size };
    }

    // Cells ("d:col") a tool clears. T = top visible row index. Cells above T and off the board are dropped;
    // a Rod's cells below the board are kept [User]. Sasumata ignores `row`.
    function toolCells(kind, T, row, col) {
      const out = [];
      const add = (d, c) => { if (d >= T && c >= 1 && c <= COLS) out.push(d + ':' + c); };
      if (kind === 'sas') {
        for (let d = T; d < T + VIEW_ROWS; d++) add(d, col);
        add(T + VIEW_ROWS - 1, col - 1);
        add(T + VIEW_ROWS - 1, col + 1);
      } else {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(row + dr, col + dc);
        add(row - 2, col); add(row + 2, col); add(row, col - 2); add(row, col + 2);
      }
      return out;
    }

    // Route planner. Target: the big block topped at `targetTop`, else the next 2x4. See docs/spec.md section 9.
    // shortcut: pickup values are guesses in stamina, tune them against real play.
    const CHARGE_VALUE = 4;        // one Sasumata/Rod charge ~ 4 stamina
    const CANDY_PER_STAMINA = 200; // a 2x2 block is worth detouring for if candy / 200 >= its cost
    const MIN_TOOL_SAVING = 3;     // a tool must save this much stamina to be spent
    function planRoutes(depth, { cleared = new Set(), sas = 0, rod = 0, lastBlocks = 10, minSave = null, targetTop = null } = {}) {
      const open = bigBlocksAhead(depth, 280).filter((g) => !g.cells.every((c) => cleared.has(c.depth + ':' + c.col)));
      const target = (targetTop != null && open.find((g) => g.topDepth === targetTop)) || open.find((g) => g.size === 8);
      if (!target) return [];
      const bottom = Math.max(...target.cells.map((c) => c.depth)) + 2;
      const tkeys = target.cells.map((c) => c.depth + ':' + c.col);
      const grid = new Map(); // "d:col" -> cell
      const blocks = new Map(); // big-block key -> { keys, wc, size }
      for (let d = depth; d <= bottom; d++) {
        const row = rowAt(d);
        for (const cell of row.cells) {
          const g = { ...cell, d, k: d + ':' + cell.col };
          if (cell.big) {
            g.bk = row.chunkStartDepth + ':' + Math.floor(cell.id / 10);
            if (!blocks.has(g.bk)) blocks.set(g.bk, { keys: [], wc: 0, size: cell.big });
            blocks.get(g.bk).keys.push(g.k);
            if (cell.kind === 'wc') blocks.get(g.bk).wc += cell.amt;
          }
          grid.set(g.k, g);
        }
      }
      const nbrs = (g) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, b]) => grid.get((g.d + a) + ':' + (g.col + b))).filter(Boolean);
      const cost = (g) => (g.big ? 1 : g.h);

      // Integer index per cell (row-major from depth) so the hot search runs on typed arrays, not string Maps.
      const keys = [...grid.keys()];
      const N = keys.length;
      const idx = new Map(keys.map((k, i) => [k, i]));
      const cells = keys.map((k) => grid.get(k));
      const costA = Int32Array.from(cells, cost);
      const emptyA = Uint8Array.from(cells, (g) => (g.src === 'empty' ? 1 : 0));
      const rowA = Int32Array.from(cells, (g) => g.d);
      const nb = cells.map((g) => nbrs(g).map((n) => idx.get(n.k)));
      const INF = 1e9;

      // Open ground = cleared cells + empty patches touching them or the row above R1 [H1].
      // Dist = cheapest stamina to reach each locked cell from open ground, rows >= T only.
      // `done` is a Set of "d:col"; `extra` lists more cleared keys (a tool being tried).
      function solve(done, T, extra = []) {
        const open = new Uint8Array(N);
        const q = [];
        const mark = (i) => { if (!open[i]) { open[i] = 1; q.push(i); } };
        for (const k of done) mark(idx.get(k));
        for (const k of extra) mark(idx.get(k));
        for (let c = 0; c < COLS; c++) if (emptyA[c]) mark(c);
        for (let h = 0; h < q.length; h++) for (const n of nb[q[h]]) if (emptyA[n]) mark(n);
        let D = depth - 1;
        for (const i of q) if (rowA[i] > D) D = rowA[i];
        const dist = new Int32Array(N).fill(INF);
        const pred = new Int32Array(N).fill(-1);
        const todo = [];
        for (let i = 0; i < N; i++) {
          if (rowA[i] < T || open[i] || !(rowA[i] === depth || nb[i].some((n) => open[n]))) continue;
          dist[i] = costA[i];
          todo.push(i);
        }
        for (let h = 0; h < todo.length; h++) { // label-correcting search; weights are small ints
          const u = todo[h];
          for (const n of nb[u]) {
            if (rowA[n] < T || open[n]) continue;
            const nd = dist[u] + costA[n];
            if (nd < dist[n]) { dist[n] = nd; pred[n] = u; todo.push(n); }
          }
        }
        return { D, dist, pred };
      }
      const dAt = (dist, k) => { const v = dist[idx.get(k)]; return v >= INF ? Infinity : v; };
      const best = (ks, dist) => ks.reduce((a, k) => (dAt(dist, k) < dAt(dist, a) ? k : a), ks[0]);

      const pickCache = new Map();
      // caps = { sas, rod } tool allowance before pickups (null = no tools); a tool is used only when it saves >= minSave.
      // Charges picked up on the way raise the cap at once; a tool is never used beyond the charges held.
      function walk(caps, minSave) {
        const done = new Set([...cleared].filter((k) => grid.has(k)));
        const totals = {};
        const steps = [];
        const saw = new Set(); // every best-placement saving met, so a sweep can skip thresholds that change nothing
        let T = depth, spent = 0, refunded = 0, peak = 0, sasLeft = sas, rodLeft = rod, sasUsed = 0, rodUsed = 0, sasGained = 0, rodGained = 0;
        const cv = caps ? CHARGE_VALUE : 0;
        const value = (g) => (g.big ? 0 : g.kind === 'heart' ? g.amt : g.kind === 'sas' || g.kind === 'rod' ? cv * g.amt : 0);
        function collect(keys) { // mark cells cleared, bank their rewards
          const got = [];
          for (const k of keys) {
            const g = grid.get(k);
            if (done.has(k) || g.src === 'empty') continue;
            done.add(k);
            got.push(k);
            if (g.kind === 'none') continue;
            totals[g.kind] = (totals[g.kind] || 0) + g.amt;
            if (g.kind === 'heart') refunded += g.amt;
            if (g.kind === 'sas') { sasLeft += g.amt; sasGained += g.amt; }
            if (g.kind === 'rod') { rodLeft += g.amt; rodGained += g.amt; }
          }
          return got;
        }
        for (let guard = 0; guard < 600 && !tkeys.every((k) => done.has(k)); guard++) {
          let s = solve(done, T);
          if (s.D - 5 > T) { T = s.D - 5; s = solve(done, T); } // [H2] scroll
          const now = best(tkeys, s.dist);
          const toNow = dAt(s.dist, now);
          if (toNow === Infinity) return null;
          const canSas = caps && sasLeft > 0 && sasUsed < caps.sas + sasGained;
          const canRod = caps && rodLeft > 0 && rodUsed < caps.rod + rodGained;
          if (canSas || canRod) {
            // The best placement does not depend on minSave, so sweep walks that reach the same state share it.
            const ck = [T, canSas, canRod, [...done].sort().join()].join('|');
            let pick = pickCache.get(ck);
            if (pick === undefined) {
              pick = null;
              const tryTool = (kind, row, col) => {
                const cells = toolCells(kind, T, row, col).filter((k) => grid.has(k) && !grid.get(k).big && grid.get(k).src !== 'empty' && !done.has(k));
                if (!cells.length) return;
                const gain = cells.reduce((a, k) => a + value(grid.get(k)), 0);
                if (pick && cells.reduce((a, k) => a + cost(grid.get(k)), gain) <= pick.saving) return; // cannot beat the best so far
                const after = solve(done, T, cells);
                const saving = toNow - dAt(after.dist, best(tkeys, after.dist)) + gain;
                if (!pick || saving > pick.saving) pick = { saving, kind, row, col, cells };
              };
              for (let c = 1; c <= COLS; c++) {
                if (canSas) tryTool('sas', T, c);
                if (canRod) for (let r = T; r < T + VIEW_ROWS; r++) tryTool('rod', r, c);
              }
              pickCache.set(ck, pick);
            }
            if (pick) saw.add(pick.saving);
            if (pick && pick.saving >= minSave) {
              collect(pick.cells);
              if (pick.kind === 'sas') { sasLeft--; sasUsed++; } else { rodLeft--; rodUsed++; }
              steps.push({ kind: pick.kind, row: pick.row, col: pick.col, cost: 0, cells: pick.cells });
              continue;
            }
          }
          // Goal: the best detour that pays for itself, else the target block.
          let goal = now, gain = 0;
          const consider = (k, v) => { const d = dAt(s.dist, k); if (v > d && v - d > gain) { goal = k; gain = v - d; } };
          for (const g of grid.values()) if (g.d >= T && !g.big && !done.has(g.k)) consider(g.k, value(g));
          for (const [bk, b] of blocks) if (b.size === 4 && bk !== target.key && !b.keys.every((k) => done.has(k))) consider(best(b.keys, s.dist), b.wc / CANDY_PER_STAMINA);
          let i = idx.get(goal);
          while (s.pred[i] >= 0) i = s.pred[i];
          const k = keys[i];
          const g = grid.get(k);
          spent += cost(g);
          peak = Math.max(peak, spent - refunded);
          const cells = collect(g.big ? blocks.get(g.bk).keys : [k]);
          steps.push({ kind: 'hand', row: g.d, col: g.col, cost: cost(g), cells });
        }
        if (!tkeys.every((k) => done.has(k))) return null;
        return {
          steps, spent, refunded, net: spent - refunded, peak,
          saw, sasUsed, rodUsed, sasGained, rodGained, totals, target: { topDepth: target.topDepth, size: target.size, cells: target.cells },
        };
      }

      // Routes: optional fixed bar, then the budget route (stock / lastBlocks per kind, spent where it saves most), no tools, and an over-budget route.
      const share = (n) => Math.floor(n / Math.max(1, lastBlocks));
      const budgetCaps = { sas: share(sas), rod: share(rod) };
      const used = (r) => r.sasUsed + r.rodUsed;
      let budget = null, last = null;
      for (let m = 15; m >= MIN_TOOL_SAVING; m--) { // a high bar first, so the budget is not spent on early small savings
        if (!last || last.saw.has(m)) last = walk(budgetCaps, m); // lowering the bar to m changes nothing unless a placement saved exactly m
        const r = last;
        if (r && (!budget || r.net < budget.net || (r.net === budget.net && used(r) < used(budget)))) budget = r;
      }
      const none = walk(null, 0);
      const out = [];
      if (minSave != null) { const r = walk({ sas: Infinity, rod: Infinity }, minSave); if (r) out.push({ ...r, kind: 'bar', minSave }); }
      if (budget) out.push({ ...budget, kind: used(budget) ? 'budget' : 'none' });
      if (none) out.push({ ...none, kind: 'none' });
      if (minSave == null) {
        const over = walk({ sas: Infinity, rod: Infinity }, MIN_TOOL_SAVING);
        if (over && budget && used(over) > used(budget) && over.net < budget.net) out.push({ ...over, kind: 'over' });
      }
      const seen = new Set();
      return out.map(({ saw, ...r }) => ({ ...r, sasAllow: budgetCaps.sas + r.sasGained, rodAllow: budgetCaps.rod + r.rodGained })).filter((r) => { const k = JSON.stringify(r.steps.map((s) => [s.kind, s.row, s.col])); return !seen.has(k) && seen.add(k); });
    }

    return { COLS, CHUNK_ROWS, VIEW_ROWS, CYCLE_ROWS, cycleRow, rowAt, rowsFrom, bigBlocksAhead, totalsFor, toolCells, planRoutes };
  }

  // Study graph ranks; each opens only after the one before is complete.
  const STUDY_RANKS = [{ label: '+100%', levels: 5, per: 20 }, { label: '+300%', levels: 10, per: 30 }, { label: '+600%', levels: 1, per: 600 },
    { label: '+1a%', levels: 1, per: 1000 }, { label: '+1a%', levels: 1, per: 1000 }, { label: '+1.5a%', levels: 1, per: 1500 }];
  const studyBonus = (rank, level) => STUDY_RANKS.reduce((t, r, i) => t + (i < rank ? r.levels * r.per : i === rank ? level * r.per : 0), 0);
  // Exact match only; a typed custom total gives null. 0 is {rank:0, level:0}.
  function studyPosition(bonus) {
    if (bonus === 0) return { rank: 0, level: 0 };
    for (let rank = 0; rank < STUDY_RANKS.length; rank++) for (let level = 1; level <= STUDY_RANKS[rank].levels; level++) if (studyBonus(rank, level) === bonus) return { rank, level };
    return null;
  }

  const api = { create, STUDY_RANKS, studyBonus, studyPosition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeedCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
