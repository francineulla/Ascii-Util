"use strict";

// Scene persistence, imports, preset application, randomizers, and transitions.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function sceneLabel(slot, preset = state.scenes[slot - 1]) {
  return preset && preset.sceneName ? `${slot}: ${preset.sceneName}` : `Scene ${slot}`;
}

function lockedFields() {
  return new Set(Object.entries(lockGroups).flatMap(([id, fields]) => document.getElementById(id).checked ? fields : []));
}

function updateSceneDirty() {
  const saved = state.scenes[state.selectedSceneSlot - 1];
  const current = getPreset();
  const locked = lockedFields();
  const changed = !saved || presetFields.some(id => {
    const fallback = id === "sceneName" ? "" : id === "visualizerMode" ? "ascii" : atariDefaults[id] ?? vm2Defaults[id] ?? nethackDefaults[id] ?? pixelmusicDefaults[id] ?? displayDefaults[id] ?? audioSceneDefaults[id] ?? current[id];
    return !locked.has(id) && String(current[id] ?? "") !== String(saved[id] ?? fallback);
  });
  const output = document.getElementById("sceneDirty");
  output.textContent = sceneStorageFailed ? "Browser save failed" : !saved ? "Not saved in a slot" : changed ? "Unsaved changes" : "Saved scene · no changes";
  output.classList.toggle("unsaved", changed || sceneStorageFailed);
  document.getElementById("revertScene").disabled = !saved || !changed;
}
function reportScene(message) {
  controls.sceneReadout.textContent = message;
}

function saveSetup() {
  try {
    localStorage.setItem("asciiBpmSetup", JSON.stringify({
      selectedSlot: state.selectedSceneSlot,
      intervalMode: intervalMode.checked,
      intervalMinutes: intervalMinutes.value,
      lockedValues: Object.fromEntries([...lockedFields()].map(id => [id, getPreset()[id]])),
      controls: Object.fromEntries(setupControls.map(id => {
        const control = document.getElementById(id);
        return [id, control.type === "checkbox" ? control.checked : control.value];
      }))
    }));
  } catch (error) {
    reportScene("Setup could not be saved in this browser");
  }
}

function loadSetup() {
  try {
    const setup = JSON.parse(localStorage.getItem("asciiBpmSetup") || "{}");
    state.selectedSceneSlot = clamp(Math.trunc(Number(setup.selectedSlot)) || 1, 1, sceneSlotCount);
    intervalMode.checked = setup.intervalMode === true;
    intervalMinutes.value = String(clamp(Number(setup.intervalMinutes) || 1, 0.1, 1440));
    for (const id of setupControls) {
      const control = document.getElementById(id);
      const value = setup.controls && setup.controls[id];
      if (value === undefined) continue;
      if (control.type === "checkbox") control.checked = value === true;
      else if (control.tagName === "SELECT") {
        if (controlHasOption(control, String(value))) control.value = String(value);
      } else if (Number.isFinite(Number(value))) control.value = String(clamp(Number(value), Number(control.min), Number(control.max)));
    }
    const preset = state.scenes[state.selectedSceneSlot - 1];
    if (preset) {
      applyPreset(preset);
      reportScene(`Restored saved scene ${state.selectedSceneSlot}`);
    }
    const lockedValues = normalizePreset(setup.lockedValues);
    for (const id of lockedFields()) {
      if (!(id in lockedValues)) continue;
      const control = controls[id];
      if (control.type === "checkbox") control.checked = lockedValues[id];
      else control.value = lockedValues[id];
    }
    refreshSceneButtons();
  } catch (error) {
    reportScene("Saved setup could not be restored");
  }
}

function randomizeSeed() {
  const chunks = new Uint32Array(2);
  crypto.getRandomValues(chunks);
  controls.seed.value = `${chunks[0].toString(36)}-${chunks[1].toString(36)}`;
  schedulePreview();
}

function getPreset() {
  return presetFields.reduce((preset, id) => {
    const control = controls[id];
    if (!control) return preset;
    preset[id] = control.type === "checkbox" ? control.checked : control.value;
    return preset;
  }, {});
}

