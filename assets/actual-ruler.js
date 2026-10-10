'use strict';
/* Screen ruler — measurements only become physically meaningful after user calibration. */
(function () {
  const STANDARD_PX_PER_MM = 96 / 25.4;
  const CARD_SHORT_MM = 53.98;
  const CARD_LONG_MM = 85.60;
  const STORAGE_KEY = 'everytinytool-ruler-calibration-v1';
  const MIN_SCALE = 2;
  const MAX_SCALE = 12;

  function clampScale(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, n)) : STANDARD_PX_PER_MM;
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
    const state = {
      scale: STANDARD_PX_PER_MM,
      calibrated: false,
      signature: zoomSignature(),
      referenceMm: matchMedia('(max-width: 650px)').matches ? CARD_SHORT_MM : CARD_LONG_MM,
      unit: 'cm',
      vertical: false,
      selectedMm: null
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Number.isFinite(saved.scale) && saved.scale >= MIN_SCALE && saved.scale <= MAX_SCALE) {
        state.scale = saved.scale;
        state.signature = saved.signature;
        state.calibrated = Boolean(saved.calibrated && Math.abs(saved.signature - zoomSignature()) < 0.02);
      }
    } catch (_) { /* Private mode may prevent storage. The ruler still works. */ }

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

    function updateCalibrationUI(message) {
      const ref = state.referenceMm;
      calibrationInput.value = String(state.scale);
      guide.style.width = (state.scale * ref) + 'px';
      $('ruler-reference-size').textContent = ref.toFixed(2) + ' mm';
      $('ruler-reference-description').textContent = ref === CARD_SHORT_MM ? 'Short edge of a standard bank card' : 'Long edge of a standard bank card';
      badge.textContent = state.calibrated ? 'Calibrated on this browser' : 'Not calibrated · approximate';
      badge.dataset.ready = state.calibrated ? 'true' : 'false';
      status.textContent = state.calibrated
        ? 'Calibration saved. Recheck after screen zoom, display, or device changes.'
        : 'Approximate scale only. Match a real card edge and save calibration before measuring.';
      if (message) scaleStatus.textContent = message;
      const signatureChanged = Math.abs(zoomSignature() - state.signature) >= 0.02;
      zoomAlert.hidden = !signatureChanged;
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
        readout.textContent = 'Choose a point on the ruler';
        readoutOther.textContent = 'Tap or click the ruler to measure from zero.';
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
      const barWidth = 118;
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
      measureLabels();
    }
    function setScale(value) {
      state.scale = clampScale(value);
      state.calibrated = false;
      state.signature = zoomSignature();
      updateCalibrationUI('Adjust the guide until it matches the physical card edge, then select Save calibration.');
      render();
    }
    calibrationInput.addEventListener('input', () => setScale(calibrationInput.value));
    $('calibration-minus').addEventListener('click', () => setScale(state.scale - 0.01));
    $('calibration-plus').addEventListener('click', () => setScale(state.scale + 0.01));
    $('calibration-save').addEventListener('click', () => {
      state.calibrated = true;
      state.signature = zoomSignature();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ scale: state.scale, signature: state.signature, calibrated: true }));
        updateCalibrationUI('Saved on this browser. Check against a real object before precision use.');
      } catch (_) {
        updateCalibrationUI('Calibrated for this visit, but browser storage is unavailable.');
      }
    });
    $('calibration-reset').addEventListener('click', () => {
      state.scale = STANDARD_PX_PER_MM;
      state.calibrated = false;
      state.signature = zoomSignature();
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      updateCalibrationUI('Reset to an approximate screen scale. Calibrate again for physical measurements.');
      render();
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
    });
    window.addEventListener('resize', () => {
      if (Math.abs(zoomSignature() - state.signature) >= 0.02) {
        state.calibrated = false;
        updateCalibrationUI('Screen zoom or pixel density changed. Recalibrate before measuring.');
      }
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const vScale = window.visualViewport.scale;
        $('ruler-pinch-note').hidden = Math.abs(vScale - 1) < 0.02;
      });
    }
    updateRefButtons();
    updateCalibrationUI('Match a card edge to calibrate, then save.');
    render();
  }
  if (typeof document !== 'undefined') init();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clampScale, toUnits, lengthLabel, buildTicks };
  }
})();
