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

test('screen diagonal picker populates contextual presets after device detection', () => {
  assert.match(page, /<select id="ruler-screen-size"/);
  assert.match(page, /id="ruler-screen-size-label"/);
  assert.match(page, /<input id="ruler-custom-inches"/);
  assert.match(page, /id="ruler-custom-apply"/);
  assert.match(source, /function screenSizePresets/);
  assert.match(source, /populateScreenSizeOptions\(\)/);
  assert.match(source, /sizeSelect\.replaceChildren\(\)/);
  assert.ok(!page.includes('<option value="13">'), 'Laptop sizes must not flash in the initial phone markup');
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

test('mobile ruler reveals significantly more actual-height measurement space', () => {
  assert.match(mobile, /height:clamp\(420px,78svh,920px\)/);
  assert.match(mobile, /\.ruler-scroll\.ruler-is-vertical\{/);
  // Do not fake extra centimeters by changing the pixels-per-millimeter calculation.
  assert.match(source, /const total = maxMm \* state\.scale \+ start \+ 26/);
});
test('model example choices still save only the inch size as numeric value', () => {
  assert.match(source, /formatScreenSizeOption\(size, presets\.kind\)/);
  assert.match(source, /addOption\(size, formatScreenSizeOption\(size, presets\.kind\)\)/);
  assert.match(source, /option\.value = String\(value\)/);
  assert.match(source, /Model names are examples, not automatic identification/);
});

test('Windows laptops and desktop monitor sizes have separate selection groups', () => {
  assert.match(source, /kind === 'windows-computer'/);
  assert.match(source, /'Windows laptops', presets\.laptopSizes/);
  assert.match(source, /'Desktop monitors', presets\.monitorSizes/);
  assert.match(source, /document\.createElement\('optgroup'\)/);
  assert.match(source, /group\.label = label/);
  assert.match(source, /sizeSelect\.appendChild\(group\)/);
});
test('Android-specific screen choices show Galaxy and Pixel model examples', () => {
  assert.match(source, /kind: 'android-phone'/);
  assert.match(source, /'Pixel 9 \/ Pixel 9 Pro'/);
  assert.match(source, /'Galaxy S25 Ultra'/);
  assert.match(source, /addOption\(size, formatScreenSizeOption\(size, presets\.kind\)/);
});
