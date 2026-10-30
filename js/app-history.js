"use strict";

// In-session edit history and a small recoverable local draft. Device connections
// and transport state are deliberately outside both serialized formats.
const editHistory = {
  ready: false, restoring: false, installed: false, actionsInstalled: false, depth: 0,
  entries: [], index: -1, pending: null, cancelledPreset: null, editTimer: 0, draftTimer: 0,
  maxEntries: 40, maxChars: 8000000, chars: 0, draftKey: "asciiBpmDraft",
  sceneCache: new WeakMap(), sizeCache: new WeakMap(), bankSnapshot: [],
  draftDirty: false, setupDirty: false, writeSetup: null, externalTempo: null
};

function historySetup() {
  return {
    selectedSlot: state.selectedSceneSlot,
    intervalMode: intervalMode.checked,
    intervalMinutes: intervalMinutes.value,
    lastVideoMode,
    controls: Object.fromEntries(setupControls.map(id => {
      const control = document.getElementById(id);
      return [id, control.type === "checkbox" ? control.checked : control.value];
    }))
  };
}

function historyFlatValuesEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
}

function historySceneSnapshot(scene, previous) {
  if (!scene) return null;
  const cached = editHistory.sceneCache.get(scene);
  if (cached && presetFields.every(id => cached.raw[id] === scene[id])) {
    if (previous && cached.snapshot !== previous && historyFlatValuesEqual(cached.snapshot, previous)) cached.snapshot = previous;
    return cached.snapshot;
  }
  const normalized = normalizePreset(scene);
  const snapshot = previous && historyFlatValuesEqual(normalized, previous) ? previous : normalized;
  const raw = Object.fromEntries(presetFields.map(id => [id, scene[id]]));
  editHistory.sceneCache.set(scene, { raw, snapshot });
  return snapshot;
}

function captureHistoryBank() {
  const scenes = Array.from({ length: sceneSlotCount }, (_, index) => historySceneSnapshot(state.scenes[index], editHistory.bankSnapshot[index]));
  if (scenes.every((scene, index) => scene === editHistory.bankSnapshot[index])) return editHistory.bankSnapshot;
  editHistory.bankSnapshot = scenes;
  return scenes;
}

function captureHistorySnapshot() {
  return {
    preset: normalizePreset(getPreset()),
    scenes: captureHistoryBank(),
    setup: historySetup()
  };
}

function historySnapshotsEqual(left, right) {
  return Boolean(left && right && historyFlatValuesEqual(left.preset, right.preset)
    && left.scenes.length === right.scenes.length && left.scenes.every((scene, index) => scene === right.scenes[index])
    && left.setup.selectedSlot === right.setup.selectedSlot && left.setup.intervalMode === right.setup.intervalMode
    && left.setup.intervalMinutes === right.setup.intervalMinutes && left.setup.lastVideoMode === right.setup.lastVideoMode
    && historyFlatValuesEqual(left.setup.controls, right.setup.controls));
}

function historyFlatChars(value) {
  if (editHistory.sizeCache.has(value)) return editHistory.sizeCache.get(value);
  const chars = Object.entries(value).reduce((total, [key, item]) => total + key.length + (typeof item === "string" ? item.length : 16) + 8, 32);
  editHistory.sizeCache.set(value, chars);
  return chars;
}

function historyMemoryChars() {
  // Shared scene objects are counted once; no entry retains a second full JSON
  // copy of the bank. Both the entry count and unique payload remain bounded.
  const seen = new Set();
  let chars = editHistory.entries.length * 128;
  for (const { snapshot } of editHistory.entries) {
    for (const value of [snapshot.preset, snapshot.setup.controls, ...snapshot.scenes.filter(Boolean)]) {
      if (seen.has(value)) continue;
      seen.add(value);
      chars += historyFlatChars(value);
    }
  }
  return chars;
}

