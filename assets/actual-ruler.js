'use strict';
/* Screen ruler — measurements only become physically meaningful after user calibration. */
(function () {
  const STANDARD_PX_PER_MM = 96 / 25.4;
  const CARD_SHORT_MM = 53.98;
  const CARD_LONG_MM = 85.60;
  const STORAGE_KEY = 'everytinytool-ruler-calibration-v2';
  const OLD_STORAGE_KEY = 'everytinytool-ruler-calibration-v1';
  const SIZE_STORAGE_KEY = 'everytinytool-ruler-diagonal-v1';
  const MIN_SCALE = 2;
  const MAX_SCALE = 12;

  function clampScale(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, n)) : STANDARD_PX_PER_MM;
  }
  /* Resolution and device-pixel ratio alone do not expose a screen's physical size.
     Use well-known display families where confidently recognizable, otherwise
     show a clearly labelled approximate starting scale. */
  function estimateScreenScale(display) {
    const width = Number(display.width) || 0;
    const height = Number(display.height) || 0;
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    const dpr = Number(display.dpr) > 0 ? Number(display.dpr) : 1;
    const ua = String(display.userAgent || '');
    const platform = String(display.platform || '');
    const ipad = /iPad/i.test(ua) ||
      (/Macintosh/i.test(ua) && Number(display.touchPoints) > 1);
    const iphone = /iPhone|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const appleLaptop = !ipad && !iphone && /Macintosh/i.test(ua) && Number(display.touchPoints) === 0;
    const matching = (profiles) => profiles.find(([w, h, pixelRatio]) =>
      Math.abs(short - w) <= 2 && Math.abs(long - h) <= 3 &&
      Math.abs(dpr - pixelRatio) < 0.16);
    let pixelsPerMm = STANDARD_PX_PER_MM;
    let label = 'Browser reference scale';
    let confidence = 'reference';

    if (iphone) {
      const preset = matching([
        [320, 568, 2, 326],
        [375, 667, 2, 326],
        [414, 736, 3, 401],
        [375, 812, 3, 458],
        [360, 780, 3, 476],
        [390, 844, 3, 460],
        [393, 852, 3, 460],
        [402, 874, 3, 460],
        [414, 896, 2, 326],
        [414, 896, 3, 458],
        [428, 926, 3, 458],
        [430, 932, 3, 460],
        [440, 956, 3, 460]
      ]);
      const ppi = preset ? preset[3] : dpr >= 2.7 ? 460 : 326;
      pixelsPerMm = ppi / dpr / 25.4;
      label = preset ? 'iPhone resolution profile' : 'iPhone family estimate';
      confidence = preset ? 'profile' : 'family';
    } else if (ipad) {
      const preset = matching([
        [744, 1133, 2, 326],
        [820, 1180, 2, 264],
        [834, 1194, 2, 264],
        [834, 1112, 2, 264],
        [810, 1080, 2, 264],
        [1024, 1366, 2, 264],
        [1032, 1376, 2, 264]
      ]);
      const ppi = preset ? preset[3] : 264;
      pixelsPerMm = ppi / dpr / 25.4;
      label = preset ? 'iPad resolution profile' : 'iPad family estimate';
      confidence = preset ? 'profile' : 'family';
    } else if (android && (/Mobile/i.test(ua) || short < 530)) {
      // Unknown Android model: approximate physical display widths only.
      // This is intentionally a soft starting point, never a verified PPI.
      const estimatedWidthMm = short < 380 ? 65 : short < 410 ? 68 : short < 440 ? 72 : 76;
      pixelsPerMm = short > 0 ? short / estimatedWidthMm : STANDARD_PX_PER_MM;
      label = 'Android phone size estimate';
      confidence = 'family';
    } else if (android && short >= 530 && short <= 1100) {
      const estimatedWidthMm = short < 800 ? 140 : 190;
      pixelsPerMm = short / estimatedWidthMm;
      label = 'Android tablet size estimate';
      confidence = 'family';
    } else if (appleLaptop && dpr >= 1.8 &&
      short >= 800 && short <= 1118 && long >= 1280 && long <= 1728) {
      pixelsPerMm = 220 / dpr / 25.4;
      label = 'Mac Retina laptop estimate';
      confidence = 'family';
    } else {
      // Desktops and unfamiliar screens cannot be assigned a reliable
      // physical density from resolution alone.
      label = 'Browser 96px/in reference';
      confidence = 'reference';
    }
    return {
      scale: clampScale(pixelsPerMm),
      label,
      confidence,
      screen: Math.round(short) + ' × ' + Math.round(long) + ' CSS px',
      dpr,
      source: confidence === 'profile' ? 'Known display-size family' :
        confidence === 'family' ? 'Device-type size estimate' : 'Unidentified physical display'
    };
  }
  function screenInfo() {
    return {
      width: window.screen.width,
      height: window.screen.height,
      dpr: window.devicePixelRatio || 1,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      touchPoints: navigator.maxTouchPoints || 0
    };
  }
  function screenFingerprint() {
    const screen = screenInfo();
    return [Math.min(screen.width, screen.height), Math.max(screen.width, screen.height), Number(screen.dpr.toFixed(2))].join(':');
  }
  function screenSizePresets(display) {
    const ua = String(display.userAgent || '');
    const short = Math.min(Number(display.width) || 0, Number(display.height) || 0);
    const touches = Number(display.touchPoints) || 0;
    const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && touches > 1);
    const iphone = /iPhone|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const phone = iphone || (android && (/Mobile/i.test(ua) || short < 530));
    const tablet = ipad || (android && !phone) ||
      (!phone && touches > 0 && short >= 530 && short < 1100 && /Tablet/i.test(ua));
    if (phone) return {
      kind: 'phone',
      label: 'Phone screen diagonal',
      sizes: [5.4, 5.8, 6.1, 6.3, 6.5, 6.7, 6.9, 7.0]
    };
    if (tablet) return {
      kind: 'tablet',
      label: 'Tablet screen diagonal',
      sizes: [7.9, 8.3, 9.7, 10.2, 10.5, 10.9, 11, 12.4, 12.9, 13]
    };
    return {
      kind: 'computer',
      label: 'Laptop / monitor diagonal',
      sizes: [13, 13.3, 13.6, 14, 15, 15.6, 16, 17, 21.5, 24, 27, 32]
    };
  }
  function scaleFromDiagonal(display, diagonalInches) {
    const width = Number(display.width);
    const height = Number(display.height);
    const inches = Number(diagonalInches);
    if (!Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(height) || height <= 0 ||
        !Number.isFinite(inches) || inches < 4 || inches > 80) return null;
    // screen.width and screen.height use CSS pixels, so no DPR multiplier here.
    // Given a physical diagonal, their ratio gives CSS pixels per millimeter.
    const scale = Math.hypot(width, height) / (inches * 25.4);
    return Number.isFinite(scale) && scale >= MIN_SCALE && scale <= MAX_SCALE ? scale : null;
  }
  function toUnits(mm) {
    return {
      mm: Math.round(mm * 10) / 10,
      cm: Math.round(mm * 100) / 1000,
      inch: Math.round((mm / 25.4) * 1000) / 1000
    };
  }
  function pretty(value) {
    return String(Number(value.toFixed(3)));
  }
  function lengthLabel(mm, unit) {
    const u = toUnits(mm);
    if (unit === 'inch') return pretty(u.inch) + ' in';
    return pretty(u[unit]) + ' ' + unit;
  }
  function buildTicks(unit) {
    const maxMm = unit === 'inch' ? 304.8 : 300;
    const count = unit === 'inch' ? 192 : 300;
    const ticks = [];
    for (let index = 0; index <= count; index++) {
      const mm = unit === 'inch' ? index * (25.4 / 16) : index;
      const major = unit === 'inch' ? index % 16 === 0 : index % 10 === 0;
      const mid = unit === 'inch' ? index % 4 === 0 : index % 5 === 0;
      let label = null;
      if (major) label = String(unit === 'inch' ? index / 16 : unit === 'cm' ? index / 10 : index);
      ticks.push({ mm, major, mid, label });
    }
    return { maxMm, ticks };
  }
  function shouldStartVertical(viewportWidth) {
    return Number.isFinite(viewportWidth) && viewportWidth <= 650;
  }
  function zoomSignature() {
    return Number((window.devicePixelRatio || 1).toFixed(2));
  }
  function init() {
    const root = document.getElementById('actual-ruler');
    if (!root) return;
    const $ = (id) => document.getElementById(id);
    const canvas = $('ruler-canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      $('ruler-status').textContent = 'This browser could not display the ruler. Try an updated browser.';
      return;
    }
    const detected = estimateScreenScale(screenInfo());
    const state = {
      scale: detected.scale,
      estimate: detected,
      mode: 'auto',
      diagonalInches: null,
      calibrated: false,
      signature: zoomSignature(),
      screenId: screenFingerprint(),
      referenceMm: shouldStartVertical(window.innerWidth) ? CARD_SHORT_MM : CARD_LONG_MM,
      unit: 'cm',
      vertical: shouldStartVertical(window.innerWidth),
      selectedMm: null
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const old = raw ? null : localStorage.getItem(OLD_STORAGE_KEY);
      const saved = JSON.parse(raw || old || 'null');
      const sameDisplay = raw
        ? saved && saved.screenId === state.screenId
        : saved && Number.isFinite(saved.signature) &&
          Math.abs(saved.signature - state.signature) < 0.02;
      if (sameDisplay && saved.calibrated &&
          Number.isFinite(saved.scale) && saved.scale >= MIN_SCALE && saved.scale <= MAX_SCALE) {
        // Respect a previously verified physical card calibration.
        state.scale = saved.scale;
        state.mode = 'card';
        state.calibrated = true;
      }
    } catch (_) { /* Private mode may prevent storage. The ruler still works. */ }
    if (state.mode === 'auto') {
      try {
        const savedSize = JSON.parse(localStorage.getItem(SIZE_STORAGE_KEY) || 'null');
        if (savedSize && savedSize.screenId === state.screenId) {
          const restoredScale = scaleFromDiagonal(screenInfo(), savedSize.inches);
          if (restoredScale !== null) {
            state.scale = restoredScale;
            state.mode = 'size';
            state.diagonalInches = Number(savedSize.inches);
          }
        }
      } catch (_) { /* Screen-size setting remains optional. */ }
    }

    const unitButtons = [...document.querySelectorAll('[data-ruler-unit]')];
    const orientationButtons = [...document.querySelectorAll('[data-ruler-direction]')];
    const refButtons = [...document.querySelectorAll('[data-ruler-reference]')];
    const calibrationInput = $('card-calibration');
    const guide = $('ruler-card-guide');
    const scrollPanel = $('ruler-scroll');
    const surface = $('ruler-surface');
    const status = $('ruler-status');
    const scaleStatus = $('calibration-status');
    const badge = $('ruler-calibration-badge');
    const readout = $('ruler-selected');
    const readoutOther = $('ruler-selected-other');
    const zoomAlert = $('ruler-zoom-note');
    const detectionDetails = $('ruler-device-details');
    const sizeSelect = $('ruler-screen-size');
    const customSizeField = $('ruler-custom-size-wrap');
    const customInches = $('ruler-custom-inches');
    const sizeStatus = $('ruler-size-status');
    const sizeLabel = $('ruler-screen-size-label');
    const sizeHelp = $('ruler-size-help');
    function populateScreenSizeOptions() {
      const presets = screenSizePresets(screenInfo());
      sizeLabel.textContent = presets.label;
      sizeHelp.textContent = 'Select the physical ' + presets.kind +
        ' screen diagonal, not its resolution or browser window size. If yours is not listed, choose Another size.';
      sizeSelect.replaceChildren();
      const addOption = (value, label) => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = label;
        sizeSelect.appendChild(option);
      };
      addOption('auto', 'Auto estimate (approximate)');
      for (const size of presets.sizes) addOption(size, size + ' inches');
      addOption('custom', 'Another size…');
    }
    populateScreenSizeOptions();
    let compactLayout = shouldStartVertical(window.innerWidth);
    detectionDetails.open = !compactLayout;

    function syncSizeControls() {
      if (state.mode === 'size' && state.diagonalInches !== null) {
        const option = [...sizeSelect.options].find((item) => item.value === String(state.diagonalInches));
        sizeSelect.value = option ? option.value : 'custom';
        customInches.value = String(state.diagonalInches);
        customSizeField.hidden = Boolean(option);
      } else {
        sizeSelect.value = 'auto';
        customSizeField.hidden = true;
      }
    }
    function updateCalibrationUI(message) {
      syncSizeControls();
      const ref = state.referenceMm;
      calibrationInput.value = String(state.scale);
      guide.style.width = (state.scale * ref) + 'px';
      $('ruler-reference-size').textContent = ref.toFixed(2) + ' mm';
      $('ruler-reference-description').textContent = ref === CARD_SHORT_MM ? 'Short edge of a standard bank card' : 'Long edge of a standard bank card';
      const compact = shouldStartVertical(window.innerWidth);
      badge.textContent = state.calibrated
        ? (compact ? 'Card · saved' : 'Card calibrated · saved')
        : state.mode === 'size'
          ? (compact ? 'Screen size · set' : state.diagonalInches + '″ diagonal · estimated')
          : state.mode === 'auto'
            ? (compact ? 'Auto · estimate' : 'Auto-sized · estimated')
            : (compact ? 'Not saved' : 'Fine-tuning · unsaved');
      badge.dataset.ready = state.calibrated ? 'true' : 'false';
      status.textContent = state.calibrated
        ? 'Your saved card calibration takes priority. Recheck after zoom or display changes.'
        : state.mode === 'size'
          ? 'Calculated using your ' + state.diagonalInches + '-inch screen and reported resolution. Check with a real card.'
          : state.mode === 'auto'
            ? 'Rough screen estimate. The browser cannot determine your exact diagonal size.'
            : 'Guide width changed. Save only after matching a physical card edge.';
      $('ruler-detected-device').textContent = state.mode === 'size'
        ? state.diagonalInches + '″ screen diagonal · selected'
        : state.estimate.label;
      $('ruler-detected-resolution').textContent = state.estimate.screen +
        ' · DPR ' + Number(state.estimate.dpr.toFixed(2)) +
        ' · ' + (state.mode === 'size' ? 'diagonal entered by you' : state.estimate.source);
      $('ruler-estimate-status').textContent = state.calibrated
        ? 'Using your saved card calibration.'
        : state.mode === 'size'
          ? 'Calculated from ' + state.diagonalInches + '″ + ' + state.estimate.screen + '. Not verified with a physical ruler.'
          : state.mode === 'auto'
            ? 'Approximate device-family estimate; physical screen diagonal not detected.'
            : 'Manual adjustment in progress. Check against the card before saving.';
      if (message) scaleStatus.textContent = message;
      zoomAlert.hidden = state.screenId === screenFingerprint();
    }
    function updateRefButtons() {
      for (const button of refButtons) {
        const active = Number(button.dataset.rulerReference) === state.referenceMm;
        button.setAttribute('aria-pressed', String(active));
      }
    }
    function measureLabels() {
      const maxMm = buildTicks(state.unit).maxMm;
      if (state.selectedMm === null) {
        readout.textContent = shouldStartVertical(window.innerWidth) ? 'Tap to measure' : 'Choose a point on the ruler';
        readoutOther.textContent = shouldStartVertical(window.innerWidth)
          ? 'Swipe ruler · tap a point' : 'Tap or click the ruler to measure from zero.';
        canvas.setAttribute('aria-valuenow', '0');
        canvas.setAttribute('aria-valuetext', 'No point selected');
        return;
      }
      state.selectedMm = Math.max(0, Math.min(maxMm, state.selectedMm));
      const u = toUnits(state.selectedMm);
      readout.textContent = lengthLabel(state.selectedMm, state.unit);
      readoutOther.textContent = pretty(u.mm) + ' mm · ' + pretty(u.cm) + ' cm · ' + pretty(u.inch) + ' in';
      canvas.setAttribute('aria-valuenow', String(Math.round(state.selectedMm)));
      canvas.setAttribute('aria-valuetext', readoutOther.textContent);
    }
    function render() {
      const { maxMm, ticks } = buildTicks(state.unit);
      const start = 20;
      // On mobile, the vertical canvas fills the measuring surface.
      // Tick marks stay in a 112px rail, while centimeter guides fill the rest.
      const mobileVertical = state.vertical && shouldStartVertical(window.innerWidth);
      const barWidth = mobileVertical ? Math.max(118, scrollPanel.clientWidth) : 118;
      const total = maxMm * state.scale + start + 26;
      const width = state.vertical ? barWidth : total;
      const height = state.vertical ? total : barWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      canvas.setAttribute('aria-orientation', state.vertical ? 'vertical' : 'horizontal');
      canvas.setAttribute('aria-valuemax', String(Math.round(maxMm)));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#FFFEFB';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#F6F3EB';
      ctx.fillRect(0, 0, width, height);
      if (mobileVertical) {
        const railWidth = 112;
        ctx.fillStyle = '#F1EBDC';
        ctx.fillRect(0, 0, railWidth, height);
        ctx.fillStyle = '#FFFCF6';
        ctx.fillRect(railWidth, 0, width - railWidth, height);
        ctx.strokeStyle = '#D9D1C2';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(railWidth + .5, 0);
        ctx.lineTo(railWidth + .5, height);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(152,126,92,.22)';
        for (const mark of ticks) {
          if (!mark.major) continue;
          const guideY = 20 + mark.mm * state.scale + .5;
          ctx.beginPath();
          ctx.moveTo(railWidth + 1, guideY);
          ctx.lineTo(width, guideY);
          ctx.stroke();
        }
      }
      const axisLine = 17;
      ctx.strokeStyle = '#343137';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (state.vertical) {
        ctx.moveTo(axisLine, start);
        ctx.lineTo(axisLine, start + maxMm * state.scale);
      } else {
        ctx.moveTo(start, axisLine);
        ctx.lineTo(start + maxMm * state.scale, axisLine);
      }
      ctx.stroke();
      ctx.fillStyle = '#27232A';
      ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      for (const tick of ticks) {
        const px = start + tick.mm * state.scale;
        const size = tick.major ? 41 : tick.mid ? 27 : 15;
        ctx.lineWidth = tick.major ? 1.5 : 1;
        ctx.beginPath();
        if (state.vertical) {
          ctx.moveTo(axisLine, px);
          ctx.lineTo(axisLine + size, px);
        } else {
          ctx.moveTo(px, axisLine);
          ctx.lineTo(px, axisLine + size);
        }
        ctx.stroke();
        if (tick.label !== null) {
          if (state.vertical) {
            ctx.textAlign = 'left';
            ctx.fillText(tick.label, 67, px + 1);
          } else {
            ctx.textAlign = 'center';
            ctx.fillText(tick.label, px, 82);
          }
        }
      }
      if (state.selectedMm !== null) {
        const px = start + Math.min(maxMm, state.selectedMm) * state.scale;
        ctx.strokeStyle = '#D94C86';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (state.vertical) {
          ctx.moveTo(0, px);
          ctx.lineTo(width, px);
        } else {
          ctx.moveTo(px, 0);
          ctx.lineTo(px, height);
        }
        ctx.stroke();
        ctx.fillStyle = '#D94C86';
        ctx.beginPath();
        if (state.vertical) ctx.arc(width - 14, px, 6, 0, Math.PI * 2);
        else ctx.arc(px, height - 14, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      surface.classList.toggle('ruler-is-vertical', state.vertical);
      scrollPanel.classList.toggle('ruler-is-vertical', state.vertical);
      $('ruler-axis-label').textContent = state.unit === 'inch' ? '12 in / 304.8 mm' : '30 cm / 300 mm';
      $('ruler-mobile-hint').textContent = state.vertical
        ? '↕ Swipe to scroll · Tap to measure from zero'
        : '↔ Swipe to scroll · Tap to measure from zero';
      measureLabels();
    }
    function setScale(value) {
      state.scale = clampScale(value);
      state.mode = 'editing';
      state.calibrated = false;
      updateCalibrationUI('Adjust the guide to the physical card edge, then save calibration.');
      render();
    }
    function applyDiagonal(inches) {
      const value = Number(inches);
      const scale = scaleFromDiagonal(screenInfo(), value);
      if (scale === null) {
        sizeStatus.textContent = 'Please enter a valid screen diagonal (4–80 inches). Check that browser zoom is normal.';
        return false;
      }
      state.scale = scale;
      state.mode = 'size';
      state.diagonalInches = value;
      state.calibrated = false;
      state.signature = zoomSignature();
      state.screenId = screenFingerprint();
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(OLD_STORAGE_KEY);
        localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify({
          inches: value, screenId: state.screenId
        }));
        sizeStatus.textContent = value + '″ saved on this browser. Confirm against a real card for precise measurements.';
      } catch (_) {
        sizeStatus.textContent = value + '″ applied for this session. Browser storage is unavailable.';
      }
      updateCalibrationUI('Scale recalculated using your chosen screen diagonal.');
      render();
      return true;
    }
    sizeSelect.addEventListener('change', () => {
      const choice = sizeSelect.value;
      if (choice === 'auto') {
        useAutomaticEstimate('Reset to automatic screen estimate.');
      } else if (choice === 'custom') {
        customSizeField.hidden = false;
        customInches.focus();
      } else {
        applyDiagonal(choice);
      }
    });
    $('ruler-custom-apply').addEventListener('click', () => applyDiagonal(customInches.value));
    customInches.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyDiagonal(customInches.value);
      }
    });
    function useAutomaticEstimate(message) {
      state.estimate = estimateScreenScale(screenInfo());
      state.scale = state.estimate.scale;
      state.calibrated = false;
      state.mode = 'auto';
      state.diagonalInches = null;
      state.signature = zoomSignature();
      state.screenId = screenFingerprint();
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(OLD_STORAGE_KEY);
        localStorage.removeItem(SIZE_STORAGE_KEY);
      } catch (_) { /* local storage may be blocked */ }
      sizeStatus.textContent = 'Using a rough device-family estimate. Choose a diagonal for a better starting point.';
      updateCalibrationUI(message || 'Automatic screen estimate applied. Card calibration is optional for better accuracy.');
      render();
    }
    calibrationInput.addEventListener('input', () => setScale(calibrationInput.value));
    $('calibration-minus').addEventListener('click', () => setScale(state.scale - 0.01));
    $('calibration-plus').addEventListener('click', () => setScale(state.scale + 0.01));
    $('ruler-use-auto').addEventListener('click', () => useAutomaticEstimate());
    $('calibration-save').addEventListener('click', () => {
      state.calibrated = true;
      state.mode = 'card';
      state.diagonalInches = null;
      state.signature = zoomSignature();
      state.screenId = screenFingerprint();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          scale: state.scale, signature: state.signature, screenId: state.screenId, calibrated: true
        }));
        localStorage.removeItem(OLD_STORAGE_KEY);
        localStorage.removeItem(SIZE_STORAGE_KEY);
        updateCalibrationUI('Saved on this browser. Check against a real ruler for precision work.');
      } catch (_) {
        updateCalibrationUI('Calibrated for this visit, but browser storage is unavailable.');
      }
    });
    $('calibration-reset').addEventListener('click', () => {
      useAutomaticEstimate('Reset to automatic screen estimate. Match a card for better accuracy.');
    });
    refButtons.forEach((button) => button.addEventListener('click', () => {
      state.referenceMm = Number(button.dataset.rulerReference);
      updateRefButtons();
      updateCalibrationUI('Match the horizontal guide to the selected edge of your physical card.');
    }));
    unitButtons.forEach((button) => button.addEventListener('click', () => {
      state.unit = button.dataset.rulerUnit;
      unitButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      render();
    }));
    orientationButtons.forEach((button) => button.addEventListener('click', () => {
      state.vertical = button.dataset.rulerDirection === 'vertical';
      orientationButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      scrollPanel.scrollTo(0, 0);
      render();
    }));

    let downPoint = null;
    canvas.addEventListener('pointerdown', (event) => {
      downPoint = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!downPoint) return;
      const moved = Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y);
      downPoint = null;
      if (moved > 8) return; // Scrolling a long ruler is not a measurement.
      const box = canvas.getBoundingClientRect();
      const relative = state.vertical ? event.clientY - box.top : event.clientX - box.left;
      const max = buildTicks(state.unit).maxMm;
      state.selectedMm = Math.max(0, Math.min(max, (relative - 20) / state.scale));
      render();
    });
    canvas.addEventListener('pointercancel', () => { downPoint = null; });
    canvas.addEventListener('keydown', (event) => {
      const allowed = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!allowed.includes(event.key)) return;
      event.preventDefault();
      const maximum = buildTicks(state.unit).maxMm;
      const step = state.unit === 'inch' ? 25.4 / 16 : 1;
      if (event.key === 'Home') state.selectedMm = 0;
      else if (event.key === 'End') state.selectedMm = maximum;
      else {
        const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        state.selectedMm = Math.max(0, Math.min(maximum, (state.selectedMm || 0) + direction * step));
      }
      render();
    });

    const fullButton = $('ruler-fullscreen');
    if (!surface.requestFullscreen) fullButton.hidden = true;
    fullButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await surface.requestFullscreen();
      } catch (_) {
        scaleStatus.textContent = 'Fullscreen is not available in this browser.';
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fullButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
      render();
    });
    let previousCanvasWidth = scrollPanel.clientWidth;
    window.addEventListener('resize', () => {
      const narrow = shouldStartVertical(window.innerWidth);
      const changedBreakpoint = compactLayout !== narrow;
      if (changedBreakpoint) {
        compactLayout = narrow;
        detectionDetails.open = !narrow;
      }
      const now = screenFingerprint();
      if (now !== state.screenId) {
        // Zoom or another display changes CSS pixel geometry. Do not keep
        // using a calibration tied to the previous screen/zoom setting.
        const wasCardCalibrated = state.calibrated;
        useAutomaticEstimate(wasCardCalibrated
          ? 'Your display or page zoom changed. Updated the automatic estimate; card-calibrate again for accuracy.'
          : 'Display settings changed. Automatic screen-size estimate updated.');
      } else if (changedBreakpoint || scrollPanel.clientWidth !== previousCanvasWidth) {
        updateCalibrationUI();
        render();
      }
      previousCanvasWidth = scrollPanel.clientWidth;
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const vScale = window.visualViewport.scale;
        $('ruler-pinch-note').hidden = Math.abs(vScale - 1) < 0.02;
      });
    }
    orientationButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String((button.dataset.rulerDirection === 'vertical') === state.vertical));
    });
    updateRefButtons();
    sizeStatus.textContent = state.mode === 'size'
      ? state.diagonalInches + '″ restored from this browser.'
      : state.mode === 'card' ? 'Your saved bank-card calibration is active.'
        : 'Choose a diagonal to calculate a better starting scale.';
    updateCalibrationUI(state.calibrated ? 'Your previous card calibration was restored.' : 'Automatically estimated from your screen. Check against a card if needed.');
    render();
  }
  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clampScale, estimateScreenScale, screenSizePresets, scaleFromDiagonal, shouldStartVertical, toUnits, lengthLabel, buildTicks };
  }
})();
