import test from 'node:test';
import assert from 'node:assert/strict';
import { blocked, movePlayer, readProgress, saveProgress, compassHeading, SAVE_KEY, WORLD_LIMITS } from '../src/gameplay.js';

const wall = { minX: 1, maxX: 1.1, minZ: -10, maxZ: 10 };

test('player radius prevents clipping a wall before its center reaches it', () => {
  assert.equal(blocked(.7, 0, [wall]), true);
  assert.equal(blocked(.5, 0, [wall]), false);
  const result = movePlayer({ x: 0, z: 0 }, 2, 0, [wall]);
  assert.ok(result.x <= .62 && result.x > .4);
  assert.equal(result.z, 0);
});

test('large movement cannot tunnel through a thin wall', () => {
  const result = movePlayer({ x: -20, z: 0 }, 50, 0, [wall]);
  assert.ok(result.x <= .62);
  assert.equal(blocked(result.x, result.z, [wall]), false);
});

test('diagonal input slides along the wall without entering it', () => {
  const result = movePlayer({ x: 0, z: -3 }, 3, 6, [wall]);
  assert.ok(result.x <= .62);
  assert.ok(Math.abs(result.z - 3) < 1e-8);
  assert.equal(blocked(result.x, result.z, [wall]), false);
});

test('movement respects every world edge', () => {
  assert.deepEqual(movePlayer({x: 0, z: 0}, 100, 100, []), {x: WORLD_LIMITS.maxX, z: WORLD_LIMITS.maxZ});
  assert.deepEqual(movePlayer({x: 0, z: 0}, -100, -100, []), {x: WORLD_LIMITS.minX, z: WORLD_LIMITS.minZ});
});

test('zero movement is stable and does not mutate its input', () => {
  const start = {x: 3, y: 1.7, z: -8};
  assert.deepEqual(movePlayer(start, 0, 0, []), {x: 3, z: -8});
  assert.deepEqual(start, {x: 3, y: 1.7, z: -8});
});

test('saved progress keeps only known unique cat IDs', () => {
  const storage = { getItem(key) { assert.equal(key, SAVE_KEY); return JSON.stringify(['cobalt', 'missing', 'cobalt', 'poppy', 42, null]); } };
  assert.deepEqual(readProgress(storage, ['cobalt','poppy']), ['cobalt','poppy']);
});

test('corrupt, absent, non-array and inaccessible storage starts an empty journal', () => {
  for (const value of ['{broken', null, '{}', '42', 'null']) assert.deepEqual(readProgress({getItem: () => value}, ['cobalt']), []);
  assert.deepEqual(readProgress({getItem() { throw new Error('storage denied'); }}, ['cobalt']), []);
  assert.deepEqual(readProgress(null, ['cobalt']), []);
});

test('saving stores unique IDs and reports write failures without throwing', () => {
  let stored;
  assert.equal(saveProgress({setItem(key, value) { assert.equal(key, SAVE_KEY); stored = value; }}, ['cobalt','cobalt','poppy']), true);
  assert.deepEqual(JSON.parse(stored), ['cobalt','poppy']);
  assert.equal(saveProgress({setItem() { throw new Error('quota'); }}, ['cobalt']), false);
  assert.equal(saveProgress(null, []), false);
});

test('compass directions follow the world axes and wrap full revolutions', () => {
  assert.equal(compassHeading(0), 'N');
  assert.equal(compassHeading(Math.PI/2), 'W');
  assert.equal(compassHeading(-Math.PI/2), 'E');
  assert.equal(compassHeading(Math.PI), 'S');
  assert.equal(compassHeading(Math.PI/4), 'NW');
  assert.equal(compassHeading(-Math.PI/4), 'NE');
  assert.equal(compassHeading(4*Math.PI), 'N');
});