function applyHistorySetup(setup) {
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return;
  state.selectedSceneSlot = clamp(Math.trunc(Number(setup.selectedSlot)) || 1, 1, sceneSlotCount);
  intervalMode.checked = setup.intervalMode === true;
  intervalMinutes.value = String(clamp(Number(setup.intervalMinutes) || 1, 0.1, 1440));
  if (isNativeVideoMode(setup.lastVideoMode)) lastVideoMode = setup.lastVideoMode;
  for (const id of setupControls) {
    const control = document.getElementById(id);
    const value = setup.controls?.[id];
    if (value === undefined) continue;
    if (control.type === "checkbox") control.checked = value === true;
    else if (control.tagName === "SELECT") {
      if (controlHasOption(control, String(value))) control.value = String(value);
    } else if (Number.isFinite(Number(value))) {
      control.value = String(clamp(Number(value), Number(control.min), Number(control.max)));
    }
  }
  if (typeof updateAudioDeviceControls === "function") updateAudioDeviceControls();
}

function updateHistoryControls(message = "") {
  const undo = document.getElementById("undoEdit");
  const redo = document.getElementById("redoEdit");
  if (undo) {
    undo.disabled = editHistory.index <= 0 && !editHistory.pending && !state.pendingPreset;
    undo.title = state.pendingPreset ? `Cancel queued ${state.pendingPreset.label}` : editHistory.pending ? `Undo ${editHistory.pending.label}` : editHistory.index > 0 ? `Undo ${editHistory.entries[editHistory.index].label}` : "Undo the last edit";
  }
  if (redo) {
    redo.disabled = Boolean(editHistory.pending) || !editHistory.cancelledPreset && editHistory.index >= editHistory.entries.length - 1;
    redo.title = editHistory.cancelledPreset ? `Redo queued ${editHistory.cancelledPreset.label}` : !redo.disabled ? `Redo ${editHistory.entries[editHistory.index + 1].label}` : "Redo the last undone edit";
  }
  const output = document.getElementById("historyReadout");
  if (output) output.textContent = message || (editHistory.index > 0 ? `Last edit: ${editHistory.entries[editHistory.index].label}` : "Edit history ready");
}

function appendHistory(snapshot, label, tempoChange = null) {
  if (!tempoChange && historySnapshotsEqual(editHistory.entries[editHistory.index]?.snapshot, snapshot)) return false;
  const previousTempo = editHistory.entries[editHistory.index]?.snapshot.preset.bpm;
  if (!tempoChange && previousTempo !== undefined && previousTempo !== snapshot.preset.bpm) {
    tempoChange = { before: previousTempo, after: snapshot.preset.bpm };
  }
  editHistory.entries.splice(editHistory.index + 1);
  editHistory.entries.push({ snapshot, label, tempoChange });
  editHistory.chars = historyMemoryChars();
  while (editHistory.entries.length > 1 && (editHistory.entries.length > editHistory.maxEntries || editHistory.chars > editHistory.maxChars)) {
    editHistory.entries.shift();
    editHistory.chars = historyMemoryChars();
  }
  editHistory.index = editHistory.entries.length - 1;
  return true;
}

function rebaseHistoryTempo() {
  if (editHistory.externalTempo === null) return;
  const bpm = editHistory.externalTempo;
  editHistory.externalTempo = null;
  // An external clock owns the current tempo. Fold its latest value into the
  // existing history only at a user edit boundary, never on incoming pulses.
  const snapshots = new Set(editHistory.entries.map(entry => entry.snapshot));
  if (editHistory.pending) snapshots.add(editHistory.pending.snapshot);
  for (const snapshot of snapshots) snapshot.preset = { ...snapshot.preset, bpm };
  // Explicit tempo actions retain their before/after values separately, so a
  // later clock update cannot erase a manual tempo Undo or Redo step.
  editHistory.chars = historyMemoryChars();
  updateHistoryControls();
}

function flushHistoryEdit() {
  rebaseHistoryTempo();
  clearTimeout(editHistory.editTimer);
  if (!editHistory.pending) return;
  const pending = editHistory.pending;
  editHistory.pending = null;
  appendHistory(pending.snapshot, pending.label, pending.tempoChange);
  updateHistoryControls();
}

// External actions can use historyAction, or checkpoint before and commit after
// changing controls. Nested transactions form one step.
function historyCheckpoint(label = "Edit settings") {
  if (!editHistory.ready || editHistory.restoring || editHistory.depth) return;
  flushHistoryEdit();
  const changed = appendHistory(captureHistorySnapshot(), label);
  if (changed || state.pendingPreset) editHistory.cancelledPreset = null;
}

