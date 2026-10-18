/* PDF Compressor · Image Everything
   Preserve PDF text and vector objects; selectively recompress eligible RGB
   JPEG image XObjects in place at user-selected quality. Never rasterize pages.
   The optional size goal is only a measured, best-effort target, not a forced
   instruction to lower quality further. Entire document stays in the browser.
*/
(function (root) {
  'use strict';

  const MB = 1000000;
  const MAX_BYTES = 180 * MB;
  const PRESET_MB = Object.freeze([100, 50, 10]);
  const MIN_QUALITY = 65;
  const DEFAULT_QUALITY = 80;
  const MAX_IMAGE_PIXELS = 12 * 1000 * 1000;
  const MIN_JPEG_BYTES = 24 * 1024;

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1000) return Math.round(bytes) + ' B';
    if (bytes < MB) return (bytes / 1000).toFixed(1) + ' KB';
    if (bytes < 1000 * MB) return (bytes / MB).toFixed(2) + ' MB';
    return (bytes / (1000 * MB)).toFixed(2) + ' GB';
  }
  function targetBytes(sizeMb) {
    if (sizeMb === '' || sizeMb === null || sizeMb === undefined) return null;
    const value = Number(sizeMb);
    if (!Number.isFinite(value) || value < .1 || value > 1000) return null;
    return Math.max(1, Math.ceil(value * MB) - 1);
  }
  function parseQuality(value) {
    const n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n) ||
        n < MIN_QUALITY || n > 100) return null;
    return Math.round(n);
  }
  function reductionPercent(input, output) {
    if (!(input > 0) || !Number.isFinite(output) || output < 0) return 0;
    return Math.max(0, Math.round((1 - output / input) * 1000) / 10);
  }
  function outputName(filename) {
    const base = String(filename || 'document').replace(/\.pdf$/i, '').trim() || 'document';
    return base + '-compressed.pdf';
  }
  function assessResult(originalBytes, resultBytes, limitBytes) {
    return {
      smaller: resultBytes < originalBytes,
      reached: limitBytes === null ? null : resultBytes <= limitBytes,
      saving: reductionPercent(originalBytes, resultBytes)
    };
  }
  async function validateFile(file) {
    if (!file) throw new Error('Choose a PDF file first.');
    if (file.size <= 0) throw new Error('This PDF file is empty.');
    if (file.size > MAX_BYTES) throw new Error('This browser tool accepts PDFs up to 180 MB.');
    const headerBytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const header = new TextDecoder('ascii').decode(headerBytes);
    if (!header.includes('%PDF-')) throw new Error('This does not look like a PDF file.');
  }

  // Only touch uncomplicated JPEG RGB image streams: leave masking,
  // transparency, indexed/ICC/CMYK colors, calibrated decoding and
  // more advanced image objects completely intact.
  function jpegCandidate(object, lib) {
    if (!object || !object.dict || typeof object.getContents !== 'function' ||
        !lib || !lib.PDFName) return null;
    const dict = object.dict;
    const get = name => dict.get(lib.PDFName.of(name));
    const str = name => {
      const found = get(name);
      return found && typeof found.toString === 'function' ? found.toString() : '';
    };
    if (str('Subtype') !== '/Image' || str('Filter') !== '/DCTDecode' ||
        str('ColorSpace') !== '/DeviceRGB' || str('BitsPerComponent') !== '8') return null;
    const incompatible = ['SMask', 'Mask', 'Decode', 'DecodeParms', 'ImageMask',
      'SMaskInData', 'Alternates', 'OPI', 'Metadata', 'Matte'];
    if (incompatible.some(name => get(name) !== undefined)) return null;
    // Don't drop unrecognized PDF image dictionary entries. The replacement
    // deliberately contains only the basic JPEG XObject keys listed here.
    const safeKeys = new Set(['Type', 'Subtype', 'Width', 'Height',
      'BitsPerComponent', 'ColorSpace', 'Filter', 'Length']);
    if (typeof dict.keys === 'function' && dict.keys().some(key =>
      !safeKeys.has(key.toString().replace(/^\//, '')))) return null;
    const widthObj = get('Width'), heightObj = get('Height');
    const width = widthObj && Number(widthObj.toString());
    const height = heightObj && Number(heightObj.toString());
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS) return null;
    const bytes = object.getContents();
    if (!(bytes instanceof Uint8Array) || bytes.length < MIN_JPEG_BYTES ||
        bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    return { width, height, bytes };
  }

  async function createDecodedJpeg(bytes) {
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    if (typeof root.createImageBitmap === 'function') {
      const bitmap = await root.createImageBitmap(blob);
      return { image: bitmap, close: () => bitmap.close && bitmap.close() };
    }
    // Safari fallback where createImageBitmap may be unavailable.
    if (typeof root.Image !== 'function' || !root.URL || !root.URL.createObjectURL) return null;
    const url = root.URL.createObjectURL(blob);
    const image = new root.Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('JPEG could not be decoded.'));
        image.src = url;
      });
      return { image, close: () => {} };
    } finally {
      root.URL.revokeObjectURL(url);
    }
  }

  async function encodeJpeg(bytes, width, height, quality) {
    const decoded = await createDecodedJpeg(bytes);
    if (!decoded || typeof document === 'undefined') return null;
    try {
      const image = decoded.image;
      if ((image.naturalWidth || image.width) !== width ||
          (image.naturalHeight || image.height) !== height) return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      try {
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return null;
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(
          item => item ? resolve(item) : reject(new Error('JPEG encoder returned no data.')),
          'image/jpeg', quality / 100
        ));
        if (blob.type !== 'image/jpeg' || blob.size >= bytes.length * .98) return null;
        const data = new Uint8Array(await blob.arrayBuffer());
        return data.length >= 4 && data[0] === 255 && data[1] === 216 &&
          data[data.length - 2] === 255 && data[data.length - 1] === 217 ? data : null;
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      decoded.close();
    }
  }

  async function recompressEmbeddedJpegs(pdf, quality, announce) {
    const summary = { eligible: 0, optimized: 0, skipped: 0, savings: 0 };
    if (quality === 100) return summary;
    const lib = root.PDFLib;
    if (!pdf || !pdf.context || !lib || !lib.PDFName) return summary;
    const objects = pdf.context.enumerateIndirectObjects();
    for (const [ref, object] of objects) {
      const candidate = jpegCandidate(object, lib);
      if (!candidate) continue;
      summary.eligible++;
      if (typeof announce === 'function') announce('Checking image ' + summary.eligible + '…');
      try {
        const optimized = await encodeJpeg(candidate.bytes, candidate.width, candidate.height, quality);
        if (!optimized) { summary.skipped++; continue; }
        const stream = pdf.context.stream(optimized, {
          Type: 'XObject', Subtype: 'Image',
          Width: candidate.width, Height: candidate.height,
          ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode'
        });
        pdf.context.assign(ref, stream);
        summary.optimized++;
        summary.savings += candidate.bytes.length - optimized.length;
      } catch (_) {
        // Unsupported JPEG or canvas failure: leave that image unchanged.
        summary.skipped++;
      }
    }
    return summary;
  }

  async function optimizePdf(file, settings, onStatus) {
    await validateFile(file);
    const args = settings && typeof settings === 'object'
      ? settings : { quality: DEFAULT_QUALITY, targetEnabled: true, limit: settings };
    const quality = parseQuality(args.quality);
    if (quality === null) throw new Error('Choose a quality between 65% and 100%.');
    const goal = args.targetEnabled ? targetBytes(args.limit) : null;
    if (args.targetEnabled && goal === null) {
      throw new Error('Enter an optional size limit between 0.1 and 1000 MB.');
    }
    if (!root.PDFLib || !root.PDFLib.PDFDocument) {
      throw new Error('The PDF optimizer did not load. Check your connection and try again.');
    }
    const announce = typeof onStatus === 'function' ? onStatus : () => {};
    let pdf;
    try {
      announce('Reading PDF structure…');
      pdf = await root.PDFLib.PDFDocument.load(
        new Uint8Array(await file.arrayBuffer()),
        { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true }
      );
      const jpeg = await recompressEmbeddedJpegs(pdf, quality, announce);
      announce('Optimizing document structure…');
      const bytes = await pdf.save({
        useObjectStreams: true, updateFieldAppearances: false,
        addDefaultPage: false, objectsPerTick: 50
      });
      if (!bytes || !bytes.length) throw new Error('The PDF optimizer returned an empty file.');
      if (bytes.length >= file.size) {
        return { blob: file, bytes: file.size, original: true,
          reached: goal === null ? null : file.size <= goal, saving: 0, reason: 'not-smaller',
          jpegImages: 0, eligibleImages: jpeg.eligible };
      }
      const result = assessResult(file.size, bytes.length, goal);
      return {
        blob: new Blob([bytes], { type: 'application/pdf' }),
        bytes: bytes.length, original: false, reached: result.reached,
        saving: result.saving, reason: result.reached === false ? 'partial' : 'optimized',
        jpegImages: jpeg.optimized, eligibleImages: jpeg.eligible
      };
    } catch (error) {
      if (error && (error.name === 'EncryptedPDFError' || /encrypt|password/i.test(error.message || ''))) {
        throw new Error('Password-protected or encrypted PDFs are not supported.');
      }
      throw error;
    }
  }

  function init() {
    const $ = id => document.getElementById(id);
    if (!$('pdf-compressor')) return;
    const dropzone = $('pdf-dropzone'), input = $('pdf-file');
    const choose = $('pdf-choose'), selected = $('pdf-file-selected');
    const filename = $('pdf-filename'), fileSize = $('pdf-original-label');
    const remove = $('pdf-remove'), quality = $('pdf-quality');
    const qualityValue = $('pdf-quality-value');
    const toggle = $('pdf-target-toggle'), targetOptions = $('pdf-target-options');
    const limitField = $('pdf-limit');
    const presets = [...document.querySelectorAll('[data-pdf-size]')];
    const runButton = $('pdf-compress'), status = $('pdf-status');
    const progress = $('pdf-progress'), result = $('pdf-result');
    const originalLabel = $('pdf-input-size'), outputLabel = $('pdf-output-size');
    const savedLabel = $('pdf-saved'), outputCaption = $('pdf-result-caption');
    const resultTitle = $('pdf-result-title'), resultNote = $('pdf-outcome');
    const bar = $('pdf-result-bar'), download = $('pdf-download');
    let file = null, busy = false, downloadUrl = null;

    function message(text, error = false) {
      status.textContent = text;
      status.dataset.error = String(error);
    }
    function clearResult() {
      result.hidden = true;
      download.hidden = true;
      download.removeAttribute('href');
      if (downloadUrl) root.URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    function updateControls() {
      runButton.disabled = !file || busy;
      choose.disabled = busy;
      remove.disabled = busy;
      input.disabled = busy;
      quality.disabled = busy;
      toggle.disabled = busy;
      limitField.disabled = busy || !toggle.checked;
      presets.forEach(button => { button.disabled = busy || !toggle.checked; });
    }
    function setFile(next) {
      if (busy) return;
      clearResult();
      file = next || null;
      input.value = '';
      selected.hidden = !file;
      if (file) {
        filename.textContent = file.name || 'document.pdf';
        fileSize.textContent = formatSize(file.size);
        message('Your file is ready. Choose a quality and compress.');
      } else {
        message('Files are processed locally in your browser. Nothing is uploaded.');
      }
      updateControls();
    }
    function setLimit(value) {
      if (busy) return;
      limitField.value = String(value);
      presets.forEach(button => button.classList.toggle(
        'active', Number(button.dataset.pdfSize) === Number(value)));
      clearResult();
    }
    function updateQuality() {
      qualityValue.textContent = quality.value + '%';
      clearResult();
    }
    function updateTarget() {
      targetOptions.hidden = !toggle.checked;
      updateControls();
      clearResult();
    }
    // Match the other image compressors: click anywhere in the upload area.
    // Ignore clicks bubbling from its button or the hidden file input itself,
    // otherwise a synthetic input.click() could reopen the picker recursively.
    function openFilePicker() {
      if (!busy) input.click();
    }
    choose.addEventListener('click', openFilePicker);
    dropzone.addEventListener('click', event => {
      if (busy || event.target === input || event.target.closest('button, input')) return;
      openFilePicker();
    });
    dropzone.addEventListener('keydown', event => {
      if (busy || event.target !== dropzone || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openFilePicker();
    });
    input.addEventListener('change', () => setFile(input.files && input.files[0]));
    remove.addEventListener('click', () => setFile(null));
    ['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => {
      event.preventDefault();
      if (!busy) dropzone.classList.add('dragover');
    }));
    ['drop', 'dragleave'].forEach(name => dropzone.addEventListener(name, event => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
      if (name === 'drop' && !busy && event.dataTransfer && event.dataTransfer.files.length) {
        setFile(event.dataTransfer.files[0]);
      }
    }));
    presets.forEach(button => button.addEventListener('click', () => setLimit(button.dataset.pdfSize)));
    limitField.addEventListener('input', () => setLimit(limitField.value));
    quality.addEventListener('input', updateQuality);
    toggle.addEventListener('change', updateTarget);

    runButton.addEventListener('click', async () => {
      if (!file || busy) return;
      const settings = {
        quality: quality.value,
        targetEnabled: toggle.checked,
        limit: limitField.value
      };
      if (parseQuality(settings.quality) === null) {
        message('Choose quality from 65% to 100%.', true); return;
      }
      if (settings.targetEnabled && targetBytes(settings.limit) === null) {
        message('Enter a file-size goal between 0.1 and 1000 MB.', true); return;
      }
      busy = true;
      updateControls();
      clearResult();
      progress.hidden = false;
      message('Optimizing PDF…');
      await new Promise(resolve => root.requestAnimationFrame
        ? root.requestAnimationFrame(resolve) : resolve());
      try {
        const outcome = await optimizePdf(file, settings, text => message(text));
        result.hidden = false;
        originalLabel.textContent = formatSize(file.size);
        outputLabel.textContent = formatSize(outcome.bytes);
        savedLabel.textContent = outcome.saving.toFixed(1) + '%';
        outputCaption.textContent = outcome.original ? 'Original file' : 'Compressed PDF';
        bar.style.width = Math.min(100, outcome.bytes / file.size * 100) + '%';

        const imageInfo = outcome.jpegImages > 0
          ? ' JPEG images optimized: ' + outcome.jpegImages + '.'
          : ' No compatible JPEG image was recompressed; quality may not change this PDF.';
        if (outcome.reason === 'not-smaller') {
          resultTitle.textContent = 'No smaller PDF available';
          resultNote.textContent = 'The original file was kept because the result would not be smaller.' + imageInfo;
        } else if (outcome.reached === true) {
          resultTitle.textContent = 'Target reached';
          resultNote.textContent = 'The output meets your optional limit.' + imageInfo +
            ' Check forms and signatures before use.';
        } else if (outcome.reached === false) {
          resultTitle.textContent = 'PDF compressed · target not reached';
          resultNote.textContent = 'Some bytes were saved, but your optional limit was not reached.' + imageInfo;
        } else {
          resultTitle.textContent = 'Your PDF is ready';
          resultNote.textContent = 'PDF structure optimized.' + imageInfo +
            ' Text and vector pages were not rasterized. Check forms and signatures before use.';
        }
        downloadUrl = root.URL.createObjectURL(outcome.blob);
        download.href = downloadUrl;
        download.download = outcome.original ? file.name : outputName(file.name);
        download.hidden = false;
        message(outcome.reached === false ? 'Finished — size goal not reached.' :
          'Finished — download your PDF.');
      } catch (error) {
        message(error && error.message ? error.message : 'This PDF could not be compressed.', true);
      } finally {
        progress.hidden = true;
        busy = false;
        updateControls();
      }
    });
    setLimit(10);
    updateQuality();
    updateTarget();
    updateControls();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MB, MAX_BYTES, PRESET_MB, DEFAULT_QUALITY, MIN_QUALITY,
      formatSize, targetBytes, parseQuality, reductionPercent, outputName,
      assessResult, validateFile, jpegCandidate, recompressEmbeddedJpegs, optimizePdf };
  }
})(typeof window !== 'undefined' ? window : {});