function parsePresetJson(raw, label = "Scene JSON", maxChars = maxPresetJsonChars) {
  const text = String(raw || "").trim();
  if (!text) throw new Error(`${label} is empty.`);
  if (text.length > maxChars) throw new Error(`${label} is too large.`);
  return JSON.parse(text);
}

function parsePresetInput(raw, label = "Scene JSON", maxChars = maxPresetJsonChars) {
  const text = String(raw || "").trim();
  if (text.startsWith("#preset=")) return decodePresetFromUrl(text.slice(8));
  if (/^(file|https?):/i.test(text) && text.includes("#preset=")) {
    return decodePresetFromUrl(new URL(text, location.href).hash.slice(8));
  }
  return parsePresetJson(text, label, maxChars);
}

function controlHasOption(control, value) {
  return Array.from(control.options).some((option) => option.value === value);
}

function normalizePreset(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return {};
  // Retain older dungeon scenes now that NetHack lives exclusively in the synth tool.
  if (preset.backgroundMode === "nethack") {
    preset = { ...preset, backgroundMode: "ray", visualizerMode: !preset.visualizerMode || preset.visualizerMode === "ascii" ? "nethack" : preset.visualizerMode };
  }
  return presetFields.reduce((normalized, id) => {
    if (!Object.prototype.hasOwnProperty.call(preset, id) || !controls[id]) return normalized;
    const control = controls[id];
    if (control.type === "checkbox") {
      normalized[id] = preset[id] === true || preset[id] === "true" || preset[id] === 1 || preset[id] === "1";
      return normalized;
    }
    const value = String(preset[id] ?? "");
    if (control.tagName === "SELECT") {
      if (controlHasOption(control, value)) normalized[id] = value;
      return normalized;
    }
    if (control.type === "number" || control.type === "range") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return normalized;
      const min = control.min === "" ? numeric : Number(control.min);
      const max = control.max === "" ? numeric : Number(control.max);
      normalized[id] = String(clamp(numeric, min, max));
      return normalized;
    }
    const limit = id === "customCharset" ? maxCustomCharsetChars : control.tagName === "TEXTAREA" ? maxTextareaChars : maxTextInputChars;
    normalized[id] = value.slice(0, id === "sceneName" ? 80 : limit);
    return normalized;
  }, {});
}

function applyPreset(preset, respectLocks = false) {
  resetPixelmusicPreview();
  const safePreset = normalizePreset(preset);
  // Scenes saved before the Atari mode must always recall their original ASCII renderer.
  if (!("visualizerMode" in safePreset)) safePreset.visualizerMode = "ascii";
  for (const [id, value] of Object.entries({ ...atariDefaults, ...vm2Defaults, ...nethackDefaults, ...pixelmusicDefaults, ...displayDefaults, ...audioSceneDefaults })) {
    if (!(id in safePreset)) safePreset[id] = value;
  }
  const locked = respectLocks ? lockedFields() : new Set();
  controls.sceneName.value = safePreset.sceneName || "";
  for (const id of presetFields) {
    if (locked.has(id)) continue;
    if (!Object.prototype.hasOwnProperty.call(safePreset, id) || !controls[id]) continue;
    const control = controls[id];
    if (control.type === "checkbox") {
      control.checked = safePreset[id];
    } else {
      control.value = safePreset[id];
    }
  }
  updateSliderReadouts();
  updateSceneDirty();
}

async function copyPreset() {
  const json = JSON.stringify({
    type: "ascii-bpm-scene",
    version: 2,
    slot: state.selectedSceneSlot,
    preset: normalizePreset(getPreset())
  }, null, 2);
  controls.presetData.value = json;
  controls.presetData.select();
  try {
    await navigator.clipboard.writeText(json);
  } catch (error) {
    document.execCommand("copy");
  }
  controls.sceneReadout.textContent = `Exported scene ${state.selectedSceneSlot}`;
}

function validateImportedScene(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    throw new Error("Expected a scene settings object.");
  }
  const normalized = normalizePreset(preset);
  if (!Object.keys(normalized).length) throw new Error("No recognized scene settings found.");
  return normalized;
}