function historyCommit(label = "Edit settings") {
  if (!editHistory.ready || editHistory.restoring || editHistory.depth) return;
  clearTimeout(editHistory.editTimer);
  editHistory.pending = null;
  const changed = appendHistory(captureHistorySnapshot(), label);
  if (changed || state.pendingPreset) editHistory.cancelledPreset = null;
  updateHistoryControls();
  if (changed) scheduleDraftSave();
}

function historyAction(label, action) {
  if (!editHistory.ready || editHistory.restoring || editHistory.depth) return action();
  historyCheckpoint();
  editHistory.depth++;
  try {
    return action();
  } finally {
    editHistory.depth--;
    historyCommit(label);
  }
}

function queueHistoryEdit(control, commit = false) {
  if (!editHistory.ready || editHistory.restoring || editHistory.depth) return;
  rebaseHistoryTempo();
  editHistory.cancelledPreset = null;
  if (editHistory.pending && editHistory.pending.id !== control.id) flushHistoryEdit();
  const label = `Change ${control.closest("label")?.querySelector("span")?.childNodes[0]?.textContent?.trim() || control.id}`;
  const snapshot = captureHistorySnapshot();
  const previousTempo = editHistory.pending?.tempoChange?.before
    ?? editHistory.entries[editHistory.index]?.snapshot.preset.bpm;
  const tempoChange = previousTempo !== undefined && previousTempo !== snapshot.preset.bpm
    ? { before: previousTempo, after: snapshot.preset.bpm } : null;
  editHistory.pending = { id: control.id, label, snapshot, tempoChange };
  clearTimeout(editHistory.editTimer);
  if (commit) flushHistoryEdit();
  else editHistory.editTimer = setTimeout(flushHistoryEdit, 450);
  scheduleDraftSave();
  updateHistoryControls();
}

function restoreHistoryEntry(entry, message, bpm = entry.snapshot.preset.bpm) {
  editHistory.restoring = true;
  const pausedAt = state.pausedAt;
  const startedAt = state.startedAt;
  const previousBpm = state.options.bpm;
  const intervalDueAt = state.intervalDueAt;
  const intervalUnchanged = intervalMode.checked === entry.snapshot.setup.intervalMode
    && Number(intervalMinutes.value) === Number(entry.snapshot.setup.intervalMinutes);
  try {
    state.pendingPreset = null;
    editHistory.cancelledPreset = null;
    const bankChanged = captureHistoryBank() !== entry.snapshot.scenes;
    if (bankChanged) {
      state.scenes = entry.snapshot.scenes.map(scene => {
        if (!scene) return null;
        const copy = { ...scene };
        editHistory.sceneCache.set(copy, { raw: { ...copy }, snapshot: scene });
        return copy;
      });
      editHistory.bankSnapshot = entry.snapshot.scenes;
    }
    applyHistorySetup(entry.snapshot.setup);
    entry.snapshot.preset = { ...entry.snapshot.preset, bpm };
    applyPreset(entry.snapshot.preset);
    if (bankChanged) saveSceneSlots();
    saveSetup();
    refreshSceneButtons();
    updateSliderReadouts();
    if (state.running) {
      restartPlayback();
      if (state.paused) {
        state.pausedAt = pausedAt;
        state.startedAt = previousBpm === state.options.bpm ? startedAt
          : pausedAt - Math.max(0, pausedAt - startedAt) * previousBpm / state.options.bpm;
        // Keep an existing countdown frozen with the same timeline. If Undo
        // changes interval settings, start the new duration at the pause point.
        if (intervalUnchanged) state.intervalDueAt = intervalDueAt;
        else resetSceneInterval(pausedAt);
        const size = getCaptureSize();
        renderFrame(buildFrame(pausedAt, size.width, size.height, true));
      }
    } else schedulePreview();
  } finally {
    editHistory.restoring = false;
  }
  updateHistoryControls(message);
  scheduleDraftSave();
}

