'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const page = read('actual-size-ruler/index.html');
const mobile = read('assets/ruler-mobile.css');
const source = read('assets/actual-ruler.js');

test('new mobile stylesheet is linked after shared site stylesheet', () => {
  const main = page.indexOf('assets/styles.css?v=');
  const custom = page.indexOf('assets/ruler-mobile.css?v=');
  assert.ok(main > 0 && custom > main);
});
test('mobile ruler offers collapsible automatic-resolution metadata', () => {
  assert.match(page, /<details class="ruler-auto-banner" id="ruler-device-details" open>/);
  assert.match(page, /<summary class="ruler-auto-summary">/);
  assert.match(source, /detectionDetails.open = !compactLayout/);
});
test('mobile measurement readout sticks only while its workspace is in view', () => {
  assert.match(mobile, /\.ruler-workspace\s*\{[\s\S]*?overflow:visible/);
  assert.match(mobile, /\.ruler-readout\s*\{[\s\S]*?position:sticky/);
  assert.match(mobile, /top:max\(7px,env\(safe-area-inset-top,0px\)\)/);
});
test('mobile ruler uses a full-width vertical canvas while preserving physical tick spacing', () => {
  assert.match(source, /const mobileVertical = state\.vertical && shouldStartVertical\(window\.innerWidth\)/);
  assert.match(source, /Math\.max\(118, scrollPanel\.clientWidth\)/);
  assert.match(source, /railWidth = 112/);
  assert.match(source, /mark\.mm \* state\.scale/);
});
test('controls remain accessible and functional on a narrow phone', () => {
  assert.match(page, /aria-label="Horizontal ruler"/);
  assert.match(page, /aria-label="Vertical ruler"/);
  assert.match(page, /id="ruler-mobile-hint"/);
  assert.match(page, /id="ruler-use-auto"/);
  assert.match(page, /class="ruler-readout-calibrate" href="#ruler-calibration"/);
  assert.match(mobile, /grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,\.85fr\)/);
});
test('every JavaScript lookup is provided by an HTML element', () => {
  const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const lookedUp = [...source.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(lookedUp.filter((id) => !ids.has(id)), []);
});

test('screen diagonal picker offers distinct 13, 13.3 and 13.6-inch sizes', () => {
  for (const inches of ['13','13.3','13.6','14','15.6','16','24','27']) {
    assert.ok(page.includes('value="' + inches + '"'), 'Missing ' + inches + ' inch preset');
  }
  assert.match(page, /<select id="ruler-screen-size"/);
  assert.match(page, /<input id="ruler-custom-inches"/);
  assert.match(page, /id="ruler-custom-apply"/);
});
test('entering a diagonal updates the scale and persists it separately from card calibration', () => {
  assert.match(source, /function scaleFromDiagonal/);
  assert.match(source, /state\.scale = scale/);
  assert.match(source, /SIZE_STORAGE_KEY/);
  assert.match(source, /state\.mode = 'size'/);
  assert.match(source, /localStorage\.removeItem\(SIZE_STORAGE_KEY\)/);
});
test('screen-size controls are responsive without overflowing on narrow phones', () => {
  assert.match(mobile, /\.ruler-screen-size-picker\{/);
  assert.match(mobile, /\.ruler-custom-size\[hidden\]\{display:none!important\}/);
  assert.match(mobile, /grid-template-columns:minmax\(0,1fr\)/);
});
