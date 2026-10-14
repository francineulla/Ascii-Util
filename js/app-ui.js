"use strict";

// Control presentation and explicit event binding; startup is owned by app.js.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function updateSliderReadouts() {
  updateContextualControls();
  for (const id of ["pmGainLeft", "pmGainRight", "pmThickness"]) {
    document.getElementById(`${id}Value`).textContent = `${controls[id].value}${id === "pmThickness" ? "" : "%"}`;
  }
  for (const id of Object.keys(displayDefaults)) {
    document.getElementById(`${id}Value`).textContent = `${controls[id].value}${id === "scanlineSpacing" ? " px" : "%"}`;
    controls[id].disabled = !controls.scanlines.checked;
  }
  for (const id of ["nhPopulation", "nhGlow", "nhDynamics"]) document.getElementById(`${id}Value`).textContent = `${controls[id].value}%`;
  for (const id of Object.keys(vm2Defaults)) {
    const output = document.getElementById(`${id}Value`);
    if (output) output.textContent = `${controls[id].value}${id === "vm2Spin" ? "°/s" : ["vm2Rotation", "vm2Hue"].includes(id) ? "°" : "%"}`;
  }
  for (const id of ["atariGainLeft", "atariGainRight", "atariContourLeft", "atariContourRight", "atariColor"]) {
    document.getElementById(`${id}Value`).textContent = `${controls[id].value}%`;
  }
  updateAtariControls();
  controls.glyphSizeValue.textContent = controls.glyphSize.value;
  controls.densityValue.textContent = controls.density.value;
  controls.glitchValue.textContent = controls.glitch.value;
  controls.haloSizeValue.textContent = controls.haloSize.value;
  controls.maskScaleValue.textContent = controls.maskScale.value;
}

function updateContextualControls() {
  controls.customCharset.disabled = controls.charsetPreset.value !== "custom";
  controls.haloSize.disabled = !controls.wordHalo.checked;
  controls.maskLayer.disabled = controls.maskScale.disabled = controls.maskMode.value === "off";
  controls.downbeatFlash.disabled = !controls.beatFlash.checked;
  controls.sectionBars.disabled = !controls.autoSections.checked;
  controls.splitWords.disabled = controls.lyricMode.value !== "words";
  intervalMinutes.disabled = !intervalMode.checked;
  document.getElementById("sceneDuration").disabled = document.getElementById("sceneEffect").value === "none";
  document.getElementById("audioSensitivityValue").textContent = document.getElementById("audioSensitivity").value;
  for (const id of ["audioAttack", "audioRelease", "audioGate"]) {
    document.getElementById(`${id}Value`).textContent = `${document.getElementById(id).value}${id === "audioGate" ? " dBFS" : " ms"}`;
  }
  const musicalTiming = controls.pmAutomation.value !== "original";
  document.getElementById("pmTimingControls").hidden = !musicalTiming;
  controls.pmChangeEvery.disabled = !musicalTiming;
  for (const option of controls.pmChangeEvery.options) {
    const count = Number(option.value), unit = controls.pmAutomation.value === "bars" ? "bar" : "beat";
    option.textContent = `${count} ${unit}${count === 1 ? "" : "s"}`;
  }
  const autoPattern = controls.pmRoutine.value === "auto";
  controls.pmPatternHold.disabled = !autoPattern;
  document.getElementById("pmNextPattern").disabled = !autoPattern;
  document.getElementById("pmFavorites").disabled = !autoPattern;
  controls.audioResponse.disabled = isDungeonMode();
  for (const id of ["atariPanel", "vm2Panel", "nethackPanel", "pixelmusicPanel"]) {
    const mode = id === "atariPanel" ? "atari" : id === "vm2Panel" ? "vm2" : id === "nethackPanel" ? "nethack" : "pixelmusic";
    document.getElementById(id).inert = controls.visualizerMode.value !== mode;
  }
}

