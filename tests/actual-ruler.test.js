'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clampScale, toUnits, lengthLabel, buildTicks, estimateScreenScale, scaleFromDiagonal, shouldStartVertical } = require('../assets/actual-ruler.js');

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

const display = (width, height, dpr, userAgent, touchPoints = 0) => ({
  width, height, dpr, userAgent, platform: '', touchPoints
});
test('recognizes a common iPhone resolution using CSS pixel ratio', () => {
  const estimate = estimateScreenScale(display(393, 852, 3, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'));
  assert.equal(estimate.label, 'iPhone resolution profile');
  assert.equal(estimate.confidence, 'profile');
  assert.ok(Math.abs(estimate.scale - (460 / 3 / 25.4)) < 1e-9);
  assert.equal(estimate.screen, '393 × 852 CSS px');
});
test('device profiles behave the same after the device rotates', () => {
  const info = display(393, 852, 3, 'iPhone');
  const portrait = estimateScreenScale(info);
  const landscape = estimateScreenScale({ ...info, width: 852, height: 393 });
  assert.deepEqual(landscape, portrait);
});
test('detects iPad mini and regular iPad as separate size families', () => {
  const mini = estimateScreenScale(display(744, 1133, 2, 'Mozilla/5.0 (iPad)'));
  assert.ok(Math.abs(mini.scale - (326 / 2 / 25.4)) < 1e-9);
  const air = estimateScreenScale(display(820, 1180, 2, 'Mozilla/5.0 (iPad)'));
  assert.ok(Math.abs(air.scale - (264 / 2 / 25.4)) < 1e-9);
});
test('recognizes desktop-mode iPad Safari when touch is available', () => {
  const estimate = estimateScreenScale(display(834, 1194, 2, 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5));
  assert.equal(estimate.label, 'iPad resolution profile');
});
test('gives Android phones a clearly approximate screen-width scale', () => {
  const estimate = estimateScreenScale(display(412, 915, 2.625, 'Mozilla/5.0 (Linux; Android 15; Pixel) Mobile'));
  assert.equal(estimate.label, 'Android phone size estimate');
  assert.equal(estimate.confidence, 'family');
  assert.ok(Math.abs(estimate.scale - 412 / 72) < 1e-9);
});
test('uses a generic browser reference on unidentified desktop monitors', () => {
  const estimate = estimateScreenScale(display(1920, 1080, 1, 'Mozilla/5.0 (Windows NT 10.0)'));
  assert.equal(estimate.label, 'Browser 96px/in reference');
  assert.equal(estimate.confidence, 'reference');
  assert.equal(estimate.scale, 96 / 25.4);
});
test('never mistakes unknown device resolution for verified calibration', () => {
  const estimate = estimateScreenScale(display(400, 800, 2, 'Unidentified Browser'));
  assert.notEqual(estimate.confidence, 'profile');
  assert.equal(estimate.source, 'Unidentified physical display');
});

test('mobile viewport defaults to vertical ruler', () => {
  assert.equal(shouldStartVertical(320), true);
  assert.equal(shouldStartVertical(375), true);
  assert.equal(shouldStartVertical(390), true);
  assert.equal(shouldStartVertical(430), true);
  assert.equal(shouldStartVertical(650), true);
});
test('tablet and desktop widths continue to use horizontal ruler', () => {
  assert.equal(shouldStartVertical(651), false);
  assert.equal(shouldStartVertical(768), false);
  assert.equal(shouldStartVertical(1440), false);
  assert.equal(shouldStartVertical(NaN), false);
});

test('known 13.3-inch Mac screen uses actual diagonal and CSS resolution', () => {
  const display = { width: 1440, height: 900, dpr: 2, userAgent: 'Macintosh' };
  const scale = scaleFromDiagonal(display, 13.3);
  assert.ok(Math.abs(scale - Math.hypot(1440, 900) / (13.3 * 25.4)) < 1e-10);
  assert.ok(Math.abs(scale * 100 - 503.15) < 1);
});
test('13, 13.3 and 13.6 inch screens are not treated as identical', () => {
  const display = { width: 1440, height: 900, dpr: 2 };
  const scale13 = scaleFromDiagonal(display, 13);
  const scale133 = scaleFromDiagonal(display, 13.3);
  const scale136 = scaleFromDiagonal(display, 13.6);
  assert.ok(scale13 > scale133 && scale133 > scale136);
});
test('diagonal scale is independent of DPR when using browser CSS pixels', () => {
  const a = { width: 1280, height: 800, dpr: 1 };
  const b = { ...a, dpr: 2 };
  assert.equal(scaleFromDiagonal(a, 13.3), scaleFromDiagonal(b, 13.3));
});
test('diagonal calculation uses the whole screen and works in rotated orientation', () => {
  const landscape = scaleFromDiagonal({ width: 1920, height: 1080 }, 24);
  const portrait = scaleFromDiagonal({ width: 1080, height: 1920 }, 24);
  assert.equal(landscape, portrait);
  assert.ok(Math.abs(landscape - Math.hypot(1920, 1080) / (24 * 25.4)) < 1e-10);
});
test('rejects missing or impossible real screen diagonal values', () => {
  const screen = { width: 1440, height: 900 };
  assert.equal(scaleFromDiagonal(screen, 0), null);
  assert.equal(scaleFromDiagonal(screen, 3), null);
  assert.equal(scaleFromDiagonal(screen, 81), null);
  assert.equal(scaleFromDiagonal(screen, 'not a number'), null);
  assert.equal(scaleFromDiagonal({ width: 0, height: 900 }, 13.3), null);
});
