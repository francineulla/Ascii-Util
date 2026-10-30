"use strict";

// Preset cards use the application's actual renderers on a detached canvas. A
// thumbnail is built synchronously with a temporary state object and detached
// form controls, leaving the live editor and its native Undo history untouched.
const galleryThumbnailCache = new Map();
const galleryThumbnailLimit = 40;
const galleryThumbnailCharLimit = 6000000;
let galleryThumbnailChars = 0;
let galleryBasePreset = null;
let galleryRefreshTimer = 0;
let galleryThumbnailTask = 0;
let galleryThumbnailRevision = 0;
let galleryInitialized = false;
let galleryNeedsRefresh = false;

function galleryBackgroundBlocked() {
  return state.running || document.hidden || controls.menu.hidden;
}

function galleryModeLabel(mode) {
  return { ascii: "Text mode", atari: "Atari Video Music", vm2: "Video Music 2", nethack: "NetHack dungeon", pixelmusic: "Pixelmusic 3000" }[mode] || "Text mode";
}

function galleryDefaultPreset() {
  return presetFields.reduce((preset, id) => {
    const control = controls[id];
    if (!control) return preset;
    preset[id] = control.type === "checkbox" ? control.defaultChecked
      : control.tagName === "SELECT" ? (Array.from(control.options).find(option => option.defaultSelected) || control.options[0])?.value || ""
      : control.defaultValue;
    return preset;
  }, {});
}

function galleryCompletePreset(preset) {
  if (!galleryBasePreset) galleryBasePreset = galleryDefaultPreset();
  return {
    ...galleryBasePreset, ...atariDefaults, ...vm2Defaults, ...nethackDefaults,
    ...pixelmusicDefaults, ...displayDefaults, ...audioSceneDefaults,
    visualizerMode: "ascii", ...normalizePreset(preset)
  };
}

function renderGalleryThumbnail(preset) {
  if (galleryBackgroundBlocked()) {
    galleryNeedsRefresh = true;
    return null;
  }
  const complete = galleryCompletePreset(preset);
  const cacheKey = JSON.stringify(complete);
  if (galleryThumbnailCache.has(cacheKey)) return galleryThumbnailCache.get(cacheKey);
  const previousState = state;
  const previousControls = Object.fromEntries(presetFields.filter(id => controls[id]).map(id => [id, controls[id]]));
  const previousAudio = { level: audioState.level, features: audioState.features };
  try {
    // No callbacks or events run between this assignment and the finally block.
    // All renderer history, canvas contexts and manual Pixelmusic actions belong
    // to this temporary object rather than the active performance or preview.
    state = { ...previousState, canvasContext: null, previewContext: null,
      vm2Frame: null, pixelmusicFrame: null, pixelmusicActions: { patternNext: 0, paletteNext: 0 } };
    // The parsing and option helpers read through controls, so substitute only
    // detached clones. Assigning and restoring a live textarea's value would
    // clear its browser Undo stack even when its caret and scroll were restored.
    for (const [id, original] of Object.entries(previousControls)) {
      controls[id] = original.cloneNode(true);
      const value = complete[id];
      if (controls[id].type === "checkbox") controls[id].checked = value;
      else if (controls[id].value !== String(value)) controls[id].value = value;
    }
    audioState.level = 0;
    audioState.features = { bass: 0, mid: 0, treble: 0, transient: 0, level: 0, pan: 0 };
    prepareStateFromControls();
    // Audio-driven presets still have a useful, repeatable appearance before a
    // source is connected. The demo input affects only this illustrative frame.
    state.options = { ...state.options, atariInput: "demo", vm2Input: "demo", pmInput: "demo", nhInput: "demo" };
    state.startedAt = 0;
    const source = document.createElement("canvas");
    const frame = buildFrame(900, 640, 360, true);
    renderFrameToCanvas(frame, source, 640, 360);
    drawScanlines(state.canvasContext, 640, 360, state.options);
    const thumbnail = document.createElement("canvas");
    thumbnail.width = 320;
    thumbnail.height = 180;
    const context = thumbnail.getContext("2d");
    context.fillStyle = "#000";
    context.fillRect(0, 0, 320, 180);
    if (state.options.invert) context.filter = "invert(1) contrast(1.35)";
    context.drawImage(source, 0, 0, 320, 180);
    const url = thumbnail.toDataURL("image/png");
    galleryThumbnailCache.set(cacheKey, url);
    galleryThumbnailChars += cacheKey.length + url.length;
    while (galleryThumbnailCache.size > galleryThumbnailLimit || galleryThumbnailChars > galleryThumbnailCharLimit) {
      const oldest = galleryThumbnailCache.keys().next().value;
      galleryThumbnailChars -= oldest.length + galleryThumbnailCache.get(oldest).length;
      galleryThumbnailCache.delete(oldest);
    }
    return url;
  } finally {
    Object.assign(controls, previousControls);
    audioState.level = previousAudio.level;
    audioState.features = previousAudio.features;
    state = previousState;
  }
}

