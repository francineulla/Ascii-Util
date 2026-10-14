(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const litPixels = pixels => {
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) total++;
    return total;
  };
  const difference = (first, second) => {
    let total = 0;
    for (let i = 0; i < first.length; i += 4) {
      if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 12) total++;
    }
    return total;
  };
  const pixelsOf = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  const canvasFor = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    return canvas;
  };
  const channel = (level, cycles = 7) => ({
    level, crossings: cycles * 48000 / 1024,
    samples: Float32Array.from({ length: 1024 }, (_, i) => level * Math.sin(i * Math.PI * 2 * cycles / 1024))
  });
  const pngCanvas = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };

  try {
    clearTimeout(state.previewTimer); stopPreviewLoop();
    if (sessionStorage.getItem("vm2Reload")) {
      assert(controls.visualizerMode.value === "vm2", "Video Music 2 scene is restored after reload");
      assert(controls.vm2Aspect.value === "21:9" && controls.vm2Geometry.value === "starburst", "aspect and expanded geometry survive reload");
      assert(controls.vm2Trails.value === "63" && controls.vm2Palette.value === "ice", "trails and palette survive reload");
      assert(!audioState.stream && !audioState.context, "scene reload never opens an audio device automatically");
      document.body.innerHTML = "<p>PASS: Video Music 2 geometry, symmetry, color, aspect, immutable bounded trails, canvas playback, PNG, presets, legacy scenes, locks, and reload</p>";
      return;
    }

    assert(typeof VideoMusic2 === "object", "Video Music 2 renderer is available at startup");
    const fields = Object.keys(VideoMusic2.defaults);
    for (const id of fields) {
      const control = controls[id];
      assert(control && control === el(id), `${id} is a connected interface control`);
      if (control.type === "number" || control.type === "range") {
        assert(normalizePreset({ [id]: -10000 })[id] === control.min && normalizePreset({ [id]: 10000 })[id] === control.max, `${id} clamps imported values to its range`);
      }
      if (control.tagName === "SELECT") assert(!(id in normalizePreset({ [id]: "invalid-choice" })), `${id} rejects unsupported imported options`);
    }
    assert(["viewport", "16:9", "21:9", "4:3", "1:1", "9:16", "custom"].every(value => Array.from(controls.vm2Aspect.options).some(option => option.value === value)), "aspect selector exposes wide, portrait, square, viewport, and custom formats");
    const addedGeometries = ["triangle", "pentagon", "octagon", "cross", "clover", "starburst"];
    const geometries = ["diamond", "circle", "square", "hexagon", "star", ...addedGeometries];
    assert(geometries.every(value => Array.from(controls.vm2Geometry.options).some(option => option.value === value)), "geometry selector exposes existing shapes and six distinct new contours");
    assert(geometries.every(value => normalizePreset({ vm2Geometry: value }).vm2Geometry === value), "scene import accepts every supported geometry");
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    controls.livePreview.checked = false;
    applyPreset({ ...getPreset(), ...VideoMusic2.defaults, visualizerMode: "vm2", colorMode: "classic", quality: "low", recordingMode: false, fullscreenOnStart: false, scanlines: false, invert: false, transitionMode: "cut" });
    controls.vm2Input.value = "audio"; controls.vm2Aspect.value = "custom";
    controls.vm2AspectWidth.value = "2.35"; controls.vm2AspectHeight.value = "1";
    controls.vm2Glow.value = "0"; controls.bpm.value = "144";
    const originalSettings = Object.fromEntries(Object.entries(getPreset()).filter(([id]) => !id.startsWith("vm2")));
    const beforeShuffle = JSON.stringify(Object.fromEntries(fields.map(id => [id, controls[id].value])));
    el("vm2Shuffle").click(); clearTimeout(state.previewTimer);
    assert(controls.vm2Input.value === "audio" && controls.vm2Aspect.value === "custom" && controls.vm2AspectWidth.value === "2.35" && controls.vm2AspectHeight.value === "1" && controls.bpm.value === "144", "Shuffle look preserves source, fractional custom aspect, and tempo");
    assert(JSON.stringify(Object.fromEntries(fields.map(id => [id, controls[id].value]))) !== beforeShuffle && Number(controls.vm2Glow.value) > 0, "Shuffle look changes visible Video Music 2 effects");
    assert(Object.entries(originalSettings).every(([id, value]) => getPreset()[id] === value), "Shuffle look leaves original ASCII and Atari settings untouched");
    el("vm2Reset").click(); clearTimeout(state.previewTimer);
    assert(fields.every(id => controls[id].value === VideoMusic2.defaults[id]), "Reset Video Music 2 restores all of its default controls");
    assert(Object.entries(originalSettings).every(([id, value]) => getPreset()[id] === value), "Video Music 2 reset leaves the original mode controls unchanged");
    prepareStateFromControls();
    const options = { ...state.options, vm2Glow: 0, vm2Trails: 0 };
    const signal = { left: channel(0.62), right: channel(0.25, 23), sampleRate: 48000 };
    const build = (extra = {}, elapsed = 900, previous = null, input = signal) => VideoMusic2.buildFrame({ ...options, ...extra }, elapsed, input, 42, previous);
    const raster = (extra = {}, elapsed = 900) => VideoMusic2.rasterize(build(extra, elapsed), 320, 200);
    const baseline = raster();
    assert(baseline.length === 320 * 200 * 4 && litPixels(baseline) > 0, "native raster honors requested output dimensions and contains a picture");
    assert(difference(baseline, raster()) === 0, "renderer is deterministic for the same settings and signal");
    const quiet = { left: channel(0), right: channel(0) };
    assert(litPixels(VideoMusic2.rasterize(build({}, 900, null, quiet), 320, 200)) === 0, "disconnected or silent input produces a black picture");
    for (const geometry of geometries.slice(1)) {
      const picture = raster({ vm2Geometry: geometry });
      assert(litPixels(picture) > 0 && difference(picture, baseline) > 100, `${geometry} visibly changes the geometry`);
    }
    const steadyStereo = { left: { level: 0.3, crossings: 430 }, right: { level: 0.13, crossings: 890 } };
    const contourPictures = geometries.map(geometry => VideoMusic2.rasterize(build({ vm2Geometry: geometry, vm2Columns: 1, vm2Rows: 1,
      vm2Aspect: "1:1", vm2Detail: "smooth" }, 900, null, steadyStereo), 200, 200));
    for (let first = 0; first < geometries.length; first++) for (let second = first + 1; second < geometries.length; second++) {
      assert(difference(contourPictures[first], contourPictures[second]) > 35, `${geometries[first]} and ${geometries[second]} have distinct silhouettes`);
    }
    for (const [geometryIndex, geometry] of addedGeometries.entries()) {
      const silhouettes = {};
      for (const shape of ["solid", "hole", "ring"]) {
        silhouettes[shape] = VideoMusic2.rasterize(build({ vm2Geometry: geometry, vm2Shape: shape, vm2Columns: 1, vm2Rows: 1,
          vm2Aspect: "1:1", vm2Detail: "smooth" }, 900, null, steadyStereo), 160, 160);
        for (const [aspectIndex, aspect] of ["viewport", "16:9", "21:9", "4:3", "1:1", "9:16", "custom"].entries()) {
          const expanded = build({ vm2Geometry: geometry, vm2Shape: shape, vm2Aspect: aspect, vm2AspectWidth: 2.35, vm2AspectHeight: 1,
            vm2Columns: 2 + geometryIndex % 3, vm2Rows: 2 + aspectIndex % 2, vm2Rotation: 27,
            vm2Symmetry: ["horizontal", "vertical", "quad"][aspectIndex % 3], vm2Detail: ["chunky", "fine", "smooth"][geometryIndex % 3] }, 900, null, steadyStereo);
          const picture = VideoMusic2.rasterize(expanded, aspect === "9:16" ? 96 : 160, aspect === "9:16" ? 160 : 96);
          assert(expanded.geometry === geometry && litPixels(picture) > 0, `${geometry} ${shape} renders with ${aspect}, tiling, rotated mirrors, and edge detail`);
        }
      }
      assert(litPixels(silhouettes.hole) < litPixels(silhouettes.solid), `${geometry} Hole removes the overlapping stereo interior`);
      assert(difference(silhouettes.solid, silhouettes.ring) > 100 && difference(silhouettes.hole, silhouettes.ring) > 100, `${geometry} Ring follows the contour as distinct outlines`);
      const equalStereo = { left: { level: 0.3, crossings: 430 }, right: { level: 0.3, crossings: 890 } };
      for (const shape of ["hole", "ring"]) {
        const equal = build({ vm2Geometry: geometry, vm2Shape: shape, vm2GainLeft: 100, vm2GainRight: 100 }, 900, null, equalStereo);
        assert(litPixels(VideoMusic2.rasterize(equal, 160, 96)) === 0, `${geometry} ${shape} preserves equal-channel cancellation`);
      }
      const mirrored = VideoMusic2.rasterize(build({ vm2Geometry: geometry, vm2Rotation: 29, vm2Symmetry: "quad" }, 900, null, steadyStereo), 160, 96);
      let mismatches = 0;
      for (let y = 0; y < 96; y++) for (let x = 0; x < 160; x++) {
        const index = (y * 160 + x) * 4;
        const horizontal = (y * 160 + 159 - x) * 4;
        const vertical = ((95 - y) * 160 + x) * 4;
        for (let channel = 0; channel < 3; channel++) if (mirrored[index + channel] !== mirrored[horizontal + channel]
          || mirrored[index + channel] !== mirrored[vertical + channel]) mismatches++;
      }
      assert(mismatches === 0, `${geometry} quad mirrors are symmetric after rotation`);
    }
    const asymmetric = raster({ vm2Rotation: 29, vm2Symmetry: "none" });
    for (const symmetry of ["horizontal", "vertical", "quad"]) {
      assert(difference(asymmetric, raster({ vm2Rotation: 29, vm2Symmetry: symmetry })) > 100, `${symmetry} symmetry affects the picture`);
    }
    assert(difference(baseline, raster({ vm2Palette: "ice" })) > 100, "palette selection changes visible color");
    assert(difference(baseline, raster({ vm2Hue: 145 })) > 100, "hue control changes visible color");
    const desaturated = raster({ vm2Saturation: 0 });
    assert(desaturated.every((value, index) => index % 4 !== 0 || Math.abs(value - desaturated[index + 1]) + Math.abs(value - desaturated[index + 2]) <= 2), "zero saturation yields a monochrome picture");
    const glowing = canvasFor(320, 200), flat = canvasFor(320, 200);
    VideoMusic2.draw(flat.getContext("2d"), build({ vm2Glow: 0 }), 320, 200);
    VideoMusic2.draw(glowing.getContext("2d"), build({ vm2Glow: 100 }), 320, 200);
    assert(difference(pixelsOf(flat), pixelsOf(glowing)) > 100, "glow control affects the displayed canvas");

    const square = canvasFor(400, 200);
    VideoMusic2.draw(square.getContext("2d"), build({ vm2Aspect: "1:1" }), 400, 200);
    const squareContext = square.getContext("2d");
    assert(litPixels(squareContext.getImageData(0, 0, 99, 200).data) === 0 && litPixels(squareContext.getImageData(301, 0, 99, 200).data) === 0, "square aspect is fitted inside a wide canvas with black side bars");
    assert(litPixels(squareContext.getImageData(100, 0, 200, 200).data) > 0, "aspect fitting preserves the active picture");
    assert(build({ vm2Aspect: "viewport" }).aspect == null && build({ vm2Aspect: "21:9" }).aspect === 21 / 9, "viewport and ultrawide aspects are independent choices");
    assert(build({ vm2Aspect: "custom", vm2AspectWidth: 7, vm2AspectHeight: 3 }).aspect === 7 / 3, "custom aspect uses the supplied width and height");
    assert(build({ vm2Aspect: "custom", vm2AspectWidth: 2.35, vm2AspectHeight: 1 }).aspect === 2.35, "fractional custom aspect ratios are preserved by the renderer");

    let trailFrame = null;
    for (let index = 0; index < 30; index++) {
      trailFrame = build({ vm2Trails: 100, vm2Spin: 20 }, index * 16, trailFrame);
      assert(trailFrame.history.length <= 8 && trailFrame.history.every(snapshot => !snapshot.history), "trails retain at most eight flat snapshots without recursive history");
    }
    assert(trailFrame.history.length > 0, "trails preserve earlier frames while playing");
    const trailPicture = VideoMusic2.rasterize(trailFrame, 320, 200);
    const trailCanvas = canvasFor(320, 200);
    const trailContext = trailCanvas.getContext("2d");
    VideoMusic2.draw(trailContext, trailFrame, 320, 200);
    const firstDraw = pixelsOf(trailCanvas);
    trailContext.fillStyle = "#fff"; trailContext.fillRect(0, 0, 320, 200);
    VideoMusic2.draw(trailContext, trailFrame, 320, 200);
    assert(difference(firstDraw, pixelsOf(trailCanvas)) === 0, "drawing a stored frame clears old canvas content and is idempotent");
    const repeated = build({ vm2Trails: 100, vm2Spin: 20 }, trailFrame.elapsedMs, trailFrame);
    assert(repeated.history.length === trailFrame.history.length, "repainting one timestamp does not accumulate additional trail history");
    assert(difference(trailPicture, VideoMusic2.rasterize(repeated, 320, 200)) === 0, "repainting a paused frame does not change its trails");
    assert(build({ vm2Trails: 100, vm2Spin: 20 }, 0, trailFrame).history.length === 0, "restarting elapsed time clears trail history");
    assert(build({ vm2Trails: 100, vm2Spin: 20, vm2Geometry: "star" }, 480, trailFrame).history.length === 0, "changing visual settings clears incompatible trails");
    assert(build({ vm2Trails: 100, vm2Spin: 20 }, 2000, trailFrame).history.length === 0, "expired trail history is discarded after a long gap");
    const mutable = { left: channel(0.62), right: channel(0.25, 23) };
    const frozenFrame = build({ vm2Trails: 100 }, 900, null, mutable);
    const frozenPixels = VideoMusic2.rasterize(frozenFrame, 320, 200);
    mutable.left.samples.fill(0); mutable.right.samples.fill(1); mutable.left.level = 0;
    assert(Object.isFrozen(frozenFrame) && Object.isFrozen(trailFrame.history), "frame and trail collection are immutable");
    assert(difference(frozenPixels, VideoMusic2.rasterize(frozenFrame, 320, 200)) === 0, "live sample mutations cannot alter a paused frame or PNG");

    const frame = buildFrame(state.startedAt + 900, 640, 360, true);
    assert(frame.vm2 && frame.grid.length === 0 && !frame.atari, "Video Music 2 has its own frame payload");
    renderFrame(frame);
    assert(!controls.canvas.hidden && controls.ascii.hidden && litPixels(pixelsOf(controls.canvas)) > 0, "Video Music 2 uses native canvas even in classic ASCII color mode");
    state.previewPrepared = null; renderPreview();
    assert(litPixels(pixelsOf(controls.previewCanvas)) > 0 && litPixels(pixelsOf(el("vm2Monitor"))) > 0, "menu and panel previews both render Video Music 2");
    assert(!el("vm2Panel").hidden, "selecting Video Music 2 exposes its controls");
    controls.vm2Trails.value = "63";
    controls.vm2Spin.value = "20";
    el("vm2Start").click(); cancelAnimationFrame(state.raf);
    assert(state.running, "Video Music 2 panel Go starts playback");
    for (let index = 1; index <= 12; index++) {
      loop(state.startedAt + index * 80); cancelAnimationFrame(state.raf);
      assert(state.running && state.currentFrame.vm2 && !controls.canvas.hidden, "successive Video Music 2 animation frames remain valid");
    }
    togglePause();
    const paused = state.currentFrame.vm2;
    const pausedPixels = VideoMusic2.rasterize(paused, 320, 200);
    renderFrame(state.currentFrame); renderFrame(state.currentFrame);
    assert(difference(pausedPixels, VideoMusic2.rasterize(state.currentFrame.vm2, 320, 200)) === 0, "paused redraws preserve the captured trail picture");
    const pausedFrame = state.currentFrame;
    const pausedHistory = paused.history;
    const originalViewport = Object.fromEntries(["innerWidth", "innerHeight", "devicePixelRatio"].map(name => [name, Object.getOwnPropertyDescriptor(window, name)]));
    const originalRaf = window.requestAnimationFrame;
    let resizedRafRequests = 0;
    try {
      for (const [name, value] of Object.entries({ innerWidth: 640, innerHeight: 360, devicePixelRatio: 2 })) Object.defineProperty(window, name, { configurable: true, value });
      window.requestAnimationFrame = callback => { resizedRafRequests++; return originalRaf.call(window, callback); };
      window.dispatchEvent(new Event("resize"));
      assert(controls.canvas.width === 1280 && controls.canvas.height === 720, "paused resize repaints the native canvas at the new viewport and pixel density");
      assert(state.paused && state.currentFrame === pausedFrame && state.currentFrame.vm2 === paused && paused.history === pausedHistory, "paused resize preserves frame identity and trail history");
      assert(resizedRafRequests === 0, "resizing a paused native picture does not resume animation");
    } finally {
      window.requestAnimationFrame = originalRaf;
      for (const [name, descriptor] of Object.entries(originalViewport)) {
        if (descriptor) Object.defineProperty(window, name, descriptor);
        else delete window[name];
      }
      window.dispatchEvent(new Event("resize"));
    }

    let download;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { download = this.href; };
    try {
      saveFrame();
      assert(download?.startsWith("data:image/png") && litPixels(pixelsOf(await pngCanvas(download))) > 0, "paused Video Music 2 frame exports as a PNG");
      assert(state.currentFrame.vm2 === paused, "export does not advance paused trail state");
      stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
      controls.vm2Aspect.value = "1:1";
      controls.recordingMode.checked = true;
      controls.captureSize.value = "1280x720";
      saveFrame();
      const capture = await pngCanvas(download);
      assert(capture.width === 1280 && capture.height === 720, "fixed capture size controls PNG dimensions independently of picture aspect");
      assert(litPixels(capture.getContext("2d").getImageData(0, 0, 279, 720).data) === 0 && litPixels(capture.getContext("2d").getImageData(1001, 0, 279, 720).data) === 0, "square picture remains letterboxed in widescreen PNG output");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    controls.recordingMode.checked = false; controls.captureSize.value = "window";
    controls.vm2Aspect.value = "21:9"; controls.vm2Geometry.value = "starburst"; controls.vm2Palette.value = "ice";
    selectSceneSlot(1); storeScene();
    const saved = state.scenes[0];
    const shared = decodePresetFromUrl(encodePresetForUrl(saved));
    assert(shared.visualizerMode === "vm2" && fields.every(id => shared[id] === saved[id]), "all Video Music 2 controls survive share URL encoding");
    const legacy = { ...saved, seed: "legacy-ascii", glyphSize: "24" };
    delete legacy.visualizerMode;
    for (const id of fields) delete legacy[id];
    state.scenes[1] = legacy;
    state.scenes[2] = { ...saved, visualizerMode: "atari", atariInput: "demo", atariShape: "solid" };
    start(); cancelAnimationFrame(state.raf); togglePause();
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(state.paused && controls.visualizerMode.value === "ascii" && !state.currentFrame.vm2 && !state.currentFrame.atari && state.currentFrame.grid.length, "paused legacy scene recall restores the original ASCII renderer");
    assert(el("sceneDirty").textContent.includes("no changes"), "legacy scenes remain clean after Video Music 2 defaults are filled");
    controls.visualizerMode.value = "vm2"; schedulePreview();
    assert(el("sceneDirty").textContent === "Unsaved changes", "switching a legacy scene to Video Music 2 marks it dirty");
    recallScene(3); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.atari && !state.currentFrame.vm2, "original Atari scene still uses the original renderer");
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.vm2 && !state.currentFrame.atari, "paused scene recall returns to Video Music 2 immediately");
    assert(state.currentFrame.vm2.history.length === 0, "recalling a scene clears previous trail history");
    el("lockPalette").checked = true;
    controls.vm2Palette.value = "sunset"; controls.vm2Hue.value = "123";
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(controls.vm2Palette.value === "sunset" && controls.vm2Hue.value === "123", "palette lock preserves Video Music 2 color choices during recall");
    el("lockPalette").checked = false; recallScene(1); cancelAnimationFrame(state.raf);
    assert(controls.vm2Palette.value === "ice", "unlocked recall restores saved Video Music 2 colors");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
    controls.vm2Input.value = "audio"; storeScene(1); saveSceneSlots(); saveSetup();
    sessionStorage.setItem("vm2Reload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
