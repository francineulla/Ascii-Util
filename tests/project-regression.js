(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const el = id => document.getElementById(id);
  const stopBackgroundWork = () => {
    cancelAnimationFrame(state.raf);
    stopPreviewLoop();
    clearTimeout(state.previewTimer);
  };
  const decodePng = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  const corner = canvas => Array.from(canvas.getContext("2d").getImageData(0, 0, 1, 1).data);
  const litPixels = canvas => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) count++;
    return count;
  };

  try {
    stopBackgroundWork();
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    controls.fullscreenOnStart.checked = false;
    controls.livePreview.checked = false;
    controls.quality.value = "low";
    controls.glyphSize.value = "24";
    controls.transitionMode.value = "cut";
    intervalMode.checked = false;

    // Old single-scene imports must use the old renderer, regardless of the current mode.
    const legacy = { ...getPreset(), lyrics: "LEGACY ASCII WORDS", seed: "legacy-import", bpm: "120" };
    delete legacy.visualizerMode;
    for (const id of Object.keys(atariDefaults)) delete legacy[id];
    for (const id of Object.keys(vm2Defaults)) delete legacy[id];
    for (const payload of [legacy, { type: "ascii-bpm-scene", version: 2, preset: legacy }]) {
      controls.visualizerMode.value = "atari";
      controls.atariGainLeft.value = "173";
      controls.presetData.value = JSON.stringify(payload);
      loadPreset();
      assert(controls.visualizerMode.value === "ascii", "legacy single import selects ASCII instead of inheriting Atari");
      assert(state.scenes[state.selectedSceneSlot - 1].visualizerMode === "ascii", "legacy import stores the correct renderer");
      assert(controls.lyrics.value === legacy.lyrics && controls.seed.value === legacy.seed, "legacy import preserves its actual settings");
    }
    controls.visualizerMode.value = "atari";
    controls.presetData.value = "#preset=" + encodePresetForUrl(legacy);
    loadPreset();
    assert(controls.visualizerMode.value === "ascii", "pasted legacy share URL also selects ASCII");

    // Tempo changes must preserve the paused transport position, excluding time spent paused.
    start();
    stopBackgroundWork();
    const originalNowDescriptor = Object.getOwnPropertyDescriptor(performance, "now");
    try {
      Object.defineProperty(performance, "now", { configurable: true, value: () => 20000 });
      state.paused = true;
      state.startedAt = 10000;
      state.pausedAt = 12000;
      state.options.bpm = 120;
      controls.bpm.value = "120";
      const beforeBeat = (state.pausedAt - state.startedAt) / (60000 / state.options.bpm);
      nudgeBpm(5);
      const afterBeat = (state.pausedAt - state.startedAt) / (60000 / state.options.bpm);
      assert(Math.abs(beforeBeat - afterBeat) < 1e-9 && state.paused, "paused BPM nudge preserves beat position and pause");
      state.startedAt = 10000;
      state.options.bpm = 120;
      controls.bpm.value = "120";
      state.midiPulseCount = 23;
      state.midiClockTimes = [];
      handleMidiClock(21137);
      assert(state.startedAt === 10000 && state.pausedAt === 12000, "MIDI clock does not move the paused transport origin");
      controls.midiSync.checked = true;
      handleMidiMessage({ data: [0xFA], receivedTime: 20000 });
      assert(state.running && !state.paused && state.startedAt === 20000, "MIDI Start restarts and resumes a manually paused transport");
      stopBackgroundWork();
      state.paused = true;
      state.startedAt = 10000;
      state.pausedAt = 12000;
      handleMidiMessage({ data: [0xFB], receivedTime: 20000 });
      assert(state.running && !state.paused && 20000 - state.startedAt === 2000, "MIDI Continue resumes at the frozen playback position");
      stopBackgroundWork();
    } finally {
      if (originalNowDescriptor) Object.defineProperty(performance, "now", originalNowDescriptor);
      else delete performance.now;
      stop();
      stopBackgroundWork();
    }

    // The menu preview must follow incoming MIDI tempo despite its parsed-settings cache.
    controls.bpm.value = "120";
    controls.livePreview.checked = true;
    state.previewPrepared = null;
    renderPreview(500);
    resetMidiClock(1000);
    for (let pulse = 0; pulse < 24; pulse++) handleMidiClock(1000 + pulse * 60000 / 180 / 24);
    renderPreview(2000);
    assert(controls.bpm.value === "180" && controls.previewReadout.textContent.includes("180 BPM"), "MIDI tempo refreshes the live preview as well as the BPM input");
    controls.livePreview.checked = false;
    stopBackgroundWork();

    // Explicitly selecting no MIDI input must detach an existing input.
    const previousMidiAccess = state.midiAccess;
    const previousMidiId = state.midiInputId;
    const input = { id: "audit-midi", name: "Regression MIDI", onmidimessage: null };
    try {
      state.midiAccess = { inputs: new Map([[input.id, input]]) };
      state.midiInputId = "";
      populateMidiInputs();
      controls.midiInput.value = input.id;
      attachMidiInput();
      assert(typeof input.onmidimessage === "function", "choosing a MIDI input connects it");
      controls.midiInput.value = "";
      attachMidiInput();
      assert(controls.midiInput.value === "" && !input.onmidimessage, "No MIDI input remains selected and disconnects messages");
    } finally {
      state.midiAccess = previousMidiAccess;
      state.midiInputId = previousMidiId;
      populateMidiInputs();
    }

    // UTF-8 expansion must not make the app reject a URL that its own encoder accepted.
    const unicodePreset = { lyrics: "漢".repeat(60000), maskArt: "語".repeat(60000) };
    const encoded = encodePresetForUrl(unicodePreset);
    const decoded = decodePresetFromUrl(encoded);
    assert(decoded.lyrics === unicodePreset.lyrics && decoded.maskArt === unicodePreset.maskArt, "large Unicode lyrics and masks survive share URL round-trip");

    // Playback shortcuts update dirty feedback and the persisted values behind global locks.
    controls.midiSync.checked = false;
    controls.visualizerMode.value = "ascii";
    controls.invert.checked = false;
    start();
    stopBackgroundWork();
    storeScene();
    const key = (value, code) => controls.stage.dispatchEvent(new KeyboardEvent("keydown", { key: value, code, bubbles: true, cancelable: true }));
    key("ArrowUp", "ArrowUp");
    assert(el("sceneDirty").textContent === "Unsaved changes", "tempo keyboard shortcut immediately updates dirty feedback");
    storeScene();
    el("lockTempo").checked = true;
    el("lockPalette").checked = true;
    key("ArrowUp", "ArrowUp");
    key("i", "KeyI");
    const lockedBpm = controls.bpm.value;
    const savedSetup = JSON.parse(localStorage.getItem("asciiBpmSetup"));
    assert(savedSetup.lockedValues.bpm === lockedBpm && savedSetup.lockedValues.invert === true, "tempo and inversion keyboard shortcuts persist their locked values");
    assert(el("sceneDirty").textContent.includes("no changes"), "locked shortcut changes stay excluded from scene dirty feedback");
    controls.bpm.value = "20";
    controls.invert.checked = false;
    loadSetup();
    assert(controls.bpm.value === lockedBpm && controls.invert.checked, "saved setup restores shortcut-adjusted global values");
    el("lockTempo").checked = false;
    el("lockPalette").checked = false;
    stop();
    stopBackgroundWork();

    // Fixed PNG sizes refer to output pixels, even when the screen uses a high DPR.
    let download;
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalDpr = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    HTMLAnchorElement.prototype.click = function () { download = { href: this.href, name: this.download }; };
    try {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
      controls.visualizerMode.value = "ascii";
      controls.recordingMode.checked = true;
      controls.captureSize.value = "1280x720";
      controls.invert.checked = false;
      controls.scanlines.checked = false;
      controls.colorMode.value = "spotlight";
      start();
      stopBackgroundWork();
      saveFrame();
      const plain = await decodePng(download.href);
      assert(plain.width === 1280 && plain.height === 720, "coloured ASCII PNG uses exact capture dimensions at DPR 2");
      assert(corner(plain)[3] === 255, "ASCII PNG has the opaque stage background");
      state.options.invert = true;
      saveFrame();
      const inverted = await decodePng(download.href);
      assert(corner(inverted).slice(0, 3).reduce((sum, value) => sum + value, 0) > corner(plain).slice(0, 3).reduce((sum, value) => sum + value, 0), "ASCII PNG includes the active inversion");
      stop();
      stopBackgroundWork();
      controls.colorMode.value = "classic";
      controls.invert.checked = false;
      saveFrame();
      const classic = await decodePng(download.href);
      assert(classic.width === 1280 && classic.height === 720, "classic ASCII PNG uses exact capture dimensions");
      controls.visualizerMode.value = "atari";
      controls.atariInput.value = "demo";
      saveFrame();
      const atari = await decodePng(download.href);
      assert(atari.width === 1280 && atari.height === 720 && litPixels(atari) > 0, "original Atari PNG remains visible at exact capture dimensions");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      if (originalDpr) Object.defineProperty(window, "devicePixelRatio", originalDpr);
      else delete window.devicePixelRatio;
      stop();
      stopBackgroundWork();
    }

    // Spectrum features must distinguish bands, decay after silence, and retain stereo direction.
    const savedAudioState = { ...audioState };
    const previousSensitivity = el("audioSensitivity").value;
    let frequency = 100, amplitude = 0.18, leftAmplitude = 0.3, rightAmplitude = 0.05, audioTime = 0;
    const advanceAudio = () => sampleAudio(audioTime += 16);
    const waveform = (buffer, gain) => buffer.forEach((_, i) => { buffer[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * gain; });
    try {
      el("audioSensitivity").value = "4";
      Object.assign(audioState, {
        context: { sampleRate: 48000 }, samples: new Float32Array(1024), frequencies: null,
        level: 0, previousTarget: 0, lastSampleAt: null, frequencyBuffers: [], features: emptyAudioFeatures(),
        left: emptyAudioChannel(), right: emptyAudioChannel(),
        analyser: {
          fftSize: 1024, frequencyBinCount: 512,
          getFloatTimeDomainData: buffer => waveform(buffer, amplitude),
          getFloatFrequencyData: buffer => {
            buffer.fill(-Infinity);
            if (amplitude) buffer[Math.round(frequency * 1024 / 48000)] = -22;
          }
        },
        analysers: [
          { fftSize: 2048, frequencyBinCount: 1024, getFloatTimeDomainData: buffer => waveform(buffer, leftAmplitude), getFloatFrequencyData: buffer => { buffer.fill(-Infinity); if (leftAmplitude) buffer[Math.round(frequency * 2048 / 48000)] = -22; } },
          { fftSize: 2048, frequencyBinCount: 1024, getFloatTimeDomainData: buffer => waveform(buffer, rightAmplitude), getFloatFrequencyData: buffer => { buffer.fill(-Infinity); if (rightAmplitude) buffer[Math.round(frequency * 2048 / 48000)] = -22; } }
        ],
        sampleBuffers: [new Float32Array(2048), new Float32Array(2048)]
      });
      for (const [hz, band] of [[100, "bass"], [1000, "mid"], [8000, "treble"]]) {
        frequency = hz;
        audioState.features = emptyAudioFeatures();
        audioState.left.features = emptyAudioFeatures(); audioState.right.features = emptyAudioFeatures();
        for (let i = 0; i < 10; i++) advanceAudio();
        assert(audioState.features[band] > 0.4 && ["bass", "mid", "treble"].filter(id => id !== band).every(id => audioState.features[id] === 0), `${hz} Hz excites only the correct spectrum band`);
      }
      assert(audioState.features.pan < -0.5, "left-heavy stereo produces a leftward lighting response");
      leftAmplitude = 0.05; rightAmplitude = 0.3;
      for (let i = 0; i < 30; i++) advanceAudio();
      assert(audioState.features.pan > 0.5, "right-heavy stereo produces a rightward lighting response");
      audioState.previousTarget = 0;
      audioState.left.previousTarget = audioState.right.previousTarget = 0;
      advanceAudio();
      const attack = audioState.features.transient;
      for (let i = 0; i < 20; i++) advanceAudio();
      assert(attack > 0.5 && audioState.features.transient < attack / 10, "transients accent a new attack and decay on a steady signal");
      amplitude = leftAmplitude = rightAmplitude = 0;
      for (let i = 0; i < 90; i++) advanceAudio();
      assert(Object.values(audioState.features).every(value => Math.abs(value) < 0.0001), "silence clears band energy, transient accents, and stereo bias");
    } finally {
      Object.assign(audioState, savedAudioState);
      el("audioSensitivity").value = previousSensitivity;
    }

    // Disconnect must clear a static audio preview without requiring another user action.
    controls.recordingMode.checked = false;
    controls.invert.checked = false;
    controls.scanlines.checked = false;
    controls.livePreview.checked = false;
    controls.visualizerMode.value = "atari";
    controls.atariInput.value = "audio";
    controls.atariShape.value = "solid";
    const channel = (level, divisor) => ({ level, crossings: 400, samples: Float32Array.from({ length: 2048 }, (_, i) => Math.sin(i / divisor) * level) });
    audioState.left = channel(0.8, 16);
    audioState.right = channel(0.3, 6);
    state.previewPrepared = null;
    renderPreview();
    const monitor = el("atariMonitor");
    assert(litPixels(monitor) > 0, "connected signal is visible before disconnect");
    stopBackgroundWork();
    disconnectAudio();
    assert(Object.values(audioState.features).every(value => value === 0) && audioState.frequencies === null && audioState.previousTarget === 0, "disconnect resets all spectral and onset history");
    await wait(180);
    assert(litPixels(monitor) === 0, "disconnect clears the static audio preview automatically");
    stopBackgroundWork();
    document.body.innerHTML = "<p>PASS: legacy imports, paused tempo, MIDI transport/preview/input selection, locked shortcuts, Unicode shares, exact PNG capture, and audio disconnect preview</p>";
  } catch (error) {
    stopBackgroundWork();
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