function loadPreset() {
  try {
    const payload = parsePresetInput(controls.presetData.value, "Scene JSON", maxSceneBankJsonChars);
    if (payload.type === "ascii-bpm-scene-bank") {
      importSceneBank(payload);
      return;
    }
    const preset = payload.type === "ascii-bpm-scene" && payload.preset ? payload.preset : payload;
    const imported = { ...getPreset(), sceneName: "", visualizerMode: "ascii", ...atariDefaults, ...vm2Defaults, ...nethackDefaults, ...pixelmusicDefaults, ...displayDefaults, ...audioSceneDefaults, ...validateImportedScene(preset) };
    state.scenes[state.selectedSceneSlot - 1] = normalizePreset(imported);
    const stored = saveSceneSlots();
    applyPreset(imported, true);
    schedulePreview();
    if (state.running) restartPlayback(true);
    saveSetup();
    reportScene(stored
      ? `Imported and saved scene ${state.selectedSceneSlot} in this browser`
      : `Imported scene ${state.selectedSceneSlot}, but browser storage failed`);
  } catch (error) {
    reportScene(`Scene import failed: ${error.message}`);
  }
}

async function copySceneBank() {
  const scenes = Array.from({ length: sceneSlotCount }, (_, index) => state.scenes[index] ? normalizePreset(state.scenes[index]) : null);
  scenes[state.selectedSceneSlot - 1] = normalizePreset(getPreset());
  const json = JSON.stringify({
    type: "ascii-bpm-scene-bank",
    version: 2,
    selectedSlot: state.selectedSceneSlot,
    scenes
  }, null, 2);
  controls.presetData.value = json;
  controls.presetData.select();
  try {
    await navigator.clipboard.writeText(json);
  } catch (error) {
    document.execCommand("copy");
  }
  controls.sceneReadout.textContent = "Exported all scenes";
}

function importSceneBank(payload) {
  if (!Array.isArray(payload.scenes) || payload.scenes.length > sceneSlotCount) {
    throw new Error("Expected a scene bank with up to eight slots.");
  }
  const scenes = Array.from({ length: sceneSlotCount }, (_, index) =>
    payload.scenes[index] == null ? null : validateImportedScene(payload.scenes[index]));
  state.scenes = scenes;
  state.selectedSceneSlot = clamp(Math.trunc(Number(payload.selectedSlot)) || state.selectedSceneSlot, 1, 8);
  if (!scenes[state.selectedSceneSlot - 1]) {
    const first = scenes.findIndex(Boolean);
    if (first !== -1) state.selectedSceneSlot = first + 1;
  }
  const stored = saveSceneSlots();
  refreshSceneButtons();
  const selected = state.scenes[state.selectedSceneSlot - 1];
  if (selected) applyPreset(selected, true);
  schedulePreview();
  if (state.running) restartPlayback(true);
  saveSetup();
  resetSceneInterval();
  reportScene(stored
    ? `Imported and saved ${scenes.filter(Boolean).length} scenes in this browser; selected slot ${state.selectedSceneSlot}`
    : "Imported scene bank, but browser storage failed");
}

function loadSceneBank() {
  try {
    const payload = parsePresetInput(controls.presetData.value, "Scene bank JSON", maxSceneBankJsonChars);
    if (payload.type !== "ascii-bpm-scene-bank") {
      throw new Error("Expected an ascii-bpm-scene-bank JSON export.");
    }
    importSceneBank(payload);
  } catch (error) {
    reportScene(`Scene bank import failed: ${error.message}`);
  }
}

function encodePresetForUrl(preset) {
  const json = JSON.stringify(normalizePreset(preset));
  if (json.length > maxPresetJsonChars) throw new Error("Preset is too large for a share URL.");
  return btoa(unescape(encodeURIComponent(json)));
}

function decodePresetFromUrl(hash) {
  // Each UTF-16 code unit can require three UTF-8 bytes, then base64 expands by 4/3.
  if (hash.length > maxPresetJsonChars * 4) throw new Error("Preset URL is too large.");
  return parsePresetJson(decodeURIComponent(escape(atob(hash))), "Preset URL");
}

function loadPresetFromUrl() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.startsWith("#preset=") ? location.hash.slice(8) : "";
  if (hash) {
    try {
      applyPreset(decodePresetFromUrl(hash));
      updateSliderReadouts();
    } catch (error) {
      controls.obsReadout.textContent = "Preset URL failed";
    }
  }

  if (params.get("obs") === "1") {
    controls.fullscreenOnStart.checked = false;
    controls.stageBeatIndicator.checked = false;
    requestAnimationFrame(() => start());
  }
}

