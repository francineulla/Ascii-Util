(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const el = id => document.getElementById(id);
  try {
    clearTimeout(state.previewTimer);
    stopPreviewLoop();
    if (sessionStorage.getItem("featuresReload")) {
      assert(state.scenes[0].sceneName === "Opening <b>night</b>", "scene name persists");
      assert(el("lockTempo").checked && controls.bpm.value === "177", "global tempo lock and value persist");
      assert(el("sceneEffect").value === "wipe", "effect preference persists");
      assert(!audioState.stream, "reload never opens microphone automatically");
      document.body.innerHTML = "<p>PASS: legacy imports, scene names, dirty state, global locks, slide effects, audio lifecycle, and reload</p>";
      return;
    }
    const base = getPreset();
    delete base.sceneName;
    selectSceneSlot(1);
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene", version: 2, preset: base });
    loadPreset();
    assert(controls.sceneName.value === "", "legacy scene has no inherited name");
    assert(el("sceneDirty").textContent.includes("no changes"), "import is clean");
    controls.sceneName.value = "Opening <b>night</b>";
    controls.sceneName.dispatchEvent(new Event("input"));
    assert(el("sceneDirty").textContent === "Unsaved changes", "rename marks dirty");
    storeScene();
    assert(!el("sceneSlots").querySelector("b"), "name is plain text");
    assert(el("sceneSlots").querySelector("button").textContent.includes("Opening <b>night</b>"), "slot shows name");
    controls.seed.value = "changed";
    schedulePreview();
    assert(!el("revertScene").disabled, "revert enabled after edit");
    el("revertScene").click();
    assert(controls.seed.value === base.seed && el("sceneDirty").textContent.includes("no changes"), "revert restores saved scene");
    const encoded = encodePresetForUrl(getPreset());
    assert(decodePresetFromUrl(encoded).sceneName === "Opening <b>night</b>", "name survives share format");
    await copyPreset();
    assert(JSON.parse(controls.presetData.value).preset.sceneName === "Opening <b>night</b>", "named single export keeps old wrapper shape");
    await copySceneBank();
    const bank = JSON.parse(controls.presetData.value);
    assert(bank.scenes[0].sceneName === "Opening <b>night</b>" && !bank.scenes[0].preset, "named bank retains flat scene entries");
    loadSceneBank();
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene-bank", version: 1, scenes: [state.scenes[0], base, null] });
    loadSceneBank();
    recallScene(2);
    assert(controls.sceneName.value === "" && sceneLabel(2) === "Scene 2", "legacy bank scene uses fallback name");

    for (const id of Object.keys(lockGroups)) el(id).checked = true;
    controls.bpm.value = "177";
    controls.lyrics.value = "MY WORDS";
    controls.palette.value = "ocean";
    controls.quality.value = "low";
    recallScene(1);
    assert(controls.bpm.value === "177" && controls.lyrics.value === "MY WORDS" && controls.palette.value === "ocean" && controls.quality.value === "low", "all four locks survive recall");
    const named = state.scenes[0];
    controls.presetData.value = JSON.stringify({ ...base, bpm: "90", lyrics: "IMPORTED", palette: "amber", quality: "high" });
    selectSceneSlot(3);
    loadPreset();
    assert(controls.bpm.value === "177" && state.scenes[2].bpm === "90", "import stores original values while preserving active lock");
    state.scenes[0] = named;
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    recallScene(2);
    controls.quality.value = "low";
    controls.glyphSize.value = "24";
    intervalMode.checked = false;
    start(); cancelAnimationFrame(state.raf);
    el("sceneDuration").value = "0.1";
    for (const effect of ["crossfade", "wipe", "slide", "zoom"]) {
      el("sceneEffect").value = effect;
      controls.transitionMode.value = "cut";
      recallScene(1); cancelAnimationFrame(state.raf);
      assert(activeSceneTransition && document.querySelectorAll(".scene-transition").length === 1, `${effect} captures outgoing frame`);
      assert(controls.stage.contains(activeSceneTransition.layer), `${effect} stays inside the fullscreen stage`);
      // Complete the browser animation deterministically, without depending on headless RAF cadence.
      activeSceneTransition.animations[0].finish();
      await wait(30);
      assert(!activeSceneTransition && !document.querySelector(".scene-transition"), `${effect} cleans up`);
    }
    controls.colorMode.value = "classic"; controls.invert.checked = true; restartPlayback(); cancelAnimationFrame(state.raf);
    renderFrame(buildFrame(performance.now(), 640, 480, true));
    const classicFont = getComputedStyle(controls.ascii).fontFamily;
    controls.transitionMode.value = "cut"; recallScene(2); cancelAnimationFrame(state.raf);
    assert(activeSceneTransition.layer.firstChild.style.fontFamily === classicFont, "classic snapshot preserves font");
    assert(getComputedStyle(activeSceneTransition.layer).filter.includes("invert(1)"), "outgoing snapshot retains its inversion");
    assert(getComputedStyle(controls.stage).filter === "none", "stage does not apply incoming inversion to outgoing snapshot");
    togglePause();
    assert(activeSceneTransition.animations.every(animation => animation.playState === "paused"), "pause freezes effect");
    recallScene(1);
    assert(state.paused && !activeSceneTransition, "paused recall clears outgoing effect");
    stop(); clearTimeout(state.previewTimer);

    const originalMedia = navigator.mediaDevices;
    const OriginalContext = window.AudioContext;
    let stopped = 0, closed = 0;
    const track = { stop() { stopped++; }, addEventListener() {} };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    const mockAudioNode = () => ({ connect() {}, disconnect() {} });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => stream, getDisplayMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [] }) } });
    window.AudioContext = class {
      sampleRate = 48000;
      destination = mockAudioNode();
      resume() { return Promise.resolve(); }
      close() { closed++; return Promise.resolve(); }
      createMediaStreamSource() { return mockAudioNode(); }
      createGain() { return { ...mockAudioNode(), gain: { value: 1 } }; }
      createChannelSplitter() { return mockAudioNode(); }
      createAnalyser() { return { ...mockAudioNode(), fftSize: 1024, getFloatTimeDomainData(array) { array.fill(0.1); } }; }
    };
    try {
      el("audioSource").value = "microphone";
      await connectAudio();
      sampleAudio();
      assert(audioState.level > 0 && el("audioMeter").value > 0, "audio signal drives level meter");
      const before = controls.bpm.value;
      prepareStateFromControls();
      audioState.level = 0; const silent = frameToText(buildFrame(state.startedAt + 100, 320, 240, true).grid);
      audioState.level = 1; const loud = frameToText(buildFrame(state.startedAt + 100, 320, 240, true).grid);
      assert(silent !== loud && controls.bpm.value === before, "audio changes visuals without changing tempo");
      disconnectAudio();
      assert(stopped && closed && !audioState.stream && audioState.level === 0, "disconnect releases resources");
      el("audioSource").value = "screen";
      await connectAudio();
      assert(!audioState.stream && el("audioReadout").textContent.includes("No audio was shared"), "missing shared audio handled");
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Permission denied", "NotAllowedError"); };
      el("audioSource").value = "microphone";
      await connectAudio();
      assert(!el("connectAudio").disabled && el("audioReadout").textContent.includes("Permission denied"), "permission denial is recoverable");
      let resolveStream;
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveStream = resolve; });
      const pending = connectAudio(); disconnectAudio(); resolveStream(stream); await pending;
      assert(!audioState.stream, "cancelled permission request cannot reconnect later");
    } finally {
      disconnectAudio(); window.AudioContext = OriginalContext;
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMedia });
    }
    selectSceneSlot(1); recallScene(1);
    el("lockTempo").checked = true; controls.bpm.value = "177";
    el("sceneEffect").value = "wipe";
    saveSceneSlots(); saveSetup();
    sessionStorage.setItem("featuresReload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
