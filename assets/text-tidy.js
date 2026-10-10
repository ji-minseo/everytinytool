'use strict';
(() => {
  const root = document.getElementById('quick-text-cleaner');
  if (!root) return;
  const byId = id => document.getElementById(id);
  const input = byId('tidy-input');
  const output = byId('tidy-output');
  const status = byId('tidy-status');
  const stats = byId('tidy-stats');
  const copyBtn = byId('tidy-copy');
  const cleanBtn = byId('tidy-clean');
  const options = {
    trim: byId('tidy-trim'),
    empty: byId('tidy-empty'),
    duplicates: byId('tidy-duplicates'),
    sort: byId('tidy-sort')
  };
  const EXAMPLE = '  Mint tea  \nCoffee\nMint tea\n\n  Green tea  \nCoffee\nWater\n';
  const MAX_CHARS = 100000;

  function cleanText(raw) {
    const original = raw.replace(/\r\n?/g, '\n').split('\n');
    let lines = original.map(s => options.trim.checked ? s.trim() : s);
    if (options.empty.checked) lines = lines.filter(s => s.trim().length > 0);
    if (options.duplicates.checked) {
      const seen = new Set();
      lines = lines.filter(s => {
        const key = s.trim().toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (options.sort.checked) lines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return { text: lines.join('\n'), before: original.length, after: lines.length };
  }

  function calculate() {
    const raw = input.value;
    if (raw.length > MAX_CHARS) {
      output.value = '';
      stats.textContent = 'Input is too long';
      status.textContent = 'Use up to 100,000 characters at a time.';
      copyBtn.disabled = true;
      return;
    }
    if (!raw.trim()) {
      output.value = '';
      stats.textContent = 'No lines yet';
      status.textContent = 'Paste a list or choose Try an example.';
      copyBtn.disabled = true;
      return;
    }
    const result = cleanText(raw);
    output.value = result.text;
    stats.textContent = result.before + ' lines in · ' + result.after + ' lines out';
    copyBtn.disabled = !result.text;
    status.textContent = 'List cleaned. Review the output, then copy it.';
  }

  cleanBtn.addEventListener('click', calculate);
  byId('tidy-example').addEventListener('click', () => {
    input.value = EXAMPLE;
    calculate();
    input.focus();
  });
  byId('tidy-clear').addEventListener('click', () => {
    input.value = '';
    output.value = '';
    stats.textContent = 'No lines yet';
    status.textContent = 'Cleared.';
    copyBtn.disabled = true;
    input.focus();
  });
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(output.value);
      } else {
        output.focus();
        output.select();
        if (!document.execCommand('copy')) throw new Error('Copy unavailable');
      }
      status.textContent = 'Copied cleaned text to clipboard.';
    } catch (_) {
      output.focus();
      output.select();
      status.textContent = 'Automatic copy was blocked. The result is selected; copy it manually.';
    }
  });
  root.querySelectorAll('input[type="checkbox"]').forEach(el => el.addEventListener('change', calculate));
})();