function randomizeSelect(control, random) {
  control.selectedIndex = Math.floor(random() * control.options.length);
}

function applyNamedPreset(name) {
  const extendedPresets = {
    pixelmusic3000: { ...pixelmusicDefaults, visualizerMode: "pixelmusic", livePreview: true, scanlines: true, invert: false },
    nethackVideo: { ...nethackDefaults, visualizerMode: "nethack", nhView: "follow", nhGlow: "60", livePreview: true, scanlines: false, invert: false },
    videoMusic2: { ...vm2Defaults, visualizerMode: "vm2", livePreview: true, scanlines: true, invert: false },
    vm2Phosphor: { ...vm2Defaults, visualizerMode: "vm2", vm2Palette: "phosphor", vm2Geometry: "circle", vm2Shape: "ring", vm2Columns: "2", vm2Rows: "2", vm2Spin: "12", vm2Trails: "65", vm2Glow: "55", livePreview: true, invert: false },
    vm2Portrait: { ...vm2Defaults, visualizerMode: "vm2", vm2Aspect: "9:16", vm2Geometry: "hexagon", vm2Shape: "ring", vm2Columns: "1", vm2Rows: "4", vm2Palette: "sunset", vm2Spin: "-10", vm2Trails: "30", livePreview: true, invert: false }
  };
  const preset = extendedPresets[name] || (name === "atariVideoMusic"
    ? { ...atariDefaults, visualizerMode: "atari", scanlines: true, invert: false, livePreview: true }
    : presetBank[name]);
  if (!preset) return;
  const nextPreset = { ...getPreset(), visualizerMode: "ascii", ...preset };
  if (name === "galaxyMask" && !controls.maskArt.value.trim()) {
    nextPreset.maskArt = [
      "        .***.        ",
      "     .*********.     ",
      "   .****  *  ****.   ",
      "  ****   ***   ****  ",
      " .****  *****  ****. ",
      "  ****   ***   ****  ",
      "   .****  *  ****.   ",
      "     .*********.     ",
      "        .***.        "
    ].join("\n");
  }
  if (name === "midiStrobe" && !navigator.requestMIDIAccess) {
    nextPreset.midiSync = false;
    setMidiStatus("not supported");
  }
  requestPresetChange(nextPreset, name);
  updateSliderReadouts();
  schedulePreview();
}

function applyPresetNow(preset, fade = false) {
  const transition = captureSceneTransition(fade);
  applyPreset(preset, true);
  updateSliderReadouts();
  schedulePreview();
  if (state.running) restartPlayback(fade);
  if (transition) playSceneTransition(transition);
}

function requestPresetChange(preset, label = "preset") {
  if (!state.running || state.paused || controls.transitionMode.value === "cut") {
    state.pendingPreset = null;
    applyPresetNow(preset, false);
    reportScene(`Applied ${label}`);
    return;
  }
  const mode = controls.transitionMode.value;
  const beatMs = 60000 / state.options.bpm;
  const timelineNow = state.paused ? state.pausedAt : performance.now();
  const currentBeat = Math.max(0, Math.floor((timelineNow - state.startedAt) / beatMs));
  const targetBeat = mode === "bar"
    ? (Math.floor(currentBeat / state.options.barLength) + 1) * state.options.barLength
    : currentBeat + 1;
  state.pendingPreset = { preset, label, mode, targetBeat };
  reportScene(mode === "bar" ? `Queued ${label} for next bar` : `Queued ${label} for next beat`);
}

function maybeApplyQueuedPreset(frame) {
  if (!state.pendingPreset) return false;
  const queued = state.pendingPreset;
  const shouldApply = frame.beatIndex >= queued.targetBeat;
  if (!shouldApply) return false;
  state.pendingPreset = null;
  applyPresetNow(queued.preset, queued.mode === "fade");
  reportScene(`Applied ${queued.label}`);
  return true;
}

