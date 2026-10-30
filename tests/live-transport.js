(async () => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const el = id => document.getElementById(id);
  const originalRequest = Object.getOwnPropertyDescriptor(navigator, "requestMIDIAccess");
  const originalNow = Object.getOwnPropertyDescriptor(performance, "now");
  const originalRaf = window.requestAnimationFrame, originalCancel = window.cancelAnimationFrame;
  const originalSnapshot = captureHistorySnapshot, originalSetItem = Storage.prototype.setItem;
  const originalInterval = getFrameInterval, originalPrepare = prepareStateFromControls;
  let failure = null, testNow = 10000;
  const quiet = () => {
    clearTimeout(state.previewTimer); stopPreviewLoop(); cancelAnimationFrame(state.raf); state.raf = 0;
    clearTimeout(editHistory.draftTimer); clearTimeout(editHistory.editTimer);
    clearTimeout(galleryRefreshTimer);
  };
  try {
    quiet(); initMidiTransport(); disconnectMidi();
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    applyPreset({ ...getPreset(), visualizerMode: "ascii", livePreview: false, fullscreenOnStart: false, fpsCap: "0", quality: "low", glyphSize: "24", bpm: "120" });
    quiet();
    Object.defineProperty(performance, "now", { configurable: true, value: () => testNow });
    let permissionCalls = 0, resolvePermission;
    const port = { id: "show-clock", name: "Show clock", state: "connected", onmidimessage: null };
    const access = { inputs: new Map([[port.id, port]]), onstatechange: null };
    Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: () => { permissionCalls++; return new Promise(resolve => { resolvePermission = resolve; }); } });
    const firstConnect = connectMidi(), secondConnect = connectMidi();
    await Promise.resolve();
    assert(permissionCalls === 1 && controls.connectMidi.disabled, "concurrent connect actions share one MIDI permission request");
    resolvePermission(access); await Promise.all([firstConnect, secondConnect]); quiet();
    assert(state.midiAccess === access && midiSession.input === port && typeof port.onmidimessage === "function", "one granted request attaches the selected input");
    const handler = port.onmidimessage, healthTimer = midiSession.timer;
    await connectMidi();
    assert(permissionCalls === 1 && port.onmidimessage === handler && midiSession.timer === healthTimer, "reconnecting an existing access reuses the handler and watchdog");
    applyPreset({ ...getPreset(), midiSync: false });
    assert(!midiSession.timer && controls.midiReadout.textContent === "MIDI: off", "a scene disabling MIDI stops health monitoring immediately");
    applyPreset({ ...getPreset(), midiSync: true });
    assert(midiSession.timer && controls.midiReadout.textContent.includes("waiting for clock") && permissionCalls === 1, "a scene re-enabling MIDI restarts monitoring without requesting access or claiming an old lock");
    undoEdit();
    assert(!controls.midiSync.checked && !midiSession.timer, "undoing the sync change reconciles the watchdog");
    redoEdit();
    assert(controls.midiSync.checked && midiSession.timer && controls.midiReadout.textContent.includes("waiting for clock"), "redoing the sync change restarts the watchdog with fresh status");
    for (let pulse = 0; pulse < 24; pulse++) { testNow += 60000 / 120 / 24; handleMidiClock(testNow); }
    testNow += 1600; checkMidiClockHealth(testNow);
    assert(controls.midiReadout.textContent.includes("clock lost"), "clock loss remains detectable after scene and history sync toggles");
    el("lockTempo").checked = true;
    resetHistoryBaseline(); quiet(); resetMidiClock(testNow);
    const cachedPreview = { options: { ...collectOptions() } }, previewTrails = { preserved: true };
    state.previewPrepared = cachedPreview; state.previewVm2Frame = previewTrails;
    let snapshots = 0, writes = 0;
    captureHistorySnapshot = (...args) => { snapshots++; return originalSnapshot(...args); };
    Storage.prototype.setItem = function (...args) { writes++; return originalSetItem.apply(this, args); };
    const historyLength = editHistory.entries.length;
    for (let pulse = 0; pulse < 288; pulse++) {
      testNow += 60000 / 180 / 24 + (pulse < 240 ? (pulse % 3 - 1) * 0.3 : 0);
      handleMidiMessage({ data: [0xF8], receivedTime: testNow });
    }
    assert(controls.bpm.value === "180" && controls.midiReadout.textContent.includes("clock locked"), "external clock converges to tempo despite bounded timing jitter");
    assert(snapshots === 0 && writes === 0 && editHistory.entries.length === historyLength, "hundreds of MIDI pulses create no history snapshots, draft writes, or setup writes");
    assert(state.previewPrepared === cachedPreview && cachedPreview.options.bpm === 180 && state.previewVm2Frame === previewTrails, "external tempo updates cached options without reparsing or discarding preview trails");
    clearTimeout(midiSession.uiTimer); midiSession.uiTimer = 0;
    nudgeBpm(1, testNow);
    assert(snapshots > 0 && editHistory.entries.length > historyLength && controls.bpm.value === "181", "manual tempo changes retain normal edit history");
    captureHistorySnapshot = originalSnapshot; Storage.prototype.setItem = originalSetItem; quiet();
    el("lockTempo").checked = false;
    const pulseCount = state.midiPulseCount, lastClock = midiSession.lastClockAt;
    for (const invalid of [NaN, Infinity, -1, lastClock, lastClock - 1, lastClock + 0.1]) handleMidiClock(invalid);
    handleMidiMessage({ data: [0xF8], receivedTime: testNow + 100000 });
    handleMidiMessage({ data: [0xFA], receivedTime: NaN });
    handleMidiMessage({ data: [] });
    assert(state.midiPulseCount === pulseCount && Number.isFinite(Number(controls.bpm.value)), "non-finite, duplicate, reversed, implausibly fast and future timestamps are ignored");

    const frames = new Map(); let nextFrame = 0;
    window.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
    window.cancelAnimationFrame = id => { frames.delete(id); };
    const runFrame = () => {
      const entry = frames.entries().next().value;
      assert(entry, "a playback frame is scheduled"); frames.delete(entry[0]); entry[1](testNow += 17);
    };
    start();
    assert(state.running && frames.size === 1, "playback owns exactly one scheduled animation frame");
    el("lockTempo").checked = true;
    setPlaybackTempo(179, testNow, false);
    stop();
    assert(JSON.parse(localStorage.getItem("asciiBpmSetup")).lockedValues.bpm === "179"
      && JSON.parse(localStorage.getItem(editHistory.draftKey)).preset.bpm === "179", "returning to setup persists the final external tempo once, including its global lock");
    el("lockTempo").checked = false;
    start();
    const fullscreenRequest = Object.getOwnPropertyDescriptor(controls.stage, "requestFullscreen");
    const fullscreenExit = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
    const fullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    try {
      Object.defineProperty(controls.stage, "requestFullscreen", { configurable: true, value: () => { throw new Error("Fullscreen unavailable"); } });
      Object.defineProperty(document, "exitFullscreen", { configurable: true, value: () => { throw new Error("Fullscreen exit unavailable"); } });
      Object.defineProperty(document, "fullscreenElement", { configurable: true, value: controls.stage });
      requestFullscreen(); exitFullscreen();
      assert(state.running && frames.size === 1, "synchronous fullscreen failures do not interrupt playback");
    } finally {
      if (fullscreenRequest) Object.defineProperty(controls.stage, "requestFullscreen", fullscreenRequest); else delete controls.stage.requestFullscreen;
      if (fullscreenExit) Object.defineProperty(document, "exitFullscreen", fullscreenExit); else delete document.exitFullscreen;
      if (fullscreenElement) Object.defineProperty(document, "fullscreenElement", fullscreenElement); else delete document.fullscreenElement;
    }
    const lastGoodFrame = state.currentFrame, origin = state.startedAt, lastBpm = controls.bpm.value;
    testNow += 1600; checkMidiClockHealth(testNow);
    assert(state.running && !state.paused && state.startedAt === origin && state.currentFrame === lastGoodFrame && controls.bpm.value === lastBpm, "clock loss keeps the last BPM and active picture without resetting or pausing transport");
    assert(controls.midiReadout.textContent.includes("clock lost") && controls.midiReadout.textContent.includes("free-running"), "lost-clock status explains the fallback");
    for (let pulse = 0; pulse < 24; pulse++) { testNow += 60000 / 180 / 24; handleMidiClock(testNow); }
    assert(controls.bpm.value === "180" && controls.midiReadout.textContent.includes("clock locked"), "clock recovery reacquires tempo without reusing the long outage interval");
    access.inputs.delete(port.id); access.onstatechange();
    assert(!port.onmidimessage && !midiSession.input && state.running && controls.midiInput.value === port.id && controls.midiReadout.textContent.includes("input disconnected"), "device removal detaches the removed port and continues playback while preserving selection");
    const replacement = { ...port, onmidimessage: null }; access.inputs.set(port.id, replacement); access.onstatechange();
    assert(midiSession.input === replacement && typeof replacement.onmidimessage === "function" && permissionCalls === 1, "returning hardware reattaches within existing permission");
    controls.midiInput.value = ""; attachMidiInput(); access.onstatechange();
    await connectMidi();
    assert(controls.midiInput.value === "" && !replacement.onmidimessage && !midiSession.input, "an explicit No MIDI input choice survives device events and repeated connect actions");

    restartPlayback(); assert(frames.size === 1, "restart replaces the scheduled frame");
    const staleCallback = frames.values().next().value;
    restartPlayback(); const activeId = state.raf;
    staleCallback(testNow + 17);
    assert(frames.size === 1 && state.raf === activeId, "a cancelled callback cannot create another RAF chain after restart");
    const beatBeforePause = (testNow - state.startedAt) / (60000 / state.options.bpm);
    state.intervalDueAt = testNow + 6000;
    togglePause(); const dueBeforeResume = state.intervalDueAt;
    nudgeBpm(5, testNow);
    assert(frames.size === 0 && state.paused, "pausing cancels animation while permitting a frozen-position tempo edit");
    testNow += 5000; togglePause();
    const beatAfterResume = (testNow - state.startedAt) / (60000 / state.options.bpm);
    assert(Math.abs(beatBeforePause - beatAfterResume) < 1e-8 && state.intervalDueAt === dueBeforeResume + 5000 && frames.size === 1, "resume preserves beat position and remaining scene interval without duplicate frames");

    setPlaybackTempo(120, testNow, false);
    state.startedAt = testNow - 4000;
    state.intervalDueAt = testNow + 6000;
    const sceneBankBeforeContinue = state.scenes;
    state.scenes = Array(sceneSlotCount).fill(null);
    state.scenes[state.selectedSceneSlot - 1] = { ...getPreset(), seed: "saved-scene-must-not-replace-stopped-look" };
    intervalMode.checked = true;
    const stoppedSeed = controls.seed.value;
    handleMidiMessage({ data: [0xFC], receivedTime: testNow });
    assert(!state.running && midiSession.stoppedTransport?.elapsedBeats === 8, "MIDI Stop saves the musical position before returning to setup");
    testNow += 1000; handleMidiMessage({ data: [0xFC], receivedTime: testNow });
    testNow += 1000; handleMidiMessage({ data: [0xFB], receivedTime: testNow });
    assert(state.running && Math.abs(testNow - state.startedAt - 4000) < 1e-8 && Math.abs(state.currentFrame.elapsed - 4000) < 1e-8
      && state.intervalDueAt - testNow === 6000 && controls.seed.value === stoppedSeed && frames.size === 1,
      "MIDI Continue resumes the saved beat and remaining interval on its first frame without recalling a stored scene");
    state.scenes = sceneBankBeforeContinue; intervalMode.checked = false;
    testNow += 1000; handleMidiMessage({ data: [0xFA], receivedTime: testNow });
    assert(state.running && state.startedAt === testNow && !midiSession.stoppedTransport, "MIDI Start still restarts from the beginning after Continue");
    testNow += 4000; handleMidiMessage({ data: [0xFC], receivedTime: testNow });
    stop();
    assert(!midiSession.stoppedTransport, "a manual stop clears the saved MIDI position even when playback already stopped");
    testNow += 1000; handleMidiMessage({ data: [0xFB], receivedTime: testNow });
    assert(state.startedAt === testNow && state.currentFrame.elapsed === 0, "Continue after a manual stop starts fresh");

    const visibleBeforeFailure = { frame: state.currentFrame, canvasHidden: controls.canvas.hidden, textHidden: controls.ascii.hidden, text: controls.ascii.textContent };
    getFrameInterval = () => { throw new Error("<img src=x onerror=alert(1)> frame scheduling failed"); };
    runFrame();
    assert(!state.running && frames.size === 0 && state.currentFrame === visibleBeforeFailure.frame && controls.canvas.hidden === visibleBeforeFailure.canvasHidden
      && controls.ascii.hidden === visibleBeforeFailure.textHidden && controls.ascii.textContent === visibleBeforeFailure.text, "a scheduling error freezes the last good picture and stops the frame chain");
    assert(!el("renderRecovery").hidden && el("renderErrorMessage").textContent.includes("<img") && !el("renderErrorMessage").querySelector("img"), "recovery displays error details as text with visible retry controls");
    getFrameInterval = originalInterval;
    start();
    assert(state.running && el("renderRecovery").hidden && frames.size === 1, "retry starts one frame chain and dismisses recovery after a successful draw");
    prepareStateFromControls = () => { throw new Error("Restart preparation failed"); };
    restartPlayback();
    assert(!state.running && !el("renderRecovery").hidden && frames.size === 0, "restart preparation errors enter the same recoverable state");
    prepareStateFromControls = originalPrepare;
    start(); stop(); quiet();
    assert(!state.running && state.raf === 0 && frames.size === 0 && controls.stage.hidden && !controls.menu.hidden, "stop releases the frame chain and returns to setup");

    disconnectMidi();
    const cancelledConnect = connectMidi(); await Promise.resolve();
    controls.midiSync.checked = false; controls.midiSync.dispatchEvent(new Event("change", { bubbles: true }));
    resolvePermission(access); await cancelledConnect; quiet();
    assert(!state.midiAccess && !controls.midiSync.checked && !controls.connectMidi.disabled, "turning sync off cancels an unresolved permission request without reconnecting later");
    Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: () => { permissionCalls++; throw new Error("Permission denied"); } });
    await connectMidi(); const deniedCalls = permissionCalls; await connectMidi();
    assert(permissionCalls === deniedCalls + 1 && !midiSession.request && !controls.connectMidi.disabled, "synchronous permission failures clear pending state and remain retryable");
  } catch (error) {
    failure = error;
  } finally {
    captureHistorySnapshot = originalSnapshot; Storage.prototype.setItem = originalSetItem;
    getFrameInterval = originalInterval; prepareStateFromControls = originalPrepare;
    stop(); quiet(); disconnectMidi();
    window.requestAnimationFrame = originalRaf; window.cancelAnimationFrame = originalCancel;
    if (originalNow) Object.defineProperty(performance, "now", originalNow); else delete performance.now;
    if (originalRequest) Object.defineProperty(navigator, "requestMIDIAccess", originalRequest); else delete navigator.requestMIDIAccess;
  }
  document.body.textContent = failure ? `FAIL: ${failure.stack}` : "PASS: MIDI permissions, scene/history watchdog reconciliation, Stop/Continue position and intervals, zero-storage clock updates, manual history, invalid clocks, loss/recovery, hotplug selection, single RAF, paused intervals, and renderer recovery";
})();
