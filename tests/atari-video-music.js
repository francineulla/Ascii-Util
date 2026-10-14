(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const atariFields = ["atariInput", "atariShape", "atariHorizontal", "atariVertical", "atariGainLeft", "atariGainRight", "atariContourLeft", "atariContourRight", "atariColor", "atariAutoRate", "atariAutoShape"];
  const litPixels = pixels => {
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) count++;
    return count;
  };
  const pixelsOf = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  const fingerprint = pixels => {
    let hash = 2166136261;
    for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
    return hash >>> 0;
  };
  const channel = (level, frequency = 7) => ({
    level, crossings: frequency * 48000 / 1024,
    samples: Float32Array.from({ length: 1024 }, (_, i) => level * Math.sin(i * Math.PI * 2 * frequency / 1024))
  });
  const pngCanvas = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };

  try {
    clearTimeout(state.previewTimer);
    stopPreviewLoop();
    if (sessionStorage.getItem("atariReload")) {
      assert(controls.visualizerMode.value === "atari", "saved Atari mode is restored after reload");
      assert(controls.atariHorizontal.value === "3" && controls.atariVertical.value === "4", "multiplier controls survive reload");
      assert(controls.atariShape.value === "hole" && controls.atariGainLeft.value === "143", "shape and independent gain survive reload");
      assert(!audioState.stream && !audioState.context, "restoring an audio scene never requests audio automatically");
      document.body.innerHTML = "<p>PASS: Atari stereo/XOR geometry, Auto, immutable frames, controls, playback, preview/PNG capture, paused scene recall, audio lifecycle, and reload</p>";
      return;
    }

    assert(typeof AtariVideoMusic === "object", "Atari renderer loads before application startup");
    for (const id of ["visualizerMode", ...atariFields]) assert(controls[id] === el(id) && el(id), `${id} is a real connected control`);
    for (const [id, values] of Object.entries({ atariHorizontal: [1, 2, 3, 5], atariVertical: [1, 2, 4, 8], atariAutoRate: [1, 2, 4, 8] })) {
      assert(values.every(value => Array.from(controls[id].options).some(option => option.value === String(value))), `${id} exposes the hardware choices`);
    }
    for (const [id, maximum] of Object.entries({ atariGainLeft: 200, atariGainRight: 200, atariContourLeft: 100, atariContourRight: 100, atariColor: 100 })) {
      assert(Number(controls[id].min) === 0 && Number(controls[id].max) === maximum, `${id} has usable range limits`);
      assert(normalizePreset({ [id]: -100 })[id] === "0" && normalizePreset({ [id]: 10000 })[id] === String(maximum), `${id} clamps imported values`);
    }
    const rejected = normalizePreset({ atariShape: "invalid", atariHorizontal: "99", atariVertical: "99", atariAutoRate: "99" });
    assert(!rejected.atariShape && !rejected.atariHorizontal && !rejected.atariVertical && !rejected.atariAutoRate, "invalid imported choices are rejected");
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    controls.livePreview.checked = false;
    controls.visualizerMode.value = "atari";
    controls.atariInput.value = "demo";
    controls.atariShape.value = "solid";
    controls.atariHorizontal.value = "1";
    controls.atariVertical.value = "1";
    controls.atariGainLeft.value = "100";
    controls.atariGainRight.value = "100";
    controls.atariContourLeft.value = "0";
    controls.atariContourRight.value = "0";
    controls.atariColor.value = "50";
    controls.colorMode.value = "classic";
    controls.quality.value = "low";
    controls.recordingMode.checked = false;
    controls.fullscreenOnStart.checked = false;
    controls.transitionMode.value = "cut";
    prepareStateFromControls();
    const options = { ...state.options };
    const quiet = channel(0);
    const equal = channel(0.65);
    const different = { left: equal, right: channel(0.28, 19) };
    const raster = (shape, signal, extra = {}) => AtariVideoMusic.rasterize(AtariVideoMusic.buildFrame({ ...options, atariShape: shape, ...extra }, 900, signal, 42));
    assert(litPixels(raster("solid", { left: quiet, right: quiet })) === 0, "silent inputs produce a black picture");
    assert(litPixels(raster("solid", { left: equal, right: equal })) > 0, "equal stereo inputs remain visible in solid mode");
    for (const shape of ["hole", "ring"]) {
      assert(litPixels(raster(shape, { left: equal, right: equal })) === 0, `${shape} cancels equal inputs through XOR`);
      assert(litPixels(raster(shape, different)) > 0, `${shape} shows the difference between stereo inputs`);
    }
    // Nearby stereo levels previously rounded to the same comparator mask,
    // erasing whole rows (or the entire Hole/Ring image) before edge detection.
    const steady = level => ({ level, crossings: 220, samples: [] });
    const rowIsLit = (pixels, row) => {
      for (let x = 0; x < 320; x++) {
        const offset = (row * 320 + x) * 4;
        if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 3) return true;
      }
      return false;
    };
    for (const [horizontal, vertical] of [[1, 1], [3, 4], [5, 8]]) {
      const array = { atariHorizontal: horizontal, atariVertical: vertical };
      const closeStereo = { left: steady(0.25), right: steady(0.26) };
      const outer = raster("solid", { left: steady(0), right: closeStereo.right }, array);
      for (const shape of ["hole", "ring"]) {
        const close = raster(shape, closeStereo, array);
        assert(litPixels(close) > 0, `${shape} preserves narrow differences between steady stereo channels in ${horizontal}x${vertical} arrays`);
        for (let row = 0; row < 240; row++) {
          assert(!rowIsLit(outer, row) || rowIsLit(close, row), `${shape} retains every occupied outer-shape row instead of dropping a scanline`);
        }
        assert(litPixels(raster(shape, { left: steady(0.25), right: steady(0.25) }, array)) === 0, `${shape} still cancels truly equal channels after fractional edge sampling`);
      }
    }
    const one = raster("solid", different);
    assert(one.length === 320 * 240 * 4, "native raster has the documented 4:3 dimensions");
    assert(fingerprint(one) === fingerprint(raster("solid", different)), "the same inputs and seed produce the same frame");
    assert(litPixels(raster("solid", { left: equal, right: quiet }, { atariGainLeft: 0 })) === 0, "left gain can mute the left picture");
    assert(litPixels(raster("solid", { left: quiet, right: equal }, { atariGainRight: 0 })) === 0, "right gain can mute the right picture");
    assert(litPixels(raster("solid", { left: equal, right: quiet }, { atariGainRight: 0 })) > 0, "right gain does not mute the left picture");
    const multiplied = raster("solid", different, { atariHorizontal: 3, atariVertical: 4 });
    assert(fingerprint(one) !== fingerprint(multiplied), "multipliers change the rendered picture");
    const mutableSignal = { left: channel(0.65), right: channel(0.28, 19) };
    const snapshot = AtariVideoMusic.buildFrame(options, 900, mutableSignal, 42);
    const snapshotHash = fingerprint(AtariVideoMusic.rasterize(snapshot));
    mutableSignal.left.samples.fill(0); mutableSignal.right.samples.fill(1);
    mutableSignal.left.level = 0; mutableSignal.right.crossings = 20000;
    assert(fingerprint(AtariVideoMusic.rasterize(snapshot)) === snapshotHash, "later audio sampling cannot change a paused frame or its export");
    assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.left.thresholds) && Object.isFrozen(snapshot.right.colors), "stored frame and derived channel arrays are immutable");
    const solidColor = AtariVideoMusic.buildFrame({ ...options, atariColor: 100, atariGainLeft: 173, atariGainRight: 44 }, 900, different, 42);
    const otherColor = AtariVideoMusic.buildFrame({ ...options, atariColor: 100, atariGainLeft: 23, atariGainRight: 189 }, 900, { left: channel(0.32, 41), right: channel(0.81, 67) }, 42);
    assert(new Set([...solidColor.left.colors, ...solidColor.right.colors, ...otherColor.left.colors, ...otherColor.right.colors]).size === 1, "COLOR at maximum gives one color regardless of stereo frequency or gain");
    assert(JSON.stringify(solidColor.palette) === JSON.stringify(otherColor.palette), "solid color remains consistent across different inputs");
    const autoOptions = { ...options, atariShape: "auto", atariAutoRate: 1, atariAutoShape: "all", atariGainLeft: 143, atariGainRight: 78, atariContourLeft: 65, atariContourRight: 34, atariColor: 73 };
    const beforeAuto = JSON.stringify(autoOptions);
    const geometry = frame => `${frame.horizontal}/${frame.vertical}/${frame.shape}`;
    const autoFrames = Array.from({ length: 12 }, (_, step) => AtariVideoMusic.buildFrame(autoOptions, step * 1000, different, 42));
    assert(new Set(autoFrames.map(geometry)).size > 1, "Auto changes multiplier or shape over time");
    assert(autoFrames.every((frame, step) => geometry(frame) === geometry(AtariVideoMusic.buildFrame(autoOptions, step * 1000, different, 42))), "Auto progression is reproducible for a seed");
    assert(geometry(autoFrames[2]) === geometry(AtariVideoMusic.buildFrame({ ...autoOptions, atariAutoRate: 8 }, 16000, different, 42)), "Auto rate controls how long each step lasts");
    for (const shape of ["solid", "hole", "ring"]) {
      const lockedOptions = { ...autoOptions, atariAutoShape: shape };
      for (let step = 0; step < 8; step++) {
        const automatic = AtariVideoMusic.buildFrame(lockedOptions, step * 1000, different, 42);
        assert(automatic.shape === shape, `Auto respects the ${shape} shape lock at every step`);
        assert(JSON.stringify(automatic.left) === JSON.stringify(autoFrames[0].left) && JSON.stringify(automatic.right) === JSON.stringify(autoFrames[0].right) && JSON.stringify(automatic.palette) === JSON.stringify(autoFrames[0].palette), "Auto preserves gain, contour, and color settings");
      }
    }
    assert(JSON.stringify(autoOptions) === beforeAuto, "Auto leaves manual knob values unchanged");
    const demo = AtariVideoMusic.demoSignal(900, 120, 42);
    assert(demo.left.samples.length && demo.right.samples.length, "demo provides waveform samples for both channels");
    assert(JSON.stringify(demo) === JSON.stringify(AtariVideoMusic.demoSignal(900, 120, 42)), "demo is reproducible");
    assert(JSON.stringify(demo.left) !== JSON.stringify(demo.right), "demo drives stereo channels independently");
    assert(JSON.stringify(demo) !== JSON.stringify(AtariVideoMusic.demoSignal(1400, 120, 42)), "demo changes over time");

    const frame = buildFrame(state.startedAt + 900, 640, 480, true);
    assert(frame.atari && frame.grid.length === 0, "Atari mode creates a native payload without an ASCII grid");
    assert(buildFrame(state.startedAt - 100, 640, 480, true).elapsed === 0, "Atari preview tolerates timestamps before playback starts");
    renderFrame(frame);
    assert(!controls.canvas.hidden && controls.ascii.hidden, "Atari mode uses canvas even when ASCII color mode is classic");
    assert(litPixels(pixelsOf(controls.canvas)) > 0, "stage canvas contains Atari pixels");
    state.previewPrepared = null;
    renderPreview();
    assert(!controls.previewReadout.textContent.includes("error") && !controls.previewReadout.textContent.includes("failed"), "menu preview renders without an error");
    assert(litPixels(pixelsOf(controls.previewCanvas)) > 0, "menu preview contains Atari pixels");

    let download;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { download = { href: this.href, name: this.download }; };
    try {
      saveFrame();
      assert(download && download.href.startsWith("data:image/png") && download.name.endsWith(".png"), "menu Save PNG exports a real image");
      const exported = await pngCanvas(download.href);
      assert(exported.width > 0 && litPixels(pixelsOf(exported)) > 0, "saved Atari PNG contains the picture");
      controls.recordingMode.checked = true;
      controls.captureSize.value = "1280x720";
      controls.scanlines.checked = false;
      controls.invert.checked = false;
      saveFrame();
      const fixedExport = await pngCanvas(download.href);
      assert(fixedExport.width === 1280 && fixedExport.height === 720, "PNG export honors the fixed recording dimensions");
      const fixedContext = fixedExport.getContext("2d");
      assert(litPixels(fixedContext.getImageData(0, 0, 159, 720).data) === 0 && litPixels(fixedContext.getImageData(1121, 0, 159, 720).data) === 0, "wide PNG keeps black side bars around the original 4:3 picture");
      assert(litPixels(fixedContext.getImageData(160, 0, 960, 720).data) > 0, "letterboxed PNG preserves the active picture");
      controls.recordingMode.checked = false;
      controls.captureSize.value = "window";
      el("atariStart").click(); cancelAnimationFrame(state.raf);
      assert(state.running && state.currentFrame.atari, "Atari panel Go button starts playback");
      const playbackFrames = new Set();
      for (let index = 1; index <= 12; index++) {
        loop(state.startedAt + index * 120); cancelAnimationFrame(state.raf);
        assert(state.running && state.currentFrame.atari && !controls.canvas.hidden, "subsequent playback frames remain valid");
        playbackFrames.add(fingerprint(AtariVideoMusic.rasterize(state.currentFrame.atari)));
      }
      assert(playbackFrames.size > 1, "playback visibly updates across animation frames");
      togglePause();
      saveFrame();
      assert(litPixels(pixelsOf(await pngCanvas(download.href))) > 0, "paused playback can export its native frame");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    controls.atariShape.value = "hole";
    controls.atariHorizontal.value = "3";
    controls.atariVertical.value = "4";
    controls.atariGainLeft.value = "143";
    selectSceneSlot(1); storeScene();
    const saved = state.scenes[0];
    const shared = decodePresetFromUrl(encodePresetForUrl(saved));
    assert(shared.visualizerMode === "atari" && atariFields.every(id => shared[id] === saved[id]), "share URL carries every Atari setting");
    const legacy = { ...saved, seed: "legacy-ascii", glyphSize: "24" };
    delete legacy.visualizerMode;
    for (const id of atariFields) delete legacy[id];
    state.scenes[1] = legacy;
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(state.paused && !state.pendingPreset && controls.visualizerMode.value === "ascii", "paused legacy scene recall selects ASCII immediately");
    assert(!state.currentFrame.atari && state.currentFrame.grid.length && controls.canvas.hidden && !controls.ascii.hidden, "legacy scene renders through the existing classic renderer");
    assert(el("sceneDirty").textContent.includes("no changes"), "legacy scene recall remains clean after new controls receive defaults");
    controls.visualizerMode.value = "atari";
    schedulePreview();
    assert(el("sceneDirty").textContent === "Unsaved changes", "changing a legacy scene to Atari marks it dirty");
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(controls.visualizerMode.value === "ascii" && el("sceneDirty").textContent.includes("no changes"), "recalling the legacy scene reverts the mode and clears dirty state");
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.atari && !controls.canvas.hidden && controls.ascii.hidden, "paused recall switches back to Atari without resuming");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();

    const originalMedia = navigator.mediaDevices;
    const OriginalContext = window.AudioContext;
    const connected = [];
    let stopped = 0, closed = 0, ended;
    const track = { stop() { stopped++; }, addEventListener(event, callback) { if (event === "ended") ended = callback; } };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    const node = kind => ({
      kind, connect(target, output = 0) { connected.push({ source: this, target, output }); if (kind === "splitter") target.channel = output; }, disconnect() {}
    });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => stream,
      getDisplayMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [] })
    } });
    window.AudioContext = class {
      sampleRate = 48000;
      destination = node("destination");
      resume() { return Promise.resolve(); }
      close() { closed++; return Promise.resolve(); }
      createMediaStreamSource() { return node("source"); }
      createGain() { return { ...node("gain"), gain: { value: 1 } }; }
      createChannelSplitter(channels) { assert(channels === 2, "audio splits into two channels"); return node("splitter"); }
      createAnalyser() {
        return { ...node("analyser"), fftSize: 1024, getFloatTimeDomainData(array) {
          const amplitude = this.channel === 1 ? 0.025 : 0.24;
          const frequency = this.channel === 1 ? 43 : 7;
          for (let i = 0; i < array.length; i++) array[i] = amplitude * Math.sin(i * Math.PI * 2 * frequency / array.length);
        } };
      }
    };
    try {
      el("audioSource").value = "microphone";
      await connectAudio();
      sampleAudio();
      assert(audioState.left.level > audioState.right.level && audioState.right.level > 0, "left and right envelopes preserve different input levels");
      assert(audioState.left.crossings !== audioState.right.crossings, "channel frequency estimates remain independent");
      assert(audioState.left.samples !== audioState.right.samples, "stereo channels have separate sample buffers");
      const splitInputs = connected.filter(edge => edge.target.kind === "splitter");
      assert(splitInputs.length === 1 && splitInputs[0].source.channelCount === 2 && splitInputs[0].source.channelCountMode === "explicit" && splitInputs[0].source.channelInterpretation === "speakers", "mono capture is duplicated before the stereo split");
      assert(audioState.level > 0 && el("audioMeter").value > 0, "existing aggregate meter remains functional");
      controls.atariInput.value = "audio";
      prepareStateFromControls();
      const audioFrame = buildFrame(state.startedAt + 900, 320, 240, true);
      assert(litPixels(AtariVideoMusic.rasterize(audioFrame.atari)) > 0, "captured stereo input drives the Atari picture");
      ended();
      assert(stopped > 0 && closed > 0 && !audioState.stream && !audioState.context && audioState.level === 0, "source ending releases capture resources");
      assert(audioState.left.level === 0 && audioState.right.level === 0, "disconnect clears both channel envelopes");
      assert(litPixels(AtariVideoMusic.rasterize(buildFrame(state.startedAt + 900, 320, 240, true).atari)) === 0, "audio mode becomes silent after disconnect");
      el("audioSource").value = "screen";
      await connectAudio();
      assert(!audioState.stream && el("audioReadout").textContent.includes("No audio was shared"), "sharing without an audio track is recoverable");
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Permission denied", "NotAllowedError"); };
      el("audioSource").value = "microphone";
      await connectAudio();
      assert(!el("connectAudio").disabled && !audioState.stream && el("audioReadout").textContent.includes("Permission denied"), "denied microphone permission allows retry");
      let resolveStream;
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveStream = resolve; });
      const pending = connectAudio();
      disconnectAudio(); resolveStream(stream); await pending;
      assert(!audioState.stream && !audioState.context, "cancelled permission request cannot reconnect later");
    } finally {
      disconnectAudio(); window.AudioContext = OriginalContext;
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMedia });
    }
    recallScene(1);
    controls.atariInput.value = "audio";
    storeScene(1); saveSceneSlots(); saveSetup();
    sessionStorage.setItem("atariReload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
