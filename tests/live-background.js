(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const el = id => document.getElementById(id);
  const quiet = () => {
    stopPreviewLoop();
    clearTimeout(state.previewTimer);
    if (typeof cancelPlaybackFrame === "function") cancelPlaybackFrame();
    else cancelAnimationFrame(state.raf);
  };
  const stringify = JSON.stringify;
  const setItem = Storage.prototype.setItem;
  const encodePng = HTMLCanvasElement.prototype.toDataURL;
  const normalize = normalizePreset;
  const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  const counts = { bankJson: 0, json: 0, png: 0, bankNormalizations: 0, writes: [] };
  let sceneSources = new Set();
  const resetCounts = () => { counts.bankJson = 0; counts.json = 0; counts.png = 0; counts.bankNormalizations = 0; counts.writes = []; };
  const restoreHidden = () => {
    if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
    else delete document.hidden;
  };
  try {
    quiet();
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    if (el("keepAwake")) el("keepAwake").checked = false;
    const base = { ...getPreset(), visualizerMode: "atari", atariInput: "demo", lyrics: "LIVE ".repeat(12000),
      maskArt: "#".repeat(60000), maskMode: "off", seed: "live-base", bpm: "120", fullscreenOnStart: false,
      livePreview: false, transitionMode: "cut", quality: "low", scanlines: false, recordingMode: false };
    applyPreset(base);
    quiet();
    state.scenes = Array.from({ length: sceneSlotCount }, (_, index) => ({ ...getPreset(), seed: `large-slot-${index + 1}`, sceneName: `Set ${index + 1}` }));
    state.selectedSceneSlot = 1;
    const bankChars = stringify(state.scenes).length;
    assert(bankChars > 900000, "fixture contains a scene bank larger than 900 KB");
    saveSceneSlots();
    el("lockTempo").checked = true;
    saveSetup();
    resetHistoryBaseline();
    const sharedBank = editHistory.entries[0].snapshot.scenes;
    state.scenes = state.scenes.map(scene => ({ ...scene }));
    historyCheckpoint();
    assert(editHistory.entries.length === 1 && captureHistoryBank() === sharedBank, "equal replacement scene objects reuse the bank snapshot without a redundant Undo step");
    sceneSources = new Set(state.scenes);

    JSON.stringify = function (value, ...args) {
      counts.json++;
      if (value === state.scenes || value && !Array.isArray(value) && Array.isArray(value.scenes)) counts.bankJson++;
      return stringify.call(this, value, ...args);
    };
    Storage.prototype.setItem = function (key, value) { counts.writes.push(key); return setItem.call(this, key, value); };
    HTMLCanvasElement.prototype.toDataURL = function (...args) { counts.png++; return encodePng.apply(this, args); };
    normalizePreset = function (value) { if (sceneSources.has(value)) counts.bankNormalizations++; return normalize(value); };
    start();
    quiet();
    assert(state.running, "stage starts for sustained playback checks");
    resetCounts();
    for (let index = 0; index < 120; index++) nudgeBpm(index % 2 ? -1 : 1);
    assert(counts.bankNormalizations === 0 && counts.json === 0, "120 tempo edits neither renormalize unchanged scenes nor serialize the bank or draft");
    assert(editHistory.entries.length === editHistory.maxEntries && editHistory.entries.every(entry => entry.snapshot.scenes === sharedBank && !("json" in entry)), "40 immediate Undo steps share one bank without duplicate bank JSON");
    assert(editHistory.chars <= editHistory.maxChars, "history payload remains within its configured memory budget");
    undoEdit(); quiet();
    assert(controls.bpm.value === "121", "live tempo Undo is immediate before any deferred storage write");
    redoEdit(); quiet();
    assert(controls.bpm.value === "120", "live tempo Redo remains immediate");
    assert(counts.writes.length === 0, "tempo Undo and Redo do not rewrite an unchanged saved bank");

    for (let index = 0; index < 48; index++) {
      recallScene(index % sceneSlotCount + 1);
      quiet();
      scheduleGalleryRefresh();
      refreshPresetGallery();
      refreshSceneGallery();
    }
    assert(renderGalleryThumbnail(getNamedPreset("atariVideoMusic", galleryBasePreset)) === null, "direct thumbnail requests are suspended on stage");
    await wait(180);
    assert(counts.bankJson === 0 && counts.writes.length === 0 && counts.png === 0, "120 tempo edits and 48 scene recalls cause zero bank serializations, storage writes, or thumbnail encodes during playback");
    assert(galleryRefreshTimer === 0 && galleryThumbnailTask === 0, "live gallery changes leave no refresh or idle-render task running");

    controls.transitionMode.value = "beat";
    controls.transitionMode.dispatchEvent(new Event("change", { bubbles: true }));
    recallScene(2);
    quiet();
    assert(state.pendingPreset, "beat transition queues a scene during playback");
    undoEdit();
    assert(!state.pendingPreset && editHistory.cancelledPreset, "Undo immediately cancels a queued scene without committing it");
    redoEdit();
    assert(state.pendingPreset, "Redo reschedules the cancelled scene");
    undoEdit();
    controls.transitionMode.value = "cut";
    controls.transitionMode.dispatchEvent(new Event("change", { bubbles: true }));
    quiet();
    assert(counts.writes.length === 0, "queue cancellation and redo cause no storage churn");

    const previousStoredSeed = state.scenes[3].seed;
    controls.seed.value = "explicit-live-store";
    storeScene(4);
    quiet();
    assert(JSON.parse(localStorage.getItem("asciiBpmScenes"))[3].seed === "explicit-live-store", "explicit Store scene remains immediately durable while on stage");
    undoEdit(); quiet();
    assert(state.scenes[3].seed === previousStoredSeed && JSON.parse(localStorage.getItem("asciiBpmScenes"))[3].seed === previousStoredSeed, "Undo of an explicit bank change immediately persists the restored bank");
    assert(counts.writes.filter(key => key === "asciiBpmScenes").length === 2
      && counts.writes.every(key => key === "asciiBpmScenes"), "only the two explicit bank changes write during playback");

    resetCounts();
    const finalBpm = controls.bpm.value, finalSlot = state.selectedSceneSlot;
    stop(); quiet();
    assert(counts.writes.filter(key => key === "asciiBpmSetup").length === 1
      && counts.writes.filter(key => key === editHistory.draftKey).length === 1, "leaving playback coalesces all deferred setup and draft changes into one write each");
    const setup = JSON.parse(localStorage.getItem("asciiBpmSetup"));
    assert(setup.selectedSlot === finalSlot && setup.lockedValues.bpm === finalBpm, "deferred setup contains the final slot and locked tempo");

    // Hidden tabs suppress both queued and direct gallery work, and resume
    // without losing changes when the user returns to setup.
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    resetCounts();
    applyPreset({ ...getPreset(), seed: "hidden-last-edit" });
    saveSetup();
    quiet();
    scheduleGalleryRefresh();
    assert(renderGalleryThumbnail(getNamedPreset("cleanTitles", galleryBasePreset)) === null, "direct thumbnail requests are also suspended in a hidden document");
    await wait(120);
    assert(counts.writes.length === 0 && counts.png === 0, "hidden editing defers draft/setup writes and gallery PNG work");
    restoreHidden();
    document.dispatchEvent(new Event("visibilitychange"));
    assert(counts.writes.filter(key => key === "asciiBpmSetup").length === 1
      && counts.writes.filter(key => key === editHistory.draftKey).length === 1, "returning to visible setup flushes the final deferred values once");
    await wait(1200);
    assert(counts.png > 0, "returning to setup resumes unfinished gallery thumbnails");
    assert(galleryThumbnailChars <= galleryThumbnailCharLimit && galleryThumbnailCache.size <= galleryThumbnailLimit, "thumbnail cache obeys both total-size and entry limits");
    start(); quiet();
    resetCounts();
    nudgeBpm(1);
    assert(counts.writes.length === 0, "a final on-stage edit remains deferred until the page lifecycle changes");
    window.dispatchEvent(new Event("pagehide"));
    assert(counts.writes.filter(key => key === "asciiBpmSetup").length === 1
      && counts.writes.filter(key => key === editHistory.draftKey).length === 1
      && JSON.parse(localStorage.getItem(editHistory.draftKey)).preset.bpm === controls.bpm.value, "page exit saves the final deferred look even while the stage is running");
    stop(); quiet();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    quiet();
    document.body.innerHTML = "<p>PASS: 900 KB bank, 120 tempo edits + 48 scene recalls with zero live bank JSON/storage/thumbnail work, 40 shared-bank Undo steps, immediate bank durability, queued Undo, deferred persistence, and hidden/setup gallery lifecycle</p>";
  } catch (error) {
    quiet();
    document.body.textContent = `FAIL: ${error.stack}`;
  } finally {
    JSON.stringify = stringify;
    Storage.prototype.setItem = setItem;
    HTMLCanvasElement.prototype.toDataURL = encodePng;
    normalizePreset = normalize;
    restoreHidden();
  }
})();
