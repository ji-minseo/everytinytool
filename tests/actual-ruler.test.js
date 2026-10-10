'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clampScale, toUnits, lengthLabel, buildTicks } = require('../assets/actual-ruler.js');

test('uses CSS 96dpi as an approximate starting scale only', () => {
  assert.ok(Math.abs(clampScale(NaN) - (96 / 25.4)) < 1e-10);
  assert.equal(clampScale(1), 2);
  assert.equal(clampScale(15), 12);
  assert.equal(clampScale(4.12), 4.12);
});
test('converts exact inch and centimeter references correctly', () => {
  assert.deepEqual(toUnits(25.4), { mm: 25.4, cm: 2.54, inch: 1 });
  assert.deepEqual(toUnits(10), { mm: 10, cm: 1, inch: 0.394 });
  assert.equal(toUnits(53.98).cm, 5.398);
});
test('shows a reasonable selected distance across three unit systems', () => {
  assert.equal(lengthLabel(25.4, 'inch'), '1 in');
  assert.equal(lengthLabel(25.4, 'cm'), '2.54 cm');
  assert.equal(lengthLabel(25.4, 'mm'), '25.4 mm');
  assert.equal(lengthLabel(0, 'inch'), '0 in');
});
test('centimeter ticks cover 30cm with every millimeter present', () => {
  const grid = buildTicks('cm');
  assert.equal(grid.maxMm, 300);
  assert.equal(grid.ticks.length, 301);
  assert.deepEqual(grid.ticks[0], { mm: 0, major: true, mid: true, label: '0' });
  assert.deepEqual(grid.ticks[10], { mm: 10, major: true, mid: true, label: '1' });
  assert.equal(grid.ticks[5].mid, true);
  assert.equal(grid.ticks[1].major, false);
  assert.equal(grid.ticks[300].label, '30');
});
test('millimeter labels show 10mm increments', () => {
  const grid = buildTicks('mm');
  assert.equal(grid.ticks[10].label, '10');
  assert.equal(grid.ticks[50].label, '50');
  assert.equal(grid.ticks[300].label, '300');
});
test('inch grid covers twelve inches with sixteenth-inch subdivisions', () => {
  const grid = buildTicks('inch');
  assert.equal(grid.maxMm, 304.8);
  assert.equal(grid.ticks.length, 193);
  assert.ok(Math.abs(grid.ticks[16].mm - 25.4) < 1e-10);
  assert.equal(grid.ticks[16].label, '1');
  assert.equal(grid.ticks[192].label, '12');
  assert.equal(grid.ticks[4].mid, true);
  assert.equal(grid.ticks[1].major, false);
});
