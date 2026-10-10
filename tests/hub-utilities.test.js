'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitLines, uniqueLines, compareLists, countWords, textMetrics } = require('../assets/hub-utilities.js');

test('normalizes CRLF and trims empty lines', () => {
  assert.deepEqual(splitLines('  Apple\r\n\r\nBanana \rCherry\n'), ['Apple', 'Banana', 'Cherry']);
});
test('keeps first spelling of repeated lines', () => {
  assert.deepEqual(uniqueLines(' Apple \napple\nBANANA\nBanana', true), ['Apple', 'BANANA']);
  assert.deepEqual(uniqueLines('Apple\napple', false), ['Apple', 'apple']);
});
test('compares original-order groups without case sensitivity', () => {
  const result = compareLists('Apple\nBanana\nCherry\n Mango\nApple', 'banana\nMango\nPeach\nPear\nPeach', true);
  assert.deepEqual(result.onlyA, ['Apple', 'Cherry']);
  assert.deepEqual(result.both, ['Banana', 'Mango']);
  assert.deepEqual(result.onlyB, ['Peach', 'Pear']);
  assert.equal(result.sizeA, 4);
  assert.equal(result.sizeB, 4);
});
test('case-sensitive mode distinguishes Apple from apple', () => {
  const result = compareLists('Apple', 'apple', false);
  assert.deepEqual(result.onlyA, ['Apple']);
  assert.deepEqual(result.both, []);
  assert.deepEqual(result.onlyB, ['apple']);
});
test('empty inputs produce no false matches', () => {
  const result = compareLists('', '', true);
  assert.deepEqual(result, { onlyA: [], both: [], onlyB: [], sizeA: 0, sizeB: 0 });
});
test('word and character totals agree with a simple example', () => {
  const r = textMetrics('Hello world!');
  assert.equal(r.words, 2);
  assert.equal(r.characters, 12);
  assert.equal(r.noSpaces, 11);
  assert.equal(r.lines, 1);
  assert.equal(r.paragraphs, 1);
});
test('line breaks and paragraphs count separately', () => {
  const r = textMetrics('First line\nSecond line\n\nThird line');
  assert.equal(r.lines, 4);
  assert.equal(r.paragraphs, 2);
});
test('Unicode grapheme clusters count as one visible character in modern Node', () => {
  const r = textMetrics('👍🏽');
  assert.equal(r.characters, 1);
  assert.equal(r.noSpaces, 1);
});
test('reading duration is estimated at 200 words per minute', () => {
  assert.equal(textMetrics('one two three four').seconds, 2);
  assert.equal(textMetrics('').seconds, 0);
  assert.equal(countWords('One two three'), 3);
});