function syncToolUI() {
  const textMode = controls.visualizerMode.value === "ascii";
  const family = textMode ? "text" : "video";
  document.getElementById("audioModeHelp").textContent = isDungeonMode()
    ? "Select Connected audio in NetHack. Bass lights the dungeon, mids accent creatures, and treble picks out treasure; BPM sets the turns."
    : "Select Connected audio in the synthesizer. Audio response chooses which part of each stereo channel drives its shapes.";
  controls.toolMode.value = family;
  if (!textMode) lastVideoMode = controls.visualizerMode.value;
  for (const element of document.querySelectorAll("[data-tools]")) {
    element.hidden = element.dataset.tools !== family;
    element.inert = element.hidden;
  }
  for (const option of controls.visualizerMode.options) {
    option.hidden = option.value === "ascii";
    option.disabled = option.hidden;
  }
  const nativePresets = new Set(["atariVideoMusic", "videoMusic2", "vm2Phosphor", "vm2Portrait", "nethackVideo", "pixelmusic3000"]);
  for (const option of controls.defaultScenePreset.options) {
    option.hidden = nativePresets.has(option.value) === textMode;
    option.disabled = option.hidden;
  }
  if (controls.defaultScenePreset.selectedOptions[0]?.disabled) {
    controls.defaultScenePreset.value = textMode ? "lyricPrism" : "atariVideoMusic";
  }
  const shortcutStrip = document.querySelector(".shortcut-strip");
  shortcutStrip.title = textMode
    ? "Escape exits, Space pauses, arrows change BPM, B toggles background, H toggles halo, I toggles invert, S toggles scanlines, M changes motion, 0 applies panic, and 1–8 recall scenes."
    : "Escape exits, Space pauses, arrows change BPM, I toggles invert, S toggles scanlines, and 1–8 recall scenes.";
  const randomizerHelp = isDungeonMode()
    ? ["Randomize dungeon layout, depth, and population", "Randomize camera, turns per beat, and fog", "Randomize dungeon palette, symbol glow, and audio dynamics", "Randomize tempo and turns per beat"] : textMode
    ? ["Randomize texture and detail", "Randomize word motion and masks", "Randomize text colours", "Randomize tempo and word timing"]
    : ["Randomize synthesizer shapes and response", "Randomize synthesizer motion and response", "Randomize synthesizer colours", "Randomize tempo and automatic scan timing"];
  ["randomizeVisual", "randomizeMotion", "randomizeColour", "randomizeTiming"].forEach((id, i) => {
    controls[id].title = randomizerHelp[i];
  });
  controls.fpsCap.options[0].title = textMode ? "Uses the default FPS for the selected quality." : "Up to 60 FPS.";
}

function updateAtariControls() {
  syncToolUI();
  const pixelmusicPanel = document.getElementById("pixelmusicPanel");
  pixelmusicPanel.hidden = controls.visualizerMode.value !== "pixelmusic";
  pixelmusicPanel.inert = pixelmusicPanel.hidden;
  document.getElementById("pixelmusicReadout").textContent = controls.pmInput.value === "demo"
    ? "Silent stereo demo. Enable Live preview to animate."
    : audioState.stream ? "Connected stereo audio drives pixel size and automatic changes."
      : "Waiting for audio. Open audio controls and connect a source.";
  const dungeonPanel = document.getElementById("nethackPanel");
  dungeonPanel.hidden = !isDungeonMode();
  dungeonPanel.inert = dungeonPanel.hidden;
  document.getElementById("nethackReadout").textContent = controls.nhInput.value === "demo"
    ? "The dungeon advances with the beat. Enable Live preview to explore."
    : audioState.stream ? "Audio drives dungeon lighting and accents; BPM advances each turn."
      : "Waiting for audio. Open audio controls and connect a source.";
  document.getElementById("nethackNew").disabled = controls.lockSeed.checked;
  document.getElementById("vm2Panel").hidden = controls.visualizerMode.value !== "vm2";
  document.getElementById("vm2CustomAspect").hidden = controls.vm2Aspect.value !== "custom";
  const vm2Auto = controls.vm2Shape.value === "auto";
  document.getElementById("vm2AutoControls").hidden = !vm2Auto;
  controls.vm2Columns.disabled = vm2Auto;
  controls.vm2Rows.disabled = vm2Auto;
  document.getElementById("vm2Readout").textContent = controls.vm2Input.value === "demo"
    ? "Silent demo signal. Enable Live preview to animate."
    : audioState.stream ? "Connected stereo audio. Gain and contour shape each channel."
      : "Waiting for audio. Open audio controls and connect a source.";
  document.getElementById("atariPanel").hidden = controls.visualizerMode.value !== "atari";
  const auto = controls.atariShape.value === "auto";
  document.getElementById("atariAutoControls").hidden = !auto;
  controls.atariHorizontal.disabled = auto;
  controls.atariVertical.disabled = auto;
  const readout = document.getElementById("atariReadout");
  readout.textContent = controls.atariInput.value === "demo"
    ? "Silent demo signal. Enable Live preview to animate."
    : audioState.stream
      ? "Connected audio drives L/R. For mono in Hole or Ring, try different L/R gains."
      : "Waiting for audio. Open audio controls and connect a source, then enable Live preview or press Go.";
}

