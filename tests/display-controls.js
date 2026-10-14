(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const fields = ["scanlineStrength", "scanlineSpacing", "scanlineThickness"];
  const defaults = { scanlineStrength: "8", scanlineSpacing: "4", scanlineThickness: "25" };
  const custom = { scanlineStrength: "40", scanlineSpacing: "8", scanlineThickness: "50" };
  const stopBackgroundWork = () => {
    cancelAnimationFrame(state.raf);
    stopPreviewLoop();
    clearTimeout(state.previewTimer);
  };
  const assertFields = (expected, message) => assert(fields.every(id => controls[id].value === expected[id]), message);
  const decodePng = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  const rowValue = (canvas, row) => Array.from(canvas.getContext("2d").getImageData(20, row, 1, 1).data);
  const assertScanStyle = (target, message) => {
    const style = getComputedStyle(target);
    const after = getComputedStyle(target, "::after");
    assert(target.classList.contains("scanlines"), `${message}: overlay enabled`);
    assert(style.getPropertyValue("--scanline-color").replace(/\s/g, "") === "rgba(255,255,255,0.4)", `${message}: strength reaches the overlay`);
    assert(style.getPropertyValue("--scanline-spacing").trim() === "8px" && style.getPropertyValue("--scanline-thickness").trim() === "4px", `${message}: spacing and proportional thickness reach the overlay`);
    assert(after.mixBlendMode === "overlay" && after.backgroundImage.includes("4px") && after.backgroundImage.includes("8px"), `${message}: CSS renders the requested stripe geometry and blend`);
  };

  try {
    stopBackgroundWork();
    if (sessionStorage.getItem("displayControlsReload")) {
      assertFields(custom, "saved scanline settings survive browser reload");
      assert(controls.scanlines.checked, "scanline enable state survives reload");
      renderPreview(); stopBackgroundWork();
      assertScanStyle(controls.previewPanel, "restored preview");
      document.body.innerHTML = "<p>PASS: scanline defaults, bounds, disabled controls, all-mode CSS, scene/share persistence, and PNG stripe geometry/blending</p>";
      return;
    }
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    controls.fullscreenOnStart.checked = false;
    controls.livePreview.checked = false;
    controls.transitionMode.value = "cut";
    controls.quality.value = "low";
    intervalMode.checked = false;
    assertFields(defaults, "initial settings preserve the previous 8%, 4px, 1px scanline appearance");
    const defaultGeometry = getScanlineSettings({});
    assert(defaultGeometry.opacity === 0.08 && defaultGeometry.spacing === 4 && defaultGeometry.thickness === 1, "missing scanline fields use legacy defaults");
    const normalized = normalizePreset({ scanlineStrength: 400, scanlineSpacing: -1, scanlineThickness: 100 });
    assert(normalized.scanlineStrength === "40" && normalized.scanlineSpacing === "2" && normalized.scanlineThickness === "75", "imported settings clamp to the control ranges");
    const invalid = normalizePreset({ scanlineStrength: "bad", scanlineSpacing: Infinity, scanlineThickness: NaN });
    assert(fields.every(id => !(id in invalid)), "non-finite scanline imports are rejected");
    const clamped = getScanlineSettings({ scanlineStrength: 100, scanlineSpacing: 100, scanlineThickness: 100 });
    assert(clamped.opacity === 0.4 && clamped.spacing === 12 && clamped.thickness === 9, "render settings enforce bounded opacity and preserve a gap");

    applyPreset({ ...getPreset(), ...custom, scanlines: true });
    controls.scanlines.checked = false;
    controls.scanlines.dispatchEvent(new Event("change", { bubbles: true }));
    stopBackgroundWork();
    assert(fields.every(id => el(id).matches(":disabled")), "scanline sliders disable when scanlines are off");
    assertFields(custom, "disabling scanlines preserves their slider values");
    controls.scanlines.checked = true;
    controls.scanlines.dispatchEvent(new Event("change", { bubbles: true }));
    stopBackgroundWork();
    assert(fields.every(id => !el(id).matches(":disabled")), "scanline sliders enable with the overlay");

    for (const mode of ["ascii", "atari", "vm2", "nethack"]) {
      applyPreset({ ...getPreset(), ...custom, visualizerMode: mode, scanlines: true, invert: false, backgroundMode: "ray", atariInput: "demo", vm2Input: "demo", nhInput: "demo" });
      assert(!el("scanlineControls").hidden && !el("scanlineControls").closest("[hidden]"), `${mode}: display controls remain available`);
      state.previewPrepared = null;
      renderPreview(); stopBackgroundWork();
      assertScanStyle(controls.previewPanel, `${mode} preview`);
      start(); stopBackgroundWork();
      assertScanStyle(controls.stage, `${mode} playback`);
      stop(); stopBackgroundWork();
    }

    applyPreset({ visualizerMode: "ascii", scanlines: true, seed: "legacy-display" });
    assertFields(defaults, "older scene recall resets customized scanlines to legacy defaults");
    applyPreset({ ...getPreset(), ...custom });
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene", version: 2, preset: { lyrics: "OLDER SCENE", seed: "legacy-import", scanlines: true } });
    loadPreset(); stopBackgroundWork();
    assertFields(defaults, "older single-scene import does not inherit current scanline customization");
    applyPreset({ ...getPreset(), ...custom, scanlines: true });
    const decoded = decodePresetFromUrl(encodePresetForUrl(getPreset()));
    assert(fields.every(id => decoded[id] === custom[id]), "share URL retains all scanline settings");
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene", version: 2, preset: decoded });
    loadPreset(); stopBackgroundWork();
    assertFields(custom, "JSON scene import restores scanline settings");

    // A flat mid-gray fixture makes the exported stripe geometry and overlay blend measurable.
    // Replace only the empty frame's initial black background, leaving the export compositor intact.
    controls.recordingMode.checked = true;
    controls.captureSize.value = "720x720";
    prepareStateFromControls();
    state.options.invert = false;
    const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
    const renderFlat = async options => {
      state.options = { ...state.options, ...options };
      let first = true;
      let url;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (!first) return originalFillRect.apply(this, args);
        first = false;
        const before = this.fillStyle;
        this.fillStyle = "#606060";
        originalFillRect.apply(this, args);
        this.fillStyle = before;
      };
      try { url = renderTextFrameToImage({ grid: [] }); }
      finally { CanvasRenderingContext2D.prototype.fillRect = originalFillRect; }
      return decodePng(url);
    };
    const zero = await renderFlat({ ...custom, scanlines: true, scanlineStrength: "0" });
    const disabled = await renderFlat({ ...custom, scanlines: false });
    const strong = await renderFlat({ ...custom, scanlines: true });
    const classic = await renderFlat({ ...defaults, scanlines: true });
    assert(strong.width === 720 && strong.height === 720, "scanline export retains exact capture dimensions");
    for (let y = 0; y < 24; y++) {
      const zeroPixel = rowValue(zero, y), disabledPixel = rowValue(disabled, y);
      assert(zeroPixel.every((value, index) => value === disabledPixel[index]) && zeroPixel[0] === 96 && zeroPixel[3] === 255, "zero strength and disabled scanlines both preserve the opaque base picture");
      const pixel = rowValue(strong, y);
      const expected = y % 8 < 4 ? 134 : 96;
      assert(pixel.slice(0, 3).every(value => Math.abs(value - expected) <= 1) && pixel[3] === 255, "PNG uses four bright rows and four clear rows, with the same overlay blend as CSS");
      const defaultPixel = rowValue(classic, y);
      const defaultExpected = y % 4 === 0 ? 104 : 96;
      assert(defaultPixel.slice(0, 3).every(value => Math.abs(value - defaultExpected) <= 1), "legacy PNG defaults keep one subtle line every four pixels");
    }
    applyPreset({ ...getPreset(), ...custom, visualizerMode: "ascii", scanlines: true, invert: false, livePreview: false, recordingMode: false });
    selectSceneSlot(2); storeScene(2);
    applyPreset({ ...getPreset(), ...defaults });
    recallScene(2); stopBackgroundWork();
    assertFields(custom, "saved scene recall restores customized scanlines");
    saveSetup();
    sessionStorage.setItem("displayControlsReload", "1");
    location.reload();
  } catch (error) {
    stopBackgroundWork();
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
