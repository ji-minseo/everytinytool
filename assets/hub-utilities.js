'use strict';
/* Every Tiny Tool — text utilities. Inputs remain in this browser tab. */
(function () {
  const $ = (id) => document.getElementById(id);
  const splitLines = (input) => input.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  function uniqueLines(input, ignoreCase) {
    const seen = new Set();
    return splitLines(input).filter((line) => {
      const key = ignoreCase ? line.toLocaleLowerCase() : line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function compareLists(left, right, ignoreCase) {
    const a = uniqueLines(left, ignoreCase);
    const b = uniqueLines(right, ignoreCase);
    const key = (value) => ignoreCase ? value.toLocaleLowerCase() : value;
    const aKeys = new Set(a.map(key));
    const bKeys = new Set(b.map(key));
    return {
      onlyA: a.filter((item) => !bKeys.has(key(item))),
      both: a.filter((item) => bKeys.has(key(item))),
      onlyB: b.filter((item) => !aKeys.has(key(item))),
      sizeA: a.length,
      sizeB: b.length
    };
  }
  function countWords(text) {
    if (!text.trim()) return 0;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      let count = 0;
      for (const piece of segmenter.segment(text)) {
        if (piece.isWordLike) count++;
      }
      return count;
    }
    return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
  }
  function textMetrics(text) {
    if (!text.length) return { words: 0, characters: 0, noSpaces: 0, lines: 0, paragraphs: 0, seconds: 0 };
    const characters = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length
      : Array.from(text).length;
    const words = countWords(text);
    return {
      words,
      characters,
      noSpaces: typeof Intl !== 'undefined' && Intl.Segmenter
        ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.replace(/\s/gu, ''))].length
        : Array.from(text.replace(/\s/gu, '')).length,
      lines: text.replace(/\r\n?/g, '\n').split('\n').length,
      paragraphs: text.trim() ? text.trim().split(/\n\s*\n/).filter((chunk) => chunk.trim()).length : 0,
      seconds: Math.ceil((words / 200) * 60)
    };
  }
  async function copyText(value, status) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        status.textContent = 'Copied to clipboard.';
      } else {
        const proxy = document.createElement('textarea');
        proxy.value = value;
        proxy.style.position = 'fixed';
        proxy.style.left = '-9999px';
        document.body.appendChild(proxy);
        proxy.select();
        const ok = document.execCommand('copy');
        proxy.remove();
        if (!ok) throw new Error('Copy not supported');
        status.textContent = 'Copied to clipboard.';
      }
    } catch (_) {
      status.textContent = 'Copy is blocked by your browser. Select the text in the result box and copy manually.';
    }
  }
  function initListComparer() {
    if (!$('compare-lists')) return;
    const a = $('compare-a'), b = $('compare-b'), status = $('compare-status');
    const boxIds = ['compare-only-a', 'compare-both', 'compare-only-b'];
    const copyIds = ['copy-only-a', 'copy-both', 'copy-only-b'];
    function resetResults() {
      boxIds.forEach((id, index) => { $(id).value = ''; $(copyIds[index]).disabled = true; });
      ['count-only-a', 'count-both', 'count-only-b'].forEach((id) => { $(id).textContent = '0'; });
      $('compare-total').textContent = 'Add two lists to see unique and shared items.';
    }
    function compare() {
      if (a.value.length > 50000 || b.value.length > 50000) {
        resetResults();
        status.textContent = 'Limit each list to 50,000 characters.';
        return;
      }
      const linesA = splitLines(a.value), linesB = splitLines(b.value);
      if (!linesA.length || !linesB.length) {
        resetResults();
        status.textContent = 'Enter at least one non-empty item in each list.';
        return;
      }
      if (linesA.length > 5000 || linesB.length > 5000) {
        resetResults();
        status.textContent = 'Use up to 5,000 non-empty lines per list.';
        return;
      }
      const r = compareLists(a.value, b.value, $('compare-case').checked);
      const groups = [r.onlyA, r.both, r.onlyB];
      groups.forEach((group, index) => {
        $(boxIds[index]).value = group.join('\n');
        $(copyIds[index]).disabled = group.length === 0;
      });
      $('count-only-a').textContent = String(r.onlyA.length);
      $('count-both').textContent = String(r.both.length);
      $('count-only-b').textContent = String(r.onlyB.length);
      $('compare-total').textContent = 'List A: ' + r.sizeA + ' distinct items · List B: ' + r.sizeB + ' distinct items';
      status.textContent = 'Compared successfully. Matching uses the first appearance of each item.';
    }
    $('compare-run').addEventListener('click', compare);
    $('compare-example').addEventListener('click', () => {
      a.value = 'Apple\nBanana\nCherry\n  Mango\nApple';
      b.value = 'banana\nMango\nPeach\nPear\nPeach';
      $('compare-case').checked = true;
      compare();
    });
    $('compare-swap').addEventListener('click', () => {
      const old = a.value; a.value = b.value; b.value = old;
      if (a.value.trim() && b.value.trim()) compare(); else resetResults();
    });
    $('compare-clear').addEventListener('click', () => {
      a.value = ''; b.value = ''; resetResults();
      status.textContent = 'Lists cleared.';
      a.focus();
    });
    $('compare-case').addEventListener('change', () => {
      if (a.value.trim() && b.value.trim()) compare();
    });
    copyIds.forEach((id, index) => $(id).addEventListener('click', () => {
      const value = $(boxIds[index]).value;
      if (value) copyText(value, status);
    }));
    resetResults();
  }
  function initWordCounter() {
    if (!$('word-counter')) return;
    const input = $('word-input'), status = $('word-status');
    const fields = { words: 'metric-words', characters: 'metric-characters', noSpaces: 'metric-no-spaces', lines: 'metric-lines', paragraphs: 'metric-paragraphs' };
    const format = new Intl.NumberFormat();
    function refresh() {
      if (input.value.length > 100000) {
        status.textContent = 'Use 100,000 characters or fewer.';
        return;
      }
      const stats = textMetrics(input.value);
      Object.entries(fields).forEach(([name, id]) => { $(id).textContent = format.format(stats[name]); });
      $('metric-reading').textContent = stats.seconds === 0 ? '0 sec'
        : stats.seconds < 60 ? '≈ ' + stats.seconds + ' sec'
        : '≈ ' + Math.floor(stats.seconds / 60) + ' min ' + (stats.seconds % 60) + ' sec';
      status.textContent = input.value ? 'Counts updated as you type.' : 'Enter or paste text to begin.';
    }
    input.addEventListener('input', refresh);
    $('word-example').addEventListener('click', () => {
      input.value = 'A useful tool should solve a small problem clearly.\n\nThat is why we make simple calculators and text utilities.';
      refresh();
      input.focus();
    });
    $('word-clear').addEventListener('click', () => { input.value = ''; refresh(); input.focus(); });
    $('word-copy').addEventListener('click', () => {
      if (!input.value) { status.textContent = 'Add text before copying.'; return; }
      copyText(input.value, status);
    });
    refresh();
  }
  if (typeof document !== 'undefined') {
    initListComparer();
    initWordCounter();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { splitLines, uniqueLines, compareLists, countWords, textMetrics };
})();