function updatePixelmusicReadout(frame) {
  if (!frame) return;
  const pattern = Array.from(controls.pmRoutine.options).find(option => option.value === String(frame.activeRoutine))?.textContent || "Pattern";
  const timing = frame.options.pmAutomation === "original" ? "Original timing" : `Every ${frame.options.pmChangeEvery} ${frame.options.pmAutomation}`;
  const held = [frame.options.pmPatternHold && "pattern held", frame.options.pmPaletteHold && "palette held"].filter(Boolean);
  const waiting = controls.pmInput.value === "audio" && !audioState.stream ? " · waiting for audio" : "";
  const message = `${pattern} · ${frame.paletteFamily} · ${timing}${held.length ? ` · ${held.join(", ")}` : ""}${waiting}`;
  const output = document.getElementById("pixelmusicReadout");
  if (output.textContent !== message) output.textContent = message;
}

function nextPixelmusic(part) {
  if (controls.visualizerMode.value !== "pixelmusic" || (part === "pattern" && controls.pmRoutine.value !== "auto")) return;
  const action = part === "palette" ? "paletteNext" : "patternNext";
  if (state.running) {
    prepareStateFromControls(true);
    state.pixelmusicActions[action] += 1;
    const size = getCaptureSize();
    const frame = buildFrame(state.paused ? state.pausedAt : performance.now(), size.width, size.height, true);
    renderFrame(frame);
    updatePixelmusicReadout(frame.pixelmusic);
  } else {
    // Initialize before queuing a command so it is applied exactly once to the
    // existing picture, including when Live preview is off.
    clearTimeout(state.previewTimer);
    if (!state.previewPixelmusicFrame) renderPreview();
    state.previewPixelmusicActions[action] += 1;
    state.previewPrepared = null;
    renderPreview();
  }
}

function applyTooltips() {
  for (const [id, text] of Object.entries(helpText)) {
    const control = controls[id];
    if (!control) continue;
    control.title = text;
    const labelled = control.closest("label");
    if (labelled) labelled.title = text;
  }

  for (const [id, options] of Object.entries(optionHelpText)) {
    const select = controls[id];
    if (!select) continue;
    for (const option of select.options) {
      if (options[option.value]) option.title = options[option.value];
    }
  }

  if (controls.defaultScenePreset) {
    for (const option of controls.defaultScenePreset.options) {
      option.title = presetHelpText[option.value] || "Applies this built-in look to the current scene.";
    }
  }

  const maskSummary = document.querySelector(".mask-panel summary");
  if (maskSummary) maskSummary.title = "Open this panel to paste ASCII art and use it as a live visual mask.";

  for (const summary of document.querySelectorAll(".control-section > summary")) {
    if (!summary.title) summary.title = "Click to expand or collapse this group of controls.";
  }

  const shortcutStrip = document.querySelector(".shortcut-strip");
  if (shortcutStrip) shortcutStrip.title = "Useful controls while performing: Escape exits, Space pauses, arrows change BPM, B toggles background-only, H toggles halo, I toggles invert, S toggles scanlines, 0 applies panic, and 1-8 recall scenes.";
}

function openAudioControls() {
  const panel = document.getElementById("audioPanel");
  panel.open = true;
  panel.scrollIntoView({ block: "center", behavior: "smooth" });
  document.getElementById("connectAudio").focus({ preventScroll: true });
}

