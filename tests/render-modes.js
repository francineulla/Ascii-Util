(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const canvasFor = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    return canvas;
  };
  const pixelsOf = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  const equalPixels = (first, second) => first.length === second.length && first.every((value, index) => value === second[index]);
  const litPixels = pixels => {
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) count++;
    return count;
  };
  const boundsOf = canvas => {
    const pixels = pixelsOf(canvas);
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] <= 12) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    return { left, top, width: right - left + 1, height: bottom - top + 1 };
  };
  const pngCanvas = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  const offered = element => {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.ownerDocument.defaultView.getComputedStyle(node).display === "none") return false;
    }
    return Boolean(element);
  };

  try {
    clearTimeout(state.previewTimer); stopPreviewLoop();
    if (sessionStorage.getItem("renderModesReload")) {
      assert(controls.visualizerMode.value === "atari" && el("toolMode").value === "video", "saved renderer restores the derived video tool selection");
      assert(controls.atariStretch.checked && getPreset().atariStretch === true, "stretch remains a boolean through scene storage and reload");
      assert(!audioState.stream, "restoring the video tool never opens audio automatically");
      document.body.innerHTML = "<p>PASS: text/video tool separation, settings and preset recall, native isolation, Atari stretch/PNG persistence, and stereo Ring colors</p>";
      return;
    }
    const constant = { level: 1, crossings: 220, samples: new Float32Array(1024).fill(1) };
    const signal = { left: constant, right: constant };
    const fullOptions = { atariShape: "solid", atariHorizontal: 1, atariVertical: 1, atariGainLeft: 200, atariGainRight: 200, atariContourLeft: 65, atariContourRight: 65, atariColor: 65 };
    const original = AtariVideoMusic.buildFrame(fullOptions, 900, signal, 42);
    const fitted = AtariVideoMusic.buildFrame({ ...fullOptions, atariStretch: false }, 900, signal, 42);
    const stretched = AtariVideoMusic.buildFrame({ ...fullOptions, atariStretch: true }, 900, signal, 42);
    assert(original.stretch === false && fitted.stretch === false && stretched.stretch === true, "Atari stretch is opt-in and stored in the immutable frame");
    assert(equalPixels(AtariVideoMusic.rasterize(original), AtariVideoMusic.rasterize(stretched)), "stretch leaves the hardware-style native raster unchanged");
    for (const [width, height] of [[400, 200], [200, 400]]) {
      const defaultCanvas = canvasFor(width, height), fittedCanvas = canvasFor(width, height), stretchedCanvas = canvasFor(width, height);
      AtariVideoMusic.draw(defaultCanvas.getContext("2d"), original, width, height);
      AtariVideoMusic.draw(fittedCanvas.getContext("2d"), fitted, width, height);
      AtariVideoMusic.draw(stretchedCanvas.getContext("2d"), stretched, width, height);
      assert(equalPixels(pixelsOf(defaultCanvas), pixelsOf(fittedCanvas)), "omitting stretch preserves the existing fitted picture exactly");
      const fit = boundsOf(fittedCanvas), stretch = boundsOf(stretchedCanvas);
      assert(stretch.left === 0 && stretch.top === 0 && stretch.width === width && stretch.height === height, "stretch fills the entire landscape or portrait canvas");
      assert(width > height ? fit.left > 30 && fit.width < width : fit.top > 30 && fit.height < height, "default display preserves 4:3 letterboxing in both orientations");
    }
    const ring = AtariVideoMusic.buildFrame({ ...fullOptions, atariShape: "ring", atariGainLeft: 100, atariGainRight: 100, atariColor: 50 }, 900, {
      left: { level: 0.64, crossings: 250, samples: [] },
      right: { level: 0.25, crossings: 1200, samples: [] }
    }, 42);
    const ringPixels = AtariVideoMusic.rasterize(ring);
    const leftColor = ring.palette[ring.left.colors[0]], rightColor = ring.palette[ring.right.colors[0]];
    const containsColor = color => {
      for (let i = 0; i < ringPixels.length; i += 4) if (color.every((value, channel) => ringPixels[i + channel] === value)) return true;
      return false;
    };
    assert(leftColor.some((value, index) => value !== rightColor[index]) && containsColor(leftColor) && containsColor(rightColor), "Ring pulses carry the color of the stereo comparator that changes at each edge");

    const changeSelect = (id, value) => {
      el(id).value = value;
      el(id).dispatchEvent(new Event("change", { bubbles: true }));
      clearTimeout(state.previewTimer);
    };
    const textFields = ["lyrics", "maskArt", "wordMotion", "glyphSize", "quality", "palette", "colorMode", "charsetPreset", "wordHalo"];
    const commonFields = ["bpm", "seed", "start", "audioSource", "fpsCap", "captureSize", "recordingMode", "scanlines", "invert", "saveFrame"];
    const nativePresetNames = ["atariVideoMusic", "videoMusic2", "vm2Phosphor", "vm2Portrait", "nethackVideo", "pixelmusic3000"];
    const visiblePresets = () => Array.from(controls.defaultScenePreset.options).filter(option => !option.hidden && !option.disabled).map(option => option.value);
    const assertFamily = family => {
      const text = family === "text";
      assert(el("toolMode").value === family, "tool selector follows the active renderer");
      for (const id of textFields) assert(offered(el(id)) === text, `${id} is available only in the text tool`);
      for (const id of commonFields) assert(offered(el(id)), `${id} remains available to both tools`);
      assert(offered(controls.visualizerMode) === !text, "native renderer selector belongs to the video tool");
      for (const panel of document.querySelectorAll("[data-tools]")) {
        assert(panel.hidden === (panel.dataset.tools !== family) && panel.inert === panel.hidden, "inactive tool controls are both hidden and inert");
      }
      const choices = visiblePresets();
      assert(choices.length > 0 && choices.every(name => nativePresetNames.includes(name) !== text), "built-in presets are filtered to the selected tool family");
    };
    assert(el("toolMode")?.tagName === "SELECT", "one top-level selector switches between the two tools");
    assert(!("toolMode" in getPreset()) && !presetFields.includes("toolMode"), "tool family is derived rather than stored as a second renderer setting");
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false; controls.livePreview.checked = false;
    controls.fullscreenOnStart.checked = false; controls.transitionMode.value = "cut";
    controls.recordingMode.checked = false; controls.scanlines.checked = false; controls.invert.checked = false;
    changeSelect("toolMode", "text"); assertFamily("text");
    controls.lyrics.value = "KEEP THESE WORDS"; controls.maskArt.value = "XX\n X";
    controls.glyphSize.value = "18"; controls.quality.value = "high"; controls.palette.value = "ocean";
    controls.atariGainLeft.value = "143"; controls.atariContourRight.value = "33"; controls.atariStretch.checked = true;
    controls.vm2Palette.value = "ice"; controls.vm2Aspect.value = "custom"; controls.vm2AspectWidth.value = "2.35"; controls.vm2AspectHeight.value = "1";
    const preserved = Object.fromEntries(Object.entries(getPreset()).filter(([id]) => id !== "visualizerMode"));
    changeSelect("toolMode", "video"); assertFamily("video");
    changeSelect("visualizerMode", "vm2");
    changeSelect("toolMode", "text"); changeSelect("toolMode", "video");
    assert(controls.visualizerMode.value === "vm2", "returning to video restores the last Video Music 2 selection");
    changeSelect("visualizerMode", "atari");
    changeSelect("toolMode", "text"); changeSelect("toolMode", "video");
    assert(controls.visualizerMode.value === "atari", "returning to video also remembers the original Atari selection");
    assert(Object.entries(preserved).every(([id, value]) => getPreset()[id] === value), "tool switching preserves every text and video setting");
    assert(normalizePreset({ atariStretch: "false" }).atariStretch === false && normalizePreset({ atariStretch: "true" }).atariStretch === true, "stretch normalizes as a checkbox rather than a string-valued option");
    applyPreset({ ...getPreset(), visualizerMode: "ascii" }); assertFamily("text");
    applyPreset({ ...getPreset(), visualizerMode: "atari" }); assertFamily("video");
    applyPreset({ visualizerMode: "atari", seed: "legacy-atari" });
    assert(!controls.atariStretch.checked, "older Atari presets retain their original fitted display");

    controls.lockSeed.checked = true;
    for (const [name, randomize] of [["visual", randomizeVisual], ["motion", randomizeMotion], ["colour", randomizeColour], ["timing", randomizeTiming], ["all", randomizeAll]]) {
      const before = getPreset();
      randomize(); clearTimeout(state.previewTimer);
      assert(Object.entries(before).every(([id, value]) => id.startsWith("atari") && id !== "atariInput" && id !== "atariStretch" || name === "timing" && id === "bpm" || getPreset()[id] === value), `Atari ${name} randomizer leaves ASCII, Video Music 2, source, and stretch controls unchanged`);
    }
    const hiddenTextSettings = Object.fromEntries(Object.entries(getPreset()).filter(([id]) => controls[id]?.closest('[data-tools="text"]')));
    for (const name of nativePresetNames) {
      applyNamedPreset(name); clearTimeout(state.previewTimer);
      assert(Object.entries(hiddenTextSettings).every(([id, value]) => getPreset()[id] === value), `built-in ${name} preserves inactive text settings`);
    }

    const nativePixels = frame => frame.atari ? AtariVideoMusic.rasterize(frame.atari) : VideoMusic2.rasterize(frame.vm2, 320, 200);
    for (const mode of ["atari", "vm2"]) {
      applyPreset({ ...getPreset(), visualizerMode: mode, atariInput: "demo", vm2Input: "demo", atariShape: "solid", vm2Shape: "solid", vm2Trails: "0", seed: "independent-native-seed", fpsCap: "auto", quality: "high" });
      controls.lyrics.value = "FIRST WORDS"; controls.maskArt.value = "X";
      prepareStateFromControls();
      const firstSeed = state.seedValue;
      const firstPicture = nativePixels(buildFrame(state.startedAt + 900, 640, 480, true));
      const firstInterval = getFrameInterval();
      controls.lyrics.value = "COMPLETELY DIFFERENT HIDDEN WORDS"; controls.maskArt.value = "###\n# #\n###";
      controls.quality.value = "low"; controls.glyphSize.value = "24"; controls.density.value = "8";
      prepareStateFromControls();
      assert(state.seedValue === firstSeed && equalPixels(firstPicture, nativePixels(buildFrame(state.startedAt + 900, 640, 480, true))), `${mode} ignores hidden lyrics, masks, and ASCII detail settings`);
      assert(getFrameInterval() === firstInterval, "automatic native FPS is independent of hidden ASCII quality");
      start(); cancelAnimationFrame(state.raf);
      const beforeKeys = { backgroundOnly: controls.backgroundOnly.checked, wordHalo: controls.wordHalo.checked, wordMotion: controls.wordMotion.value, visualizerMode: controls.visualizerMode.value };
      for (const key of ["b", "h", "m", "0"]) controls.stage.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      assert(controls.backgroundOnly.checked === beforeKeys.backgroundOnly && controls.wordHalo.checked === beforeKeys.wordHalo && controls.wordMotion.value === beforeKeys.wordMotion && controls.visualizerMode.value === beforeKeys.visualizerMode, `${mode} playback ignores inactive text and panic shortcuts`);
      stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
    }

    const textScene = { ...getPreset(), visualizerMode: "ascii", seed: "text-scene", colorMode: "classic", recordingMode: false };
    const atariScene = { ...getPreset(), visualizerMode: "atari", seed: "atari-scene", atariShape: "solid", atariInput: "demo", atariStretch: true };
    const extendedScene = { ...getPreset(), visualizerMode: "vm2", seed: "vm2-scene" };
    const shared = decodePresetFromUrl(encodePresetForUrl(atariScene));
    assert(shared.visualizerMode === "atari" && shared.atariStretch === true && !("toolMode" in shared), "share format carries the renderer and stretch without duplicating tool family");
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene", preset: textScene });
    loadPreset(); assertFamily("text");
    const originalUrl = location.href;
    history.replaceState(null, "", `#preset=${encodePresetForUrl(atariScene)}`);
    loadPresetFromUrl(); assertFamily("video");
    assert(controls.visualizerMode.value === "atari" && controls.atariStretch.checked, "URL preset restore synchronizes the tool and stretch controls");
    history.replaceState(null, "", originalUrl);
    state.scenes = [textScene, atariScene, extendedScene];
    start(); cancelAnimationFrame(state.raf); togglePause();
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(state.paused && el("toolMode").value === "text" && !state.currentFrame.atari && !state.currentFrame.vm2, "paused cross-family recall switches to the text renderer");
    recallScene(3); cancelAnimationFrame(state.raf);
    assert(state.paused && el("toolMode").value === "video" && state.currentFrame.vm2, "paused cross-family recall restores Video Music 2");
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.atari?.stretch && controls.atariStretch.checked, "paused Atari scene recall restores the stretch snapshot");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();

    const previousChannels = { left: audioState.left, right: audioState.right };
    const originalClick = HTMLAnchorElement.prototype.click;
    let download;
    HTMLAnchorElement.prototype.click = function () { download = this.href; };
    try {
      audioState.left = constant; audioState.right = constant;
      applyPreset({ ...getPreset(), ...fullOptions, visualizerMode: "atari", atariInput: "audio", atariStretch: true, scanlines: false, invert: false, recordingMode: true, captureSize: "1280x720" });
      state.previewPrepared = null; renderPreview();
      assert(state.previewPrepared.options.atariStretch === true && el("atariMonitor").height === Math.round(480 * window.innerHeight / window.innerWidth), "stretched preview adapts its monitor to the window aspect");
      const previewBounds = boundsOf(controls.previewCanvas);
      assert(previewBounds.width === controls.previewCanvas.width && previewBounds.height === controls.previewCanvas.height, "stretched menu preview fills its full canvas");
      for (const [size, width, height] of [["1280x720", 1280, 720], ["1080x1920", 1080, 1920]]) {
        controls.captureSize.value = size; controls.atariStretch.checked = true; saveFrame();
        const output = await pngCanvas(download);
        const extents = boundsOf(output);
        assert(output.width === width && output.height === height && extents.width === width && extents.height === height, "stretched PNG fills the exact requested landscape or portrait capture size");
      }
      controls.captureSize.value = "1280x720"; controls.atariStretch.checked = false;
      controls.atariStretch.dispatchEvent(new Event("change")); clearTimeout(state.previewTimer); saveFrame();
      const fittedOutput = await pngCanvas(download);
      assert(litPixels(fittedOutput.getContext("2d").getImageData(0, 0, 159, 720).data) === 0, "disabling stretch restores fitted PNG letterboxing");
      state.previewPrepared = null; renderPreview();
      assert(el("atariMonitor").height === 360, "disabling stretch restores the original 4:3 preview monitor");
    } finally {
      audioState.left = previousChannels.left; audioState.right = previousChannels.right;
      HTMLAnchorElement.prototype.click = originalClick;
    }
    applyPreset(atariScene); selectSceneSlot(2); storeScene(2); saveSceneSlots(); saveSetup();
    clearTimeout(state.previewTimer); stopPreviewLoop();
    sessionStorage.setItem("renderModesReload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
