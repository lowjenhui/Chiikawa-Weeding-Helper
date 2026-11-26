// Builds app/data.js and app/index.html from weeding_masterdata/.
// Usage: node app/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const md = (f) => JSON.parse(readFileSync(join(here, '..', 'weeding_masterdata', f), 'utf8'));

const blocksRaw = md('WeedingStageBlock.json');
const events = Object.fromEntries(md('WeedingEvent.json').map((e) => [e.id, e]));
const bigDefs = Object.fromEntries(md('WeedingStageBigBlock.json').map((b) => [b.id, b]));
const { rewards, resources } = md('WeedingRewards.json');
const rewardById = Object.fromEntries(rewards.map((r) => [r.id, r]));
const resName = Object.fromEntries(resources.map((r) => [r.id, r.name]));

const KIND = {
  whistle_candy: 'wc', gem: 'gem', heart: 'heart', sasumata: 'sas', rod: 'rod',
  small_candy: 'sc', rare_gacha_ticket: 'ticket',
};

function decodeReward(id) {
  if (!id) return { kind: 'none', amt: 0 };
  const r = rewardById[id];
  if (!r) throw new Error('Unknown reward ' + id);
  if (r.rewardType === 'IdleGoldMinutes') return { kind: 'gold', amt: Number(r.acquireAmount) };
  const kind = KIND[resName[r.masterId]];
  if (!kind) throw new Error('Unknown resource ' + r.masterId);
  return { kind, amt: Number(r.acquireAmount) };
}

const blocks = { 0: { h: 0, kind: 'none', amt: 0, src: 'empty', big: 0 } };
for (const b of blocksRaw) {
  let src = 'tile';
  let rewardId = b.rewardId;
  if (b.weedingEventId) { src = 'q'; rewardId = events[b.weedingEventId].rewardId; }
  else if (b.weedingStageBigBlockId) src = 'big';
  else if (b.rewardAssetId === 3) src = 'cap';
  const big = b.weedingStageBigBlockId
    ? bigDefs[b.weedingStageBigBlockId].width * bigDefs[b.weedingStageBigBlockId].height
    : 0;
  blocks[b.id] = { h: b.health, ...decodeReward(rewardId), src, big };
}

const chunks = Object.fromEntries(md('WeedingStageChunk.json').map((c) => [c.id, c.weedingBlockIds]));
const normal = md('WeedingFixedStageChunkRelation.json')
  .filter((r) => r.weedingChunkType === 'Normal')
  .sort((a, b) => a.chunkNumber - b.chunkNumber)
  .map((r) => r.weedingStageChunkId);
const cycle = normal.slice(0, 20);
for (let i = 0; i < normal.length; i++) {
  if (normal[i] !== cycle[i % 20]) throw new Error('Chunk order is not a clean 20-cycle at ' + i);
}
const usedChunks = Object.fromEntries(cycle.map((id) => [id, chunks[id]]));

const data = { version: '250330.1.0', cycle, chunks: usedChunks, blocks };
const dataJs = 'const WEED_DATA = ' + JSON.stringify(data) + ';\n';
writeFileSync(join(here, 'data.js'), dataJs);

const template = readFileSync(join(here, 'template.html'), 'utf8');
const core = readFileSync(join(here, 'core.js'), 'utf8');
const html = template
  .replace('/*@@DATA@@*/', () => dataJs)
  .replace('/*@@CORE@@*/', () => core);
writeFileSync(join(here, 'index.html'), html);
console.log('Built app/data.js and app/index.html (' + html.length + ' bytes)');