function bindUIEvents() {
  for (const control of [intervalMode, intervalMinutes]) {
    control.addEventListener("change", () => {
      updateContextualControls();
      resetSceneInterval(state.paused ? state.pausedAt : performance.now());
      saveSetup();
    });
  }

  controls.start.addEventListener("click", start);
  document.getElementById("stageMenu").addEventListener("click", stop);
  document.getElementById("stagePause").addEventListener("click", togglePause);
  controls.stage.addEventListener("pointermove", revealPlaybackControls);
  controls.stage.addEventListener("pointerdown", revealPlaybackControls);
  document.getElementById("revertScene").addEventListener("click", () => recallScene());
  for (const id of setupControls) {
    document.getElementById(id).addEventListener("change", () => {
      updateContextualControls();
      saveSetup();
      updateSceneDirty();
    });
  }
  controls.randomizeSeed.addEventListener("click", randomizeSeed);
  controls.copyPreset.addEventListener("click", copyPreset);
  controls.loadPreset.addEventListener("click", loadPreset);
  controls.copySceneBank.addEventListener("click", copySceneBank);
  controls.loadSceneBank.addEventListener("click", loadSceneBank);
  document.getElementById("importSceneFile").addEventListener("click", () => document.getElementById("sceneFile").click());
  document.getElementById("sceneFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > maxSceneBankJsonChars * 4) throw new Error("Scene file is too large.");
      controls.presetData.value = await file.text();
      loadPreset();
    } catch (error) {
      reportScene(`Scene file import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });
  controls.randomizeAll.addEventListener("click", randomizeAll);
  controls.tapTempo.addEventListener("click", tapTempo);
  controls.fullscreenButton.addEventListener("click", () => document.fullscreenElement ? exitFullscreen() : requestFullscreen());
  document.addEventListener("fullscreenchange", () => {
    controls.fullscreenButton.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
  });
  for (const id of ["audioSensitivity", "audioAttack", "audioRelease", "audioGate"]) {
    document.getElementById(id).addEventListener("input", () => {
      updateContextualControls();
      schedulePreview();
    });
  }
  controls.copyShareUrl.addEventListener("click", copyShareUrl);
  controls.copyObsUrl.addEventListener("click", copyObsUrl);
  controls.saveFrame.addEventListener("click", saveFrame);
  controls.panicButton.addEventListener("click", applyPanicLook);
  controls.connectMidi.addEventListener("click", connectMidi);
  controls.midiInput.addEventListener("change", attachMidiInput);
  controls.refreshPreview.addEventListener("click", () => renderPreview());
  controls.storeScene.addEventListener("click", () => storeScene());
  controls.clearScenes.addEventListener("click", clearScenes);
  controls.sceneSlots.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-slot]") : null;
    if (!button) return;
    const slot = Number(button.dataset.slot);
    selectSceneSlot(slot);
    if (event.shiftKey) storeScene(slot);
    else recallScene(slot);
  });
  controls.applyDefaultScene.addEventListener("click", () => applyNamedPreset(controls.defaultScenePreset.value));
  controls.randomizeVisual.addEventListener("click", () => {
    randomizeVisual();
    if (state.running) restartPlayback();
  });
  controls.randomizeMotion.addEventListener("click", () => {
    randomizeMotion();
    if (state.running) restartPlayback();
  });
  controls.randomizeColour.addEventListener("click", () => {
    randomizeColour();
    if (state.running) restartPlayback();
  });
  controls.randomizeTiming.addEventListener("click", () => {
    randomizeTiming();
    if (state.running) restartPlayback();
  });
  controls.midiSync.addEventListener("change", () => {
    if (controls.midiSync.checked && !state.midiAccess) connectMidi();
    if (!controls.midiSync.checked) setMidiStatus("off");
  });
  controls.livePreview.addEventListener("change", () => {
    state.previewStartedAt = performance.now() - (controls.visualizerMode.value === "pixelmusic" ? state.previewPixelmusicFrame?.elapsedMs ?? 0 : 0);
    state.lastPreviewFrameAt = 0;
    state.previewFpsSamples = [];
    state.currentPreviewFps = 0;
    if (controls.livePreview.checked) startPreviewLoop();
    else {
      stopPreviewLoop();
      renderPreview();
    }
  });
  window.addEventListener("resize", () => {
    if (state.running && state.paused && (state.currentFrame?.atari || state.currentFrame?.vm2 || state.currentFrame?.nethack || state.currentFrame?.pixelmusic)) {
      // Repaint the frozen snapshot at the new viewport size instead of stretching it.
      renderFrame(state.currentFrame);
    } else schedulePreview();
  });

  controls.toolMode.addEventListener("change", () => {
    controls.visualizerMode.value = controls.toolMode.value === "text" ? "ascii" : lastVideoMode;
    updateSliderReadouts();
    schedulePreview();
    if (state.running) restartPlayback();
  });
  controls.visualizerMode.addEventListener("change", updateSliderReadouts);
  controls.backgroundMode.addEventListener("change", updateSliderReadouts);
  controls.lockSeed.addEventListener("change", updateSliderReadouts);
  controls.scanlines.addEventListener("change", updateSliderReadouts);

  for (const control of [controls.glyphSize, controls.density, controls.glitch, controls.haloSize, controls.maskScale,
    ...Object.keys(atariDefaults).map(id => controls[id]), ...Object.keys(vm2Defaults).map(id => controls[id]),
    ...Object.keys(nethackDefaults).map(id => controls[id]), ...Object.keys(pixelmusicDefaults).map(id => controls[id]),
    ...Object.keys(displayDefaults).map(id => controls[id]), controls.visualizerMode, controls.backgroundMode]) {
    control.addEventListener("input", updateSliderReadouts);
  }

  for (const id of presetFields) {
    const control = controls[id];
    if (!control) continue;
    control.addEventListener(control.type === "checkbox" ? "change" : "input", schedulePreview);
    control.addEventListener("change", () => {
      if (lockedFields().has(id)) saveSetup();
    });
    if (control.tagName === "SELECT") control.addEventListener("change", schedulePreview);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      stop();
      exitFullscreen();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !state.running) {
      start();
      return;
    }
    const editing = event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement || event.target.isContentEditable;
    // Keep native keyboard activation intact for the playback toolbar and disclosure headings.
    if ((event.key === " " || event.key === "Enter") && (event.target instanceof HTMLButtonElement || event.target.closest?.("summary"))) return;
    const digit = /^(?:Digit|Numpad)([1-8])$/.exec(event.code);
    const sceneKey = digit ? digit[1] : /^[1-8]$/.test(event.key) ? event.key : "";
    if (sceneKey && (state.running || !editing) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!event.repeat) recallScene(Number(sceneKey));
      return;
    }
    if (!state.running && (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLButtonElement ||
      event.target.isContentEditable
    )) return;
    if ((event.key === "t" || event.key === "T") && !state.running) tapTempo();
    if (event.key === " " && !state.running) {
      event.preventDefault();
      if (!controls.livePreview.checked) {
        controls.livePreview.checked = true;
        controls.livePreview.dispatchEvent(new Event("change"));
      }
    }
    if (event.key === " " && state.running) {
      event.preventDefault();
      togglePause();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeBpm(event.shiftKey ? 5 : 1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeBpm(event.shiftKey ? -5 : -1);
    }
    const textMode = controls.visualizerMode.value === "ascii";
    if (textMode && event.key === "0") applyPanicLook();
    if (textMode && (event.key === "b" || event.key === "B")) toggleRunningCheckbox(controls.backgroundOnly);
    if (textMode && (event.key === "h" || event.key === "H")) toggleRunningCheckbox(controls.wordHalo);
    if (event.key === "i" || event.key === "I") toggleRunningCheckbox(controls.invert);
    if (event.key === "s" || event.key === "S") toggleRunningCheckbox(controls.scanlines);
    if (textMode && (event.key === "m" || event.key === "M")) cycleSelect(controls.wordMotion);
  });

  document.getElementById("connectAudio").addEventListener("click", connectAudio);
  document.getElementById("disconnectAudio").addEventListener("click", () => disconnectAudio());
  document.getElementById("atariStart").addEventListener("click", start);
  document.getElementById("vm2Start").addEventListener("click", start);
  document.getElementById("nethackStart").addEventListener("click", start);
  document.getElementById("pixelmusicStart").addEventListener("click", start);
  document.getElementById("pmNextPattern").addEventListener("click", () => nextPixelmusic("pattern"));
  document.getElementById("pmNextPalette").addEventListener("click", () => nextPixelmusic("palette"));
  document.getElementById("nethackNew").addEventListener("click", () => {
    if (!controls.lockSeed.checked) randomizeSeed();
  });
  document.getElementById("vm2Shuffle").addEventListener("click", () => randomizeVideoMusic2());
  document.getElementById("vm2Reset").addEventListener("click", () => {
    applyPreset({ ...getPreset(), ...vm2Defaults });
    schedulePreview();
  });

  document.getElementById("atariAudioSetup").addEventListener("click", openAudioControls);
  document.getElementById("vm2AudioSetup").addEventListener("click", openAudioControls);
  document.getElementById("nethackAudioSetup").addEventListener("click", openAudioControls);
  document.getElementById("pixelmusicAudioSetup").addEventListener("click", openAudioControls);
  window.addEventListener("pagehide", () => { disconnectAudio(); clearSceneTransition(); });
}