function loadSceneSlots() {
  try {
    const scenes = JSON.parse(localStorage.getItem("asciiBpmScenes") || "[]");
    state.scenes = Array.isArray(scenes)
      ? Array.from({ length: sceneSlotCount }, (_, index) => scenes[index] ? normalizePreset(scenes[index]) : null)
      : [];
  } catch (error) {
    state.scenes = [];
    controls.sceneReadout.textContent = "Saved scenes could not be loaded";
  }
  refreshSceneButtons();
}

function saveSceneSlots() {
  try {
    localStorage.setItem("asciiBpmScenes", JSON.stringify(state.scenes));
    sceneStorageFailed = false;
    refreshSceneButtons();
    return true;
  } catch (error) {
    sceneStorageFailed = true;
    refreshSceneButtons();
    controls.sceneReadout.textContent = "Scene storage is full";
    return false;
  }
}

function refreshSceneButtons() {
  if (!controls.sceneSlots) return;
  for (const button of controls.sceneSlots.querySelectorAll("[data-slot]")) {
    const slot = Number(button.dataset.slot);
    const hasScene = Boolean(state.scenes[slot - 1]);
    button.classList.toggle("empty", !hasScene);
    button.classList.toggle("selected", slot === state.selectedSceneSlot);
    button.setAttribute("aria-pressed", String(slot === state.selectedSceneSlot));
    button.textContent = hasScene ? sceneLabel(slot) : `Slot ${slot}`;
    button.title = hasScene
      ? "Click to recall this scene. Shift-click stores over it."
      : "Click to select this empty slot, then press Store scene.";
  }
  updateSceneDirty();
}

function selectSceneSlot(slot) {
  state.selectedSceneSlot = clamp(Math.trunc(slot) || 1, 1, 8);
  if (!state.scenes[state.selectedSceneSlot - 1]) controls.sceneName.value = "";
  saveSetup();
  refreshSceneButtons();
  controls.sceneReadout.textContent = `Selected slot ${state.selectedSceneSlot}`;
}

function storeScene(slot = state.selectedSceneSlot) {
  state.scenes[slot - 1] = normalizePreset(getPreset());
  const stored = saveSceneSlots();
  if (stored) reportScene(`Saved scene ${slot} in this browser`);
  return stored;
}

function recallScene(slot = state.selectedSceneSlot) {
  const preset = state.scenes[slot - 1];
  if (!preset) {
    if (!state.running) selectSceneSlot(slot);
    reportScene(`Slot ${slot} is empty. Select it in setup and use Store scene or Import scene.`);
    return;
  }
  selectSceneSlot(slot);
  resetSceneInterval(state.paused ? state.pausedAt : performance.now());
  requestPresetChange(preset, sceneLabel(slot, preset));
}

function clearScenes() {
  state.scenes = [];
  if (saveSceneSlots()) controls.sceneReadout.textContent = "Cleared scenes";
}

function randomizePixelmusic(group = "all") {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|pixelmusic|${group}`));
  if (group === "visual" || group === "all") {
    randomizeSelect(controls.pmRoutine, random);
    controls.pmGainLeft.value = Math.round(randomBetween(random, 50, 150));
    controls.pmGainRight.value = Math.round(randomBetween(random, 50, 150));
    controls.pmThickness.value = pick([1, 2, 2, 3], random);
  }
  if (group === "motion" || group === "all") randomizeSelect(controls.pmSpeed, random);
  if (group === "colour" || group === "all") randomizeSelect(controls.pmPalette, random);
  if (group === "timing") {
    controls.bpm.value = Math.round(randomBetween(random, 70, 178));
    randomizeSelect(controls.pmSpeed, random);
  }
  updateSliderReadouts();
  schedulePreview();
  reportScene("Pixelmusic 3000 look updated");
}

function randomizeDungeon(group = "all") {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|dungeon|${group}`));
  if (group === "visual" || group === "all") {
    randomizeSelect(controls.nhLayout, random);
    controls.nhDepth.value = Math.round(randomBetween(random, 1, 30));
    controls.nhPopulation.value = Math.round(randomBetween(random, 15, 85));
  }
  if (group === "motion" || group === "all") {
    randomizeSelect(controls.nhView, random);
    randomizeSelect(controls.nhSpeed, random);
    controls.nhFog.checked = random() > 0.6;
  }
  if (group === "colour" || group === "all") {
    randomizeSelect(controls.nhPalette, random);
    controls.nhGlow.value = Math.round(randomBetween(random, 15, 80));
    controls.nhDynamics.value = Math.round(randomBetween(random, 35, 100));
  }
  if (group === "timing") {
    controls.bpm.value = Math.round(randomBetween(random, 70, 178));
    randomizeSelect(controls.nhSpeed, random);
  }
  updateSliderReadouts();
  schedulePreview();
  reportScene("Dungeon updated");
}