function undoEdit() {
  if (!editHistory.ready) return false;
  if (state.pendingPreset) {
    editHistory.cancelledPreset = { ...state.pendingPreset, preset: { ...state.pendingPreset.preset } };
    state.pendingPreset = null;
    updateHistoryControls("Cancelled queued scene");
    return true;
  }
  historyCheckpoint();
  if (editHistory.index <= 0) return false;
  const current = editHistory.entries[editHistory.index];
  const bpm = current.tempoChange ? current.tempoChange.before : controls.bpm.value;
  editHistory.index--;
  restoreHistoryEntry(editHistory.entries[editHistory.index], `Undid ${current.label}`, bpm);
  return true;
}

function redoEdit() {
  if (!editHistory.ready) return false;
  flushHistoryEdit();
  if (editHistory.cancelledPreset) {
    const queued = editHistory.cancelledPreset;
    editHistory.cancelledPreset = null;
    requestPresetChange(queued.preset, queued.label, queued.slot);
    updateHistoryControls(`Restored queued ${queued.label}`);
    return true;
  }
  if (editHistory.index >= editHistory.entries.length - 1) return false;
  editHistory.index++;
  const entry = editHistory.entries[editHistory.index];
  restoreHistoryEntry(entry, `Redid ${entry.label}`, entry.tempoChange ? entry.tempoChange.after : controls.bpm.value);
  return true;
}

function historyBackgroundBlocked() {
  return state.running || document.hidden;
}

function scheduleDraftSave() {
  editHistory.draftDirty = true;
  clearTimeout(editHistory.draftTimer);
  editHistory.draftTimer = 0;
  if (historyBackgroundBlocked()) return;
  editHistory.draftTimer = setTimeout(saveDraftNow, 250);
}

function saveDraftNow(force = false) {
  if (!editHistory.ready || editHistory.restoring) return false;
  clearTimeout(editHistory.draftTimer);
  editHistory.draftTimer = 0;
  editHistory.draftDirty = true;
  if (force !== true && historyBackgroundBlocked()) return false;
  const output = document.getElementById("draftReadout");
  try {
    const draft = JSON.stringify({ type: "ascii-bpm-draft", version: 1, savedAt: Date.now(), preset: normalizePreset(getPreset()), setup: historySetup() });
    if (draft.length > maxPresetJsonChars + 20000) throw new Error("Draft is too large");
    localStorage.setItem(editHistory.draftKey, draft);
    editHistory.draftDirty = false;
    if (output) output.textContent = "Draft saved in this browser";
    return true;
  } catch (error) {
    if (output) output.textContent = "Draft could not be saved in this browser";
    return false;
  }
}

function flushHistoryPersistence(force = false) {
  if (!editHistory.ready || force !== true && historyBackgroundBlocked()) return false;
  if (editHistory.setupDirty && editHistory.writeSetup) {
    editHistory.setupDirty = false;
    editHistory.writeSetup();
  }
  return editHistory.draftDirty || force === true ? saveDraftNow(force) : true;
}

function historyPlaybackChanged() {
  if (historyBackgroundBlocked()) {
    clearTimeout(editHistory.draftTimer);
    editHistory.draftTimer = 0;
    return;
  }
  flushHistoryPersistence();
}

function historyExternalTempoChanged() {
  if (!editHistory.ready || editHistory.restoring) return;
  // Mark the final clock value for the next safe flush, without snapshots,
  // serialization, timers, or storage work on incoming MIDI messages.
  editHistory.draftDirty = true;
  editHistory.externalTempo = controls.bpm.value;
  if (document.getElementById("lockTempo").checked) editHistory.setupDirty = true;
}

function restoreDraft() {
  const output = document.getElementById("draftReadout");
  try {
    const raw = localStorage.getItem(editHistory.draftKey);
    if (!raw) return false;
    if (raw.length > maxPresetJsonChars + 20000) throw new Error("Draft is too large");
    const draft = parsePresetJson(raw, "Local draft", maxPresetJsonChars + 20000);
    if (draft?.type !== "ascii-bpm-draft" || draft.version !== 1 || !draft.preset || typeof draft.preset !== "object" || Array.isArray(draft.preset)) throw new Error("Unsupported draft");
    const preset = validateImportedScene(draft.preset);
    if (!Object.keys(preset).length) throw new Error("Empty draft");
    if (draft.setup !== undefined && (!draft.setup || typeof draft.setup !== "object" || Array.isArray(draft.setup))) throw new Error("Invalid draft setup");
    if (draft.setup?.controls !== undefined && (!draft.setup.controls || typeof draft.setup.controls !== "object" || Array.isArray(draft.setup.controls))) throw new Error("Invalid draft controls");
    applyHistorySetup(draft.setup);
    applyPreset({ ...getPreset(), ...preset });
    refreshSceneButtons();
    if (output) output.textContent = "Recovered your local draft";
    return true;
  } catch (error) {
    if (output) output.textContent = "Local draft could not be restored";
    return false;
  }
}