function galleryIsOpen() {
  const panel = document.getElementById("galleryPanel");
  return !panel || panel.open;
}

function galleryAcceptsMode(mode) {
  return document.getElementById("galleryFilter")?.value === "all" || mode === controls.visualizerMode.value;
}

function galleryCreateCard(id, label, mode, preset, kind) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gallery-card";
  button.dataset[kind === "preset" ? "preset" : "sceneSlot"] = String(id);
  button.setAttribute("aria-pressed", "false");
  if (preset) {
    const thumbnail = document.createElement("img");
    thumbnail.className = "gallery-thumbnail";
    thumbnail.alt = "";
    thumbnail.width = 320;
    thumbnail.height = 180;
    thumbnail.decoding = "async";
    thumbnail.loading = "lazy";
    button.append(thumbnail);
  } else {
    button.classList.add("empty");
    const placeholder = document.createElement("span");
    placeholder.className = "gallery-placeholder";
    placeholder.textContent = "+";
    placeholder.setAttribute("aria-hidden", "true");
    button.append(placeholder);
  }
  const title = document.createElement("span");
  title.className = "gallery-title";
  title.textContent = label;
  const modeLabel = document.createElement("span");
  modeLabel.className = "gallery-mode";
  modeLabel.textContent = preset ? galleryModeLabel(mode) : "Empty · select to store";
  button.append(title, modeLabel);
  button.title = kind === "preset" ? presetHelpText[id] || `Apply ${label}`
    : preset ? "Recall this scene. Shift-click stores the current look in this slot." : "Select this slot, then use Store scene.";
  button.addEventListener("click", event => {
    if (kind === "preset") {
      controls.defaultScenePreset.value = id;
      controls.applyDefaultScene.click();
    } else {
      const slotButton = controls.sceneSlots?.querySelector(`[data-slot="${id}"]`);
      if (slotButton) slotButton.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: event.shiftKey }));
    }
    scheduleGalleryRefresh();
  });
  return button;
}

function galleryUpdateCards(container, entries, kind) {
  const structure = JSON.stringify(entries.map(entry => [entry.id, entry.label, entry.mode, Boolean(entry.preset)]));
  if (container.dataset.structure !== structure) {
    container.replaceChildren(...entries.map(entry => galleryCreateCard(entry.id, entry.label, entry.mode, entry.preset, kind)));
    container.dataset.structure = structure;
  }
  const current = getPreset();
  entries.forEach((entry, index) => {
    const button = container.children[index];
    const namedPreset = kind === "preset" ? getNamedPreset(entry.id, current) : null;
    const selected = kind === "scene" ? Number(entry.id) === state.selectedSceneSlot
      : Boolean(namedPreset) && presetFields.every(id => String(current[id] ?? "") === String(namedPreset[id] ?? ""));
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    // Store the settings on the node rather than capturing stale scene data in
    // an idle callback when a slot is overwritten before its thumbnail is drawn.
    button.galleryPreset = entry.preset;
    button.galleryKey = entry.preset ? JSON.stringify(entry.preset) : "";
  });
  container.hidden = entries.length === 0;
}

function refreshPresetGallery() {
  if (galleryBackgroundBlocked() || !galleryIsOpen()) { galleryNeedsRefresh = true; return; }
  const container = document.getElementById("presetGallery");
  if (!container || typeof getNamedPreset !== "function") return;
  if (!galleryBasePreset) galleryBasePreset = galleryDefaultPreset();
  const entries = Array.from(controls.defaultScenePreset.options).map(option => {
    const preset = getNamedPreset(option.value, galleryBasePreset);
    return { id: option.value, label: option.textContent, mode: preset?.visualizerMode || "ascii", preset };
  }).filter(entry => entry.preset && galleryAcceptsMode(entry.mode));
  galleryUpdateCards(container, entries, "preset");
  galleryQueueThumbnails();
}