function randomizeAtari(group = "all") {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|atari|${group}`));
  if (group === "visual" || group === "all") {
    for (const id of ["atariShape", "atariHorizontal", "atariVertical"]) randomizeSelect(controls[id], random);
    for (const id of ["atariGainLeft", "atariGainRight"]) controls[id].value = Math.round(randomBetween(random, 60, 140));
    for (const id of ["atariContourLeft", "atariContourRight"]) controls[id].value = Math.round(randomBetween(random, 20, 95));
  }
  if (group === "motion" || group === "all") {
    for (const id of ["atariContourLeft", "atariContourRight"]) controls[id].value = Math.round(randomBetween(random, 20, 95));
    randomizeSelect(controls.atariAutoRate, random);
    randomizeSelect(controls.atariAutoShape, random);
  }
  if (group === "colour" || group === "all") {
    controls.atariColor.value = Math.round(randomBetween(random, 15, 100));
  }
  if (group === "timing") {
    controls.bpm.value = Math.round(randomBetween(random, 70, 178));
    randomizeSelect(controls.atariAutoRate, random);
  }
  updateSliderReadouts();
  schedulePreview();
  reportScene("Atari Video Music look updated");
}

function randomizeVideoMusic2(group = "all") {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|vm2|${group}`));
  if (group === "visual" || group === "all") {
    for (const id of ["vm2Geometry", "vm2Shape", "vm2Detail"]) randomizeSelect(controls[id], random);
    controls.vm2Columns.value = pick([1, 2, 3, 4, 5], random);
    controls.vm2Rows.value = pick([1, 2, 3, 4, 5], random);
    for (const id of ["vm2GainLeft", "vm2GainRight"]) controls[id].value = Math.round(randomBetween(random, 60, 140));
    for (const id of ["vm2ContourLeft", "vm2ContourRight"]) controls[id].value = Math.round(randomBetween(random, 20, 95));
  }
  if (group === "motion" || group === "all") {
    randomizeSelect(controls.vm2Symmetry, random);
    controls.vm2Rotation.value = Math.round(randomBetween(random, -90, 90));
    controls.vm2Spin.value = pick([-20, -10, 0, 0, 10, 20], random);
    controls.vm2Zoom.value = Math.round(randomBetween(random, 80, 135));
    controls.vm2Trails.value = pick([0, 0, 30, 50, 70], random);
  }
  if (group === "colour" || group === "all") {
    randomizeSelect(controls.vm2Palette, random);
    controls.vm2Color.value = Math.round(randomBetween(random, 25, 90));
    controls.vm2Hue.value = Math.round(randomBetween(random, 0, 360));
    controls.vm2Saturation.value = Math.round(randomBetween(random, 55, 100));
    controls.vm2Glow.value = Math.round(randomBetween(random, 10, 65));
  }
  if (group === "timing") {
    controls.bpm.value = Math.round(randomBetween(random, 70, 178));
    randomizeSelect(controls.vm2AutoRate, random);
  }
  updateSliderReadouts();
  schedulePreview();
  reportScene("Video Music 2 look updated");
}

