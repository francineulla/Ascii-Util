(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const input = (control, value, type = "input") => {
    if (control.type === "checkbox") control.checked = value;
    else control.value = value;
    control.dispatchEvent(new Event(type, { bubbles: true }));
  };
  const press = (target, key, extra = {}) => {
    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true, ...extra });
    target.dispatchEvent(event);
    return event;
  };
  const quiet = () => { stopPreviewLoop(); clearTimeout(state.previewTimer); cancelAnimationFrame(state.raf); };
  try {
    quiet();
    if (sessionStorage.getItem("historyReload")) {
      assert(controls.lyrics.value === "RECOVER UNSAVED WORDS", "unsaved lyrics recover after reload");
      assert(controls.seed.value === "draft-not-in-a-slot", "unsaved look wins over the selected stored scene");
      assert(state.scenes[0].seed === "persisted-bank", "draft recovery preserves the stored bank");
      assert(document.getElementById("audioAttack").value === "73", "draft restores local setup controls");
      assert(!audioState.stream && !state.midiAccess, "reload never reconnects audio or MIDI");
      assert(editHistory.index === 0 && editHistory.entries.length === 1, "recovered draft is the initial history baseline");
      assert(document.getElementById("draftReadout").textContent.includes("Recovered"), "recovery status is visible");

      // A URL intentionally overrides a recovered draft, without permission calls.
      const originalHash = location.hash;
      history.replaceState(null, "", "#preset=" + encodePresetForUrl({ ...getPreset(), seed: "url-wins", lyrics: "SHARED WORDS" }));
      loadPresetFromUrl();
      assert(controls.seed.value === "url-wins" && controls.lyrics.value === "SHARED WORDS", "URL preset overrides recovered draft");
      history.replaceState(null, "", location.pathname + location.search + originalHash);
      resetHistoryBaseline();
      quiet();
      document.body.innerHTML = "<p>PASS: coalesced Undo/Redo, MIDI-independent manual history, atomic queued scenes, paused beat/countdown preservation, native text shortcuts, persisted bank, draft validation, storage errors, and reload recovery</p>";
      return;
    }

    for (const id of Object.keys(lockGroups)) document.getElementById(id).checked = false;
    intervalMode.checked = false;
    applyPreset({ ...getPreset(), visualizerMode: "ascii", lyrics: "ORIGINAL WORDS", seed: "history-start", livePreview: false, fullscreenOnStart: false, quality: "low", glyphSize: "24", transitionMode: "cut" });
    state.scenes = Array(sceneSlotCount).fill(null);
    state.selectedSceneSlot = 1;
    resetHistoryBaseline();
    input(controls.lyrics, "ONE");
    input(controls.lyrics, "ONE TWO");
    input(controls.lyrics, "ONE TWO THREE");
    flushHistoryEdit();
    assert(editHistory.entries.length === 2, "typing coalesces into one edit");
    undoEdit();
    assert(controls.lyrics.value === "ORIGINAL WORDS", "undo restores typed lyrics");
    redoEdit();
    assert(controls.lyrics.value === "ONE TWO THREE", "redo restores the complete coalesced edit");
    const textShortcut = press(controls.lyrics, "z");
    assert(!textShortcut.defaultPrevented, "text fields retain native undo");
    const globalShortcut = press(document.body, "z");
    assert(globalShortcut.defaultPrevented && controls.lyrics.value === "ORIGINAL WORDS", "global Ctrl+Z undoes an edit");
    press(document.body, "z", { shiftKey: true });
    assert(controls.lyrics.value === "ONE TWO THREE", "global Shift+Ctrl+Z redoes");

    const beforeShuffle = JSON.stringify(getPreset());
    controls.randomizeAll.click();
    assert(JSON.stringify(getPreset()) !== beforeShuffle, "randomize creates a new look");
    undoEdit();
    assert(JSON.stringify(getPreset()) === beforeShuffle, "one undo restores a randomized look");
    input(controls.bpm, "137", "change");
    assert(document.getElementById("redoEdit").disabled, "a new edit discards redo");
    const previousDensity = controls.density.value;
    input(controls.density, "30");
    input(controls.density, "45");
    input(controls.density, "55", "change");
    undoEdit();
    assert(controls.density.value === previousDensity, "slider dragging coalesces into one undo step");
    input(controls.toolMode, "video", "change");
    assert(isNativeVideoMode(controls.visualizerMode.value), "tool family selector changes the render mode");
    undoEdit();
    assert(controls.toolMode.value === "text" && controls.visualizerMode.value === "ascii", "undo restores both render mode and family selector");

    input(controls.seed, "persisted-bank", "change");
    storeScene();
    state.scenes[1] = { ...getPreset(), seed: "second-slot" };
    saveSceneSlots();
    resetHistoryBaseline();
    const secondSlot = controls.sceneSlots.querySelector('[data-slot="2"]');
    secondSlot.click();
    assert(state.selectedSceneSlot === 2 && controls.seed.value === "second-slot", "UI scene click recalls the selected look");
    assert(editHistory.entries.length === 2, "UI scene selection and recall make one undo step");
    undoEdit();
    assert(state.selectedSceneSlot === 1 && controls.seed.value === "persisted-bank", "one undo restores both prior scene selection and look");
    redoEdit();
    assert(state.selectedSceneSlot === 2 && controls.seed.value === "second-slot", "one redo restores both clicked selection and look");
    undoEdit();
    secondSlot.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    assert(state.selectedSceneSlot === 2 && state.scenes[1].seed === "persisted-bank", "shift-click stores the current look in the clicked slot");
    undoEdit();
    assert(state.selectedSceneSlot === 1 && state.scenes[1].seed === "second-slot", "one undo restores selection and overwritten slot after shift-click");
    clearScenes();
    assert(!state.scenes.some(Boolean), "clear removes the scene bank");
    undoEdit();
    assert(state.scenes[0].seed === "persisted-bank", "undo restores the cleared bank");
    assert(JSON.parse(localStorage.getItem("asciiBpmScenes"))[0].seed === "persisted-bank", "undo persists the restored bank");
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene-bank", selectedSlot: 3, scenes: [null, null, { ...getPreset(), seed: "imported-three" }] });
    loadSceneBank();
    assert(state.selectedSceneSlot === 3 && state.scenes[2].seed === "imported-three", "bank import replaces the bank");
    undoEdit();
    assert(state.selectedSceneSlot === 1 && state.scenes[0].seed === "persisted-bank" && !state.scenes[2], "one undo restores bank and selection before import");
    redoEdit();
    assert(state.selectedSceneSlot === 3 && controls.seed.value === "imported-three", "redo restores imported settings and selection");
    undoEdit();

    const previousStream = audioState.stream;
    const previousConnectedSource = audioSetupState.connectedSource;
    const connectedStream = { getTracks: () => [] };
    audioState.stream = connectedStream;
    audioSetupState.connectedSource = "microphone";
    try {
      input(document.getElementById("audioSource"), "screen", "change");
      undoEdit();
      assert(document.getElementById("audioSource").value === "microphone", "undo restores audio source preference");
      assert(audioState.stream === connectedStream, "undo preserves the explicitly connected stream");
      redoEdit();
      assert(document.getElementById("audioDeviceHelp").textContent.includes("Selection changed"), "redo updates source reconnect guidance");
      assert(audioState.stream === connectedStream, "redo never reconnects an input");
      undoEdit();
    } finally {
      audioState.stream = previousStream;
      audioSetupState.connectedSource = previousConnectedSource;
      updateAudioDeviceControls();
    }

    resetHistoryBaseline();
    const seedBeforeClock = controls.seed.value;
    input(controls.seed, "manual-before-clock", "change");
    setPlaybackTempo(125, performance.now(), false);
    undoEdit();
    assert(controls.seed.value === seedBeforeClock && controls.bpm.value === "125", "Undo skips external clock changes and restores the last manual edit");
    redoEdit();
    assert(controls.seed.value === "manual-before-clock" && controls.bpm.value === "125", "Redo preserves the latest external tempo");
    nudgeBpm(1);
    undoEdit();
    assert(controls.bpm.value === "125", "manual tempo edits remain undoable after external clock updates");
    undoEdit();
    setPlaybackTempo(130, performance.now(), false);
    redoEdit();
    assert(controls.seed.value === "manual-before-clock" && controls.bpm.value === "130", "external tempo rebases the redo branch without consuming it");
    resetHistoryBaseline();
    nudgeBpm(1);
    setPlaybackTempo(135, performance.now(), false);
    assert(undoEdit() && controls.bpm.value === "130", "a clock update preserves an explicit manual tempo Undo step");
    setPlaybackTempo(140, performance.now(), false);
    assert(redoEdit() && controls.bpm.value === "131", "new clock updates do not erase a manual tempo Redo step");
    resetHistoryBaseline();
    input(controls.bpm, "145");
    setPlaybackTempo(150, performance.now(), false);
    input(controls.bpm, "146");
    undoEdit();
    assert(controls.bpm.value === "131", "a clock update during coalesced manual BPM input preserves its Undo value");
    redoEdit();
    assert(controls.bpm.value === "146", "coalesced manual BPM input retains its final Redo value after interleaved clock updates");

    start();
    quiet();
    controls.transitionMode.value = "cut";
    recallScene(1);
    quiet();
    input(controls.transitionMode, "beat", "change");
    resetHistoryBaseline();
    const sceneOneSeed = controls.seed.value;
    secondSlot.click();
    assert(state.pendingPreset?.slot === 2 && state.selectedSceneSlot === 1 && editHistory.entries.length === 1, "queueing a scene leaves the current slot and history unchanged");
    undoEdit();
    assert(!state.pendingPreset && state.selectedSceneSlot === 1, "cancelling a queued scene preserves the actual selected slot");
    redoEdit();
    assert(state.pendingPreset?.slot === 2 && state.selectedSceneSlot === 1, "redo restores the queued target without selecting it early");
    maybeApplyQueuedPreset({ beatIndex: state.pendingPreset.targetBeat });
    quiet();
    assert(state.selectedSceneSlot === 2 && controls.seed.value === "second-slot" && editHistory.entries.length === 2, "a completed queued recall commits its look and slot in one history entry");
    undoEdit(); quiet();
    assert(state.selectedSceneSlot === 1 && controls.seed.value === sceneOneSeed, "one Undo of a completed transition restores the prior scene and slot");
    redoEdit(); quiet();
    assert(state.selectedSceneSlot === 2 && controls.seed.value === "second-slot", "one Redo restores the completed transition and slot");
    undoEdit(); quiet();
    recallScene(2);
    undoEdit();
    intervalMode.checked = true;
    state.intervalDueAt = performance.now() - 1;
    advanceSceneInterval(performance.now());
    assert(state.pendingPreset?.slot === 2, "interval playback still visits the cancelled scene instead of skipping it");
    undoEdit();
    intervalMode.checked = false;
    input(controls.transitionMode, "beat", "change");
    applyNamedPreset("cleanTitles");
    assert(state.pendingPreset && !document.getElementById("undoEdit").disabled, "queued look can be undone before applying");
    undoEdit();
    assert(!state.pendingPreset && !document.getElementById("redoEdit").disabled, "undo cancels the queued look and enables redo");
    redoEdit();
    assert(state.pendingPreset?.label === "cleanTitles", "redo queues the cancelled look at the next current beat");
    undoEdit();
    input(controls.transitionMode, "cut", "change");
    togglePause();
    applyNamedPreset("cleanTitles");
    const pausedAt = state.pausedAt, startedAt = state.startedAt;
    undoEdit();
    assert(state.running && state.paused, "undo keeps paused playback frozen");
    assert(state.pausedAt === pausedAt && state.startedAt === startedAt, "undo preserves the frozen timeline position");
    const originalNow = performance.now;
    let testNow = originalNow.call(performance);
    performance.now = () => testNow;
    try {
      state.pausedAt = testNow;
      intervalMode.checked = true;
      intervalMinutes.value = "1";
      state.intervalDueAt = testNow + 58000;
      resetHistoryBaseline();
      nudgeBpm(1);
      const frozenBeat = (state.pausedAt - state.startedAt) * state.options.bpm / 60000;
      testNow += 300000;
      undoEdit(); quiet();
      assert(state.intervalDueAt === state.pausedAt + 58000, "paused Undo preserves the frozen scene countdown after a long wait");
      assert(Math.abs((state.pausedAt - state.startedAt) * state.options.bpm / 60000 - frozenBeat) < 1e-8,
        "paused tempo Undo preserves the frozen musical position");
      togglePause(); quiet();
      assert(state.intervalDueAt - testNow === 58000, "Resume after Undo retains 58 seconds rather than adding the pause twice");
      togglePause();
      input(intervalMinutes, "2", "change");
      testNow += 60000;
      undoEdit(); quiet();
      togglePause(); quiet();
      assert(intervalMinutes.value === "1" && state.intervalDueAt - testNow === 60000, "Undo of interval settings anchors the restored duration to the frozen timeline");
    } finally { performance.now = originalNow; }
    stop();
    intervalMode.checked = false;
    quiet();

    localStorage.setItem(editHistory.draftKey, JSON.stringify({ type: "ascii-bpm-draft", version: 999, preset: { seed: "bad-draft" } }));
    const seedBeforeInvalidDraft = controls.seed.value;
    assert(!restoreDraft() && controls.seed.value === seedBeforeInvalidDraft, "invalid draft is rejected without replacing current controls");
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("storage unavailable"); };
    try {
      assert(!saveDraftNow(), "draft write reports failure");
      assert(document.getElementById("draftReadout").textContent.includes("could not"), "draft storage failure is visible");
    } finally { Storage.prototype.setItem = originalSetItem; }

    // Recover the unsaved current look without overwriting the explicit scene.
    applyPreset({ ...getPreset(), seed: "draft-not-in-a-slot", lyrics: "RECOVER UNSAVED WORDS", midiSync: true, livePreview: false });
    input(document.getElementById("audioAttack"), "73");
    await wait(350);
    assert(saveDraftNow(), "draft writes successfully");
    sessionStorage.setItem("historyReload", "1");
    location.reload();
  } catch (error) {
    quiet();
    document.body.innerHTML = "";
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