function refreshSceneGallery() {
  if (galleryBackgroundBlocked() || !galleryIsOpen()) { galleryNeedsRefresh = true; return; }
  const container = document.getElementById("sceneGallery");
  if (!container) return;
  const entries = Array.from({ length: sceneSlotCount }, (_, index) => {
    const preset = state.scenes[index] ? galleryCompletePreset(state.scenes[index]) : null;
    return { id: index + 1, label: preset ? sceneLabel(index + 1, preset) : `Slot ${index + 1}`, mode: preset?.visualizerMode || "ascii", preset };
  }).filter(entry => !entry.preset || galleryAcceptsMode(entry.mode));
  galleryUpdateCards(container, entries, "scene");
  galleryQueueThumbnails();
}

function galleryQueueThumbnails() {
  galleryThumbnailRevision += 1;
  if (galleryBackgroundBlocked() || !galleryIsOpen() || galleryThumbnailTask) return;
  const schedule = callback => {
    galleryThumbnailTask = window.requestIdleCallback ? window.requestIdleCallback(callback, { timeout: 600 }) : setTimeout(callback, 32);
  };
  const next = () => {
    galleryThumbnailTask = 0;
    if (galleryBackgroundBlocked() || !galleryIsOpen()) { galleryNeedsRefresh = true; return; }
    const revision = galleryThumbnailRevision;
    const buttons = document.querySelectorAll("#presetGallery .gallery-card, #sceneGallery .gallery-card");
    for (const button of buttons) {
      const preset = button.galleryPreset;
      const image = button.querySelector("img");
      if (!preset || !image) continue;
      const key = button.galleryKey;
      if (image.galleryPresetKey === key) continue;
      try {
        const thumbnail = renderGalleryThumbnail(preset);
        if (!thumbnail) return;
        image.src = thumbnail;
        image.alt = "";
        image.galleryPresetKey = key;
      } catch (error) {
        image.galleryPresetKey = key;
        image.alt = "Preview unavailable";
      }
      // At most one canvas render per idle callback leaves editing and playback
      // responsive, even when the all-modes gallery is opened on a slower device.
      schedule(next);
      return;
    }
    if (revision !== galleryThumbnailRevision) schedule(next);
  };
  schedule(next);
}

function scheduleGalleryRefresh() {
  if (!galleryInitialized) return;
  galleryNeedsRefresh = true;
  clearTimeout(galleryRefreshTimer);
  galleryRefreshTimer = 0;
  if (galleryBackgroundBlocked() || !galleryIsOpen()) return;
  galleryRefreshTimer = setTimeout(() => {
    galleryRefreshTimer = 0;
    if (galleryBackgroundBlocked() || !galleryIsOpen()) return;
    galleryNeedsRefresh = false;
    refreshPresetGallery();
    refreshSceneGallery();
    const readout = document.getElementById("galleryReadout");
    if (readout) {
      const presets = document.getElementById("presetGallery")?.children.length || 0;
      const scenes = Array.from(document.querySelectorAll("#sceneGallery .gallery-card")).filter(button => !button.classList.contains("empty")).length;
      readout.textContent = `${presets} presets · ${scenes} saved scenes${document.getElementById("galleryFilter")?.value === "all" ? " across all modes" : ` in ${galleryModeLabel(controls.visualizerMode.value)}`}`;
    }
  }, 30);
}

function galleryPlaybackChanged() {
  if (galleryBackgroundBlocked() || !galleryIsOpen()) {
    clearTimeout(galleryRefreshTimer);
    galleryRefreshTimer = 0;
    if (galleryThumbnailTask) {
      if (window.cancelIdleCallback) window.cancelIdleCallback(galleryThumbnailTask);
      else clearTimeout(galleryThumbnailTask);
      galleryThumbnailTask = 0;
    }
    galleryNeedsRefresh = true;
    return;
  }
  if (galleryNeedsRefresh) scheduleGalleryRefresh();
}

function initGallery() {
  if (galleryInitialized || !document.getElementById("presetGallery")) return;
  galleryBasePreset = galleryDefaultPreset();
  galleryInitialized = true;
  document.getElementById("galleryFilter")?.addEventListener("change", scheduleGalleryRefresh);
  document.getElementById("galleryPanel")?.addEventListener("toggle", galleryPlaybackChanged);
  document.addEventListener("visibilitychange", galleryPlaybackChanged);
  scheduleGalleryRefresh();
}