function randomizeVisual() {
  if (controls.visualizerMode.value === "pixelmusic") return randomizePixelmusic("visual");
  if (isDungeonMode()) return randomizeDungeon("visual");
  if (controls.visualizerMode.value === "atari") return randomizeAtari("visual");
  if (controls.visualizerMode.value === "vm2") return randomizeVideoMusic2("visual");
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|visual`));
  randomizeSelect(controls.backgroundMode, random);
  randomizeSelect(controls.charsetPreset, random);
  randomizeSelect(controls.quality, random);
  controls.glyphSize.value = Math.round(randomBetween(random, 9, 18));
  controls.glitch.value = Math.round(randomBetween(random, 4, 76));
  if (controls.charsetPreset.value === "custom") {
    controls.customCharset.value = pick(["@%#*+=-:. ", "01 ", ".oO80Q@ ", "/\\|xX ", "~-=+*#@ "], random);
  }
  updateSliderReadouts();
  schedulePreview();
  controls.sceneReadout.textContent = `Randomized current scene ${state.selectedSceneSlot} only`;
}

function randomizeMotion() {
  if (controls.visualizerMode.value === "pixelmusic") return randomizePixelmusic("motion");
  if (isDungeonMode()) return randomizeDungeon("motion");
  if (controls.visualizerMode.value === "atari") return randomizeAtari("motion");
  if (controls.visualizerMode.value === "vm2") return randomizeVideoMusic2("motion");
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|motion`));
  randomizeSelect(controls.wordMotion, random);
  randomizeSelect(controls.maskLayer, random);
  randomizeSelect(controls.legibilityMode, random);
  controls.density.value = Math.round(randomBetween(random, 1, 8));
  controls.wordHalo.checked = random() > 0.45;
  controls.haloSize.value = Math.round(randomBetween(random, 0, 24));
  controls.maskScale.value = Math.round(randomBetween(random, 1, 8));
  updateSliderReadouts();
  schedulePreview();
}

function randomizeColour() {
  if (controls.visualizerMode.value === "pixelmusic") return randomizePixelmusic("colour");
  if (isDungeonMode()) return randomizeDungeon("colour");
  if (controls.visualizerMode.value === "atari") return randomizeAtari("colour");
  if (controls.visualizerMode.value === "vm2") return randomizeVideoMusic2("colour");
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|colour`));
  randomizeSelect(controls.colorMode, random);
  randomizeSelect(controls.palette, random);
  controls.invert.checked = random() > 0.82;
  controls.scanlines.checked = random() > 0.25;
  schedulePreview();
}

function randomizeTiming() {
  if (controls.visualizerMode.value === "pixelmusic") return randomizePixelmusic("timing");
  if (isDungeonMode()) return randomizeDungeon("timing");
  if (controls.visualizerMode.value === "atari") return randomizeAtari("timing");
  if (controls.visualizerMode.value === "vm2") return randomizeVideoMusic2("timing");
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|timing`));
  controls.bpm.value = Math.round(randomBetween(random, 70, 178));
  randomizeSelect(controls.beatRate, random);
  randomizeSelect(controls.barLength, random);
  randomizeSelect(controls.transitionMode, random);
  randomizeSelect(controls.fpsCap, random);
  controls.sectionBars.value = Math.round(randomBetween(random, 2, 16));
  controls.autoSections.checked = random() > 0.62;
  controls.beatFlash.checked = random() > 0.15;
  controls.downbeatFlash.checked = random() > 0.68;
  controls.stageBeatIndicator.checked = random() > 0.35;
  schedulePreview();
}