function resetHistoryBaseline() {
  clearTimeout(editHistory.editTimer);
  editHistory.pending = null;
  editHistory.cancelledPreset = null;
  editHistory.externalTempo = null;
  editHistory.entries = [];
  editHistory.index = -1;
  editHistory.sceneCache = new WeakMap();
  editHistory.sizeCache = new WeakMap();
  editHistory.bankSnapshot = [];
  appendHistory(captureHistorySnapshot(), "Starting look");
  updateHistoryControls();
}

function installHistoryActions() {
  if (editHistory.actionsInstalled) return;
  editHistory.actionsInstalled = true;
  editHistory.writeSetup = saveSetup;
  saveSetup = function (...args) {
    if (editHistory.ready && historyBackgroundBlocked()) { editHistory.setupDirty = true; return; }
    editHistory.setupDirty = false;
    return editHistory.writeSetup.apply(this, args);
  };
  const tracked = (label, action) => function (...args) { return historyAction(label, () => action.apply(this, args)); };
  applyPreset = tracked("Apply settings", applyPreset);
  applyNamedPreset = tracked("Apply preset", applyNamedPreset);
  applyPresetNow = tracked("Recall look", applyPresetNow);
  loadPreset = tracked("Import scene", loadPreset);
  importSceneBank = tracked("Import scene bank", importSceneBank);
  selectSceneSlot = tracked("Select scene slot", selectSceneSlot);
  storeScene = tracked("Store scene", storeScene);
  recallScene = tracked("Recall scene", recallScene);
  clearScenes = tracked("Clear scenes", clearScenes);
  randomizeSeed = tracked("Randomize seed", randomizeSeed);
  randomizeVisual = tracked("Randomize visual", randomizeVisual);
  randomizeMotion = tracked("Randomize motion", randomizeMotion);
  randomizeColour = tracked("Randomize colour", randomizeColour);
  randomizeTiming = tracked("Randomize timing", randomizeTiming);
  randomizeAll = tracked("Randomize all", randomizeAll);
  randomizeVideoMusic2 = tracked("Shuffle Video Music 2", randomizeVideoMusic2);
  applyPanicLook = tracked("Panic look", applyPanicLook);
  nudgeBpm = tracked("Change tempo", nudgeBpm);
  toggleRunningCheckbox = tracked("Toggle display option", toggleRunningCheckbox);
  cycleSelect = tracked("Change motion", cycleSelect);
}

function initHistory() {
  if (editHistory.installed) return;
  editHistory.installed = true;
  installHistoryActions();
  restoreDraft();
  editHistory.ready = true;
  resetHistoryBaseline();
  const ids = new Set([...presetFields, ...setupControls, "toolMode", "intervalMode", "intervalMinutes"]);
  for (const id of ids) {
    const control = document.getElementById(id);
    if (!control) continue;
    for (const type of ["input", "change"]) control.addEventListener(type, () => {
      queueHistoryEdit(control, type === "change" || control.type === "checkbox" || control.tagName === "SELECT");
    });
  }
  document.getElementById("undoEdit")?.addEventListener("click", undoEdit);
  document.getElementById("redoEdit")?.addEventListener("click", redoEdit);
  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    const editing = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement && !["button", "checkbox", "radio", "range"].includes(target.type) || target?.isContentEditable;
    if (editing) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && !(key === "y" && !event.shiftKey)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === "y" || event.shiftKey) redoEdit();
    else undoEdit();
  }, true);
  window.addEventListener("pagehide", () => flushHistoryPersistence(true));
  document.addEventListener("visibilitychange", historyPlaybackChanged);
}
