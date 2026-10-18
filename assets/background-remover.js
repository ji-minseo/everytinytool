/* Image Everything — Background Remover
   Client-side inference: Transformers.js (Apache 2.0) with the
   Apache-2.0 onnx-community/ormbg-ONNX model.
   No image upload: files enter RawImage.fromBlob in this browser.
   The first run downloads a large model; processing is best effort.
*/
(function (root) {
  'use strict';
  const MODEL_ID = 'onnx-community/ormbg-ONNX';
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
  const MAX_INPUT_BYTES = 12 * 1024 * 1024;
  const MAX_INPUT_PIXELS = 16 * 1000 * 1000;
  const SUPPORTED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
  let modelPromise = null;

  function validImage(file) {
    if (!file) return 'Choose an image first.';
    if (!SUPPORTED_TYPES.includes(String(file.type || '').toLowerCase())) {
      return 'Use a JPG, PNG or WebP image.';
    }
    if (file.size <= 0) return 'This image appears to be empty.';
    if (file.size > MAX_INPUT_BYTES) return 'Choose an image under 12 MB for browser processing.';
    return '';
  }

  function outputFileName(name, extension) {
    const base = String(name || 'image').replace(/\.[^.]+$/, '').trim()
      .replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) || 'image';
    return base + '-no-background.' + (extension === 'jpg' ? 'jpg' : 'png');
  }

  function formatBytes(bytes) {
    if (!(bytes >= 0)) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function backgroundColor(mode, custom) {
    if (mode === 'white') return '#ffffff';
    if (mode === 'black') return '#000000';
    if (mode === 'custom') {
      return /^#[a-f\d]{6}$/i.test(String(custom)) ? custom : '#f1e6ff';
    }
    return null;
  }

  function isValidImageSize(width, height) {
    return Number.isSafeInteger(width) && Number.isSafeInteger(height) &&
      width > 0 && height > 0 && width * height <= MAX_INPUT_PIXELS;
  }

  function progressMessage(event) {
    if (!event || typeof event !== 'object') return 'Preparing background removal model…';
    if (event.status === 'progress' && Number.isFinite(event.progress)) {
      return 'Downloading AI model… ' + Math.max(0, Math.min(100, Math.round(event.progress))) + '%';
    }
    if (event.status === 'download' || event.status === 'initiate') {
      return 'Downloading the AI model for the first use…';
    }
    if (event.status === 'done') return 'Model file ready. Preparing segmentation…';
    if (event.status === 'ready') return 'Model ready. Removing the background…';
    return 'Preparing background removal model…';
  }

  async function loadModel(onProgress, loadLibrary) {
    if (!modelPromise) {
      modelPromise = (async () => {
        const load = loadLibrary || (url => import(url));
        const lib = await load(MODULE_URL);
        if (typeof lib.pipeline !== 'function' || !lib.RawImage ||
            typeof lib.RawImage.fromBlob !== 'function') {
          throw new Error('The AI library could not initialize in this browser.');
        }
        const segmenter = await lib.pipeline('background-removal', MODEL_ID, {
          device: 'wasm',
          dtype: 'q8',
          progress_callback: event => {
            if (typeof onProgress === 'function') onProgress(progressMessage(event));
          }
        });
        return { lib, segmenter };
      })().catch(err => {
        modelPromise = null; // permit retry after interrupted downloads
        throw err;
      });
    }
    return modelPromise;
  }

  async function removeBackground(file, onProgress, loader) {
    const error = validImage(file);
    if (error) throw new Error(error);
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    progress('Loading local AI background remover…');
    const { lib, segmenter } = await loadModel(progress, loader);
    progress('Reading your image locally…');
    const source = await lib.RawImage.fromBlob(file);
    if (!isValidImageSize(source.width, source.height)) {
      throw new Error('This image is too large to process safely in a browser. Resize it to 16 megapixels or less.');
    }
    progress('Detecting the foreground. This may take a little while…');
    // The official background-removal pipeline returns an RGBA RawImage at
    // the original dimensions, with the background encoded in its alpha.
    const output = await segmenter(source);
    const foreground = Array.isArray(output) ? output[0] : output;
    if (!foreground || foreground.channels !== 4 ||
        foreground.width !== source.width || foreground.height !== source.height ||
        typeof foreground.toBlob !== 'function') {
      throw new Error('The AI did not return a compatible transparent image. Try another photo.');
    }
    const blob = await foreground.toBlob('image/png');
    if (!blob || blob.size === 0) throw new Error('The output image could not be saved.');
    return { blob, width: foreground.width, height: foreground.height };
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  async function decodeImage(blob) {
    if (typeof root.createImageBitmap === 'function') {
      const bitmap = await root.createImageBitmap(blob);
      return { image: bitmap, close() { if (bitmap.close) bitmap.close(); } };
    }
    return new Promise((resolve, reject) => {
      const url = root.URL.createObjectURL(blob);
      const image = new root.Image();
      image.onload = () => {
        root.URL.revokeObjectURL(url);
        resolve({ image, close() {} });
      };
      image.onerror = () => {
        root.URL.revokeObjectURL(url);
        reject(new Error('The background-free preview could not be decoded.'));
      };
      image.src = url;
    });
  }

  async function withBackground(blob, color) {
    if (!color) return blob; // original PNG with actual alpha
    const decoded = await decodeImage(blob);
    try {
      const width = decoded.image.naturalWidth || decoded.image.width;
      const height = decoded.image.naturalHeight || decoded.image.height;
      if (!isValidImageSize(width, height)) {
        throw new Error('The output image dimensions are unsupported.');
      }
      const canvas = makeCanvas(width, height);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('This browser cannot export the image.');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.image, 0, 0, width, height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(result => result && result.size > 0
          ? resolve(result) : reject(new Error('The image export failed.')),
          'image/jpeg', 0.92));
    } finally {
      decoded.close();
    }
  }

  function init(dependencies) {
    const executeRemoval = dependencies && dependencies.removeBackground || removeBackground;
    const $ = id => document.getElementById(id);
    if (!$('bg-remover')) return;
    const zone = $('bg-dropzone'), input = $('bg-file'), uploadThumb = $('bg-file-thumbnail');
    const choose = $('bg-choose'), selected = $('bg-selected');
    const filename = $('bg-filename'), fileMeta = $('bg-filemeta');
    const clear = $('bg-remove-file'), run = $('bg-run');
    const progress = $('bg-progress'), progressText = $('bg-progress-text');
    const status = $('bg-status'), result = $('bg-result');
    const originalPreview = $('bg-before'), removedPreview = $('bg-after');
    const afterFrame = $('bg-after-frame'), resultMeta = $('bg-result-meta');
    const download = $('bg-download'), bgButtons = [...document.querySelectorAll('[data-bg-mode]')];
    const colorField = $('bg-custom-color'), customWrap = $('bg-custom-wrap');
    let file = null, originalUrl = null, resultUrl = null, outputBlob = null;
    let mode = 'transparent', busy = false, lastFileName = '';
    let exporting = false;

    function inform(message, isError = false) {
      status.textContent = message;
      status.dataset.error = String(isError);
    }
    function revoke(url) { if (url) root.URL.revokeObjectURL(url); }
    function resetResult() {
      result.hidden = true;
      outputBlob = null;
      revoke(resultUrl);
      resultUrl = null;
      removedPreview.removeAttribute('src');
      download.removeAttribute('href');
    }
    function refresh() {
      run.disabled = busy || !file;
      input.disabled = busy;
      choose.disabled = busy;
      clear.disabled = busy;
      bgButtons.forEach(button => { button.disabled = busy || !outputBlob; });
      colorField.disabled = busy || !outputBlob;
      download.setAttribute('aria-disabled', String(busy || exporting));
      if (!outputBlob) download.removeAttribute('href');
      zone.setAttribute('aria-busy', String(busy));
    }
    function chooseFile(next) {
      if (busy) return;
      resetResult();
      revoke(originalUrl);
      originalUrl = null;
      file = null;
      input.value = '';
      uploadThumb.removeAttribute('src');

      const error = validImage(next);
      if (next && error) {
        selected.hidden = true;
        originalPreview.removeAttribute('src');
        inform(error, true);
      } else if (next) {
        file = next;
        lastFileName = next.name || 'image';
        originalUrl = root.URL.createObjectURL(next);
        originalPreview.src = originalUrl;
        uploadThumb.src = originalUrl;

        selected.hidden = false;
        filename.textContent = lastFileName;
        fileMeta.textContent = formatBytes(next.size) + ' · JPG / PNG / WebP';
        inform('Image ready. Choose Remove background to begin.');
      } else {
        selected.hidden = true;
        originalPreview.removeAttribute('src');
        inform('Your image is processed locally. No uploads to our server.');
      }
      refresh();
    }
    function setMode(next) {
      if (!['transparent', 'white', 'black', 'custom'].includes(next)) return;
      mode = next;
      bgButtons.forEach(button => {
        const active = button.dataset.bgMode === mode;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('active', active);
      });
      const chosen = backgroundColor(mode, colorField.value);
      afterFrame.classList.toggle('checker', !chosen);
      afterFrame.style.backgroundColor = chosen || '';
      customWrap.hidden = mode !== 'custom';
      download.textContent = chosen ? 'Download JPG ↓' : 'Download transparent PNG ↓';
      if (outputBlob) {
        download.download = outputFileName(lastFileName, chosen ? 'jpg' : 'png');
      }
    }
    function openPicker() { if (!busy) input.click(); }

    choose.addEventListener('click', openPicker);
    zone.addEventListener('click', event => {
      if (busy || event.target === input ||
          (event.target.closest && event.target.closest('button, input, a, label'))) return;
      openPicker();
    });
    zone.addEventListener('keydown', event => {
      if (busy || event.target !== zone || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openPicker();
    });
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) chooseFile(input.files[0]);
    });
    clear.addEventListener('click', () => chooseFile(null));
    ['dragenter', 'dragover'].forEach(eventName => zone.addEventListener(eventName, event => {
      event.preventDefault();
      if (!busy) zone.classList.add('dragover');
    }));
    ['drop', 'dragleave'].forEach(eventName => zone.addEventListener(eventName, event => {
      event.preventDefault();
      zone.classList.remove('dragover');
      if (eventName === 'drop' && !busy && event.dataTransfer && event.dataTransfer.files.length) {
        chooseFile(event.dataTransfer.files[0]);
      }
    }));

    bgButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.bgMode)));
    colorField.addEventListener('input', () => setMode('custom'));

    run.addEventListener('click', async () => {
      if (busy || !file) return;
      busy = true;
      resetResult();
      progress.hidden = false;
      refresh();
      inform('Preparing background removal…');
      try {
        // Let the browser paint the loading indicator before model loading.
        await new Promise(resolve => root.requestAnimationFrame
          ? root.requestAnimationFrame(resolve) : resolve());
        const rendered = await executeRemoval(file, message => {
          progressText.textContent = message;
          inform(message);
        });
        outputBlob = rendered.blob;
        revoke(resultUrl);
        resultUrl = root.URL.createObjectURL(outputBlob);
        removedPreview.src = resultUrl;
        resultMeta.textContent = rendered.width + ' × ' + rendered.height + ' px · transparent PNG';
        result.hidden = false;
        setMode(mode);
        inform('Background removed! Preview and download your image.');
      } catch (err) {
        inform(err && err.message
          ? err.message + ' Try a smaller image or a different browser.'
          : 'Background removal failed. Try another photo.', true);
      } finally {
        busy = false;
        progress.hidden = true;
        refresh();
      }
    });

    download.addEventListener('click', async event => {
      if (!outputBlob || busy || exporting) { event.preventDefault(); return; }
      const color = backgroundColor(mode, colorField.value);
      if (!color) {
        const anchor = download;
        const old = resultUrl;
        if (!old) { event.preventDefault(); return; }
        anchor.href = old;
        anchor.download = outputFileName(lastFileName, 'png');
        return; // Native anchor download for transparent PNG.
      }
      event.preventDefault();
      exporting = true;
      refresh();
      try {
        const rendered = await withBackground(outputBlob, color);
        const href = root.URL.createObjectURL(rendered);
        const link = document.createElement('a');
        link.href = href;
        link.download = outputFileName(lastFileName, 'jpg');
        document.body.appendChild(link);
        link.click();
        link.remove();
        root.setTimeout(() => root.URL.revokeObjectURL(href), 1500);
      } catch (err) {
        inform((err && err.message) || 'Could not export a JPG.', true);
      } finally {
        exporting = false;
        refresh();
      }
    });

    // Set the href for native transparent-PNG downloads once the result exists.
    removedPreview.addEventListener('load', () => {
      if (resultUrl && outputBlob) download.href = resultUrl;
    });
    setMode('transparent');
    refresh();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MODEL_ID, MODULE_URL, MAX_INPUT_BYTES, MAX_INPUT_PIXELS,
      validImage, outputFileName, formatBytes, backgroundColor, isValidImageSize,
      progressMessage, loadModel, removeBackground, init };
  }
})(typeof window !== 'undefined' ? window : {});