function randomizeAll() {
  if (controls.visualizerMode.value === "pixelmusic") {
    if (!controls.lockSeed.checked) randomizeSeed();
    return randomizePixelmusic();
  }
  if (isDungeonMode()) {
    if (!controls.lockSeed.checked) randomizeSeed();
    return randomizeDungeon();
  }
  if (controls.visualizerMode.value === "atari") {
    if (!controls.lockSeed.checked) randomizeSeed();
    return randomizeAtari();
  }
  if (controls.visualizerMode.value === "vm2") {
    if (!controls.lockSeed.checked) randomizeSeed();
    return randomizeVideoMusic2();
  }
  const random = mulberry32(Date.now() ^ hashString(controls.lyrics.value));
  if (!controls.lockSeed.checked) randomizeSeed();
  controls.bpm.value = Math.round(randomBetween(random, 72, 178));
  controls.glyphSize.value = Math.round(randomBetween(random, 9, 18));
  controls.density.value = Math.round(randomBetween(random, 2, 8));
  controls.glitch.value = Math.round(randomBetween(random, 8, 82));
  controls.haloSize.value = Math.round(randomBetween(random, 0, 24));
  randomizeSelect(controls.colorMode, random);
  randomizeSelect(controls.backgroundMode, random);
  randomizeSelect(controls.charsetPreset, random);
  randomizeSelect(controls.beatRate, random);
  randomizeSelect(controls.wordMotion, random);
  randomizeSelect(controls.palette, random);
  randomizeSelect(controls.barLength, random);
  randomizeSelect(controls.transitionMode, random);
  randomizeSelect(controls.quality, random);
  randomizeSelect(controls.fpsCap, random);
  randomizeSelect(controls.lyricMode, random);
  randomizeSelect(controls.captureSize, random);
  randomizeSelect(controls.legibilityMode, random);
  controls.sectionBars.value = Math.round(randomBetween(random, 2, 16));
  controls.beatFlash.checked = random() > 0.12;
  controls.downbeatFlash.checked = random() > 0.72;
  controls.stageBeatIndicator.checked = random() > 0.48;
  controls.fullscreenOnStart.checked = false;
  controls.midiSync.checked = false;
  controls.autoSections.checked = random() > 0.58;
  controls.recordingMode.checked = false;
  controls.invert.checked = random() > 0.82;
  controls.scanlines.checked = random() > 0.24;
  controls.wordHalo.checked = random() > 0.18;
  controls.backgroundOnly.checked = random() > 0.82;
  controls.maskMode.value = random() > 0.75 && controls.maskArt.value.trim() ? pick(["stencil", "reveal", "texture"], random) : "off";
  randomizeSelect(controls.maskLayer, random);
  controls.maskScale.value = Math.round(randomBetween(random, 1, 8));
  if (controls.charsetPreset.value === "custom") {
    controls.customCharset.value = pick([
      "@%#*+=-:. ",
      "01 ",
      ".oO80Q@ ",
      "/\\|xX ",
      "~-=+*#@ "
    ], random);
  }
  updateSliderReadouts();
  schedulePreview();
}

let activeSceneTransition = null;

function clearSceneTransition() {
  const transition = activeSceneTransition;
  activeSceneTransition = null;
  if (!transition) return;
  transition.animations.forEach(animation => animation.cancel());
  transition.layer.remove();
}

function captureSceneTransition(legacyFade = false) {
  clearSceneTransition();
  if (!state.running || state.paused || !state.currentFrame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const selected = document.getElementById("sceneEffect").value;
  const effect = selected === "none" && legacyFade ? "crossfade" : selected;
  if (effect === "none") return null;
  const layer = document.createElement("div");
  layer.className = "scene-transition";
  layer.setAttribute("aria-hidden", "true");
  const source = controls.canvas.hidden ? controls.ascii : controls.canvas;
  const snapshot = source.cloneNode(true);
  snapshot.removeAttribute("id");
  snapshot.hidden = false;
  snapshot.className = "transition-snapshot";
  const sourceStyle = getComputedStyle(source);
  layer.style.filter = sourceStyle.filter;
  for (const property of ["fontFamily", "fontSize", "lineHeight", "letterSpacing", "whiteSpace", "color", "textShadow"]) {
    snapshot.style[property] = sourceStyle[property];
  }
  if (source === controls.canvas) snapshot.getContext("2d").drawImage(source, 0, 0);
  layer.appendChild(snapshot);
  return { layer, effect, animations: [] };
}

function playSceneTransition(transition) {
  const capture = getCaptureSize();
  renderFrame(buildFrame(performance.now(), capture.width, capture.height, true));
  const duration = clamp(Number(document.getElementById("sceneDuration").value) || 0.8, 0.1, 5) * 1000;
  const keyframes = {
    crossfade: [{ opacity: 1 }, { opacity: 0 }],
    wipe: [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 100% 0 0)" }],
    slide: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
    zoom: [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }]
  };
  activeSceneTransition = transition;
  controls.stage.appendChild(transition.layer);
  const animation = transition.layer.animate(keyframes[transition.effect], { duration, easing: "ease-in-out", fill: "forwards" });
  transition.animations.push(animation);
  if (transition.effect === "slide") {
    const incoming = controls.canvas.hidden ? controls.ascii : controls.canvas;
    transition.animations.push(incoming.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration, easing: "ease-in-out" }));
  }
  animation.onfinish = () => { if (activeSceneTransition === transition) clearSceneTransition(); };
}
