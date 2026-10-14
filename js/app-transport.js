"use strict";

// Playback, pause, tempo, MIDI clock, fullscreen, and interval transport.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function requestFullscreen() {
  const target = controls.stage.hidden ? document.documentElement : controls.stage;
  if (target.requestFullscreen) {
    const request = target.requestFullscreen();
    if (request && typeof request.catch === "function") request.catch(() => {});
  }
}

function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    const request = document.exitFullscreen();
    if (request && typeof request.catch === "function") request.catch(() => {});
  }
}

function tapTempo() {
  const now = performance.now();
  state.tapTimes = state.tapTimes.filter((time) => now - time < 5000);
  state.tapTimes.push(now);

  if (state.tapTimes.length < 2) {
    controls.tapReadout.textContent = "Tap BPM: --";
    return;
  }

  const intervals = [];
  for (let i = 1; i < state.tapTimes.length; i += 1) {
    intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
  }
  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const bpm = clamp(Math.round(60000 / average), 20, 360);
  controls.bpm.value = bpm;
  controls.tapReadout.textContent = `Tap BPM: ${bpm}`;
  schedulePreview();
}

function setMidiStatus(message) {
  controls.midiReadout.textContent = `MIDI: ${message}`;
}

function populateMidiInputs() {
  controls.midiInput.replaceChildren(new Option("No MIDI input", ""));
  if (!state.midiAccess) return;

  for (const input of state.midiAccess.inputs.values()) {
    const option = document.createElement("option");
    option.value = input.id;
    option.textContent = input.name || input.manufacturer || input.id;
    controls.midiInput.appendChild(option);
  }

  if (state.midiInputId && state.midiAccess.inputs.has(state.midiInputId)) {
    controls.midiInput.value = state.midiInputId;
  }
}

function attachMidiInput() {
  if (!state.midiAccess) return;

  for (const input of state.midiAccess.inputs.values()) {
    input.onmidimessage = null;
  }

  const selectedId = controls.midiInput.value;
  state.midiInputId = selectedId;
  const input = selectedId ? state.midiAccess.inputs.get(selectedId) : null;
  if (!input) {
    setMidiStatus("no input");
    return;
  }

  state.midiInputId = input.id;
  controls.midiInput.value = input.id;
  input.onmidimessage = handleMidiMessage;
  setMidiStatus(input.name || "connected");
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    setMidiStatus("not supported");
    return;
  }

  try {
    state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess.onstatechange = () => {
      populateMidiInputs();
      attachMidiInput();
    };
    populateMidiInputs();
    if (!controls.midiInput.value) controls.midiInput.value = state.midiAccess.inputs.keys().next().value || "";
    attachMidiInput();
    controls.midiSync.checked = true;
    schedulePreview();
    if (lockedFields().has("midiSync")) saveSetup();
  } catch (error) {
    setMidiStatus("permission denied");
  }
}

function resetMidiClock(now = performance.now()) {
  state.midiClockTimes = [];
  state.midiPulseCount = 0;
  state.midiStartedAt = now;
  if (state.running) state.startedAt = now;
}

function handleMidiClock(now) {
  state.midiPulseCount += 1;
  state.midiClockTimes.push(now);
  state.midiClockTimes = state.midiClockTimes.filter((time) => now - time < 2400).slice(-96);

  if (state.midiClockTimes.length >= 12) {
    const first = state.midiClockTimes[0];
    const last = state.midiClockTimes[state.midiClockTimes.length - 1];
    const averageClockMs = (last - first) / (state.midiClockTimes.length - 1);
    const bpm = clamp(Math.round(60000 / (averageClockMs * 24)), 20, 360);
    if (Number(controls.bpm.value) !== bpm) nudgeBpm(bpm - Number(controls.bpm.value), now);
    setMidiStatus(`${bpm} BPM`);
  }

  if (state.running && !state.paused && state.midiPulseCount % 24 === 0) {
    const beatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, Math.round((now - state.startedAt) / beatMs));
    state.startedAt = now - elapsedBeats * beatMs;
  }
}

function handleMidiMessage(event) {
  if (!controls.midiSync.checked) return;
  const status = event.data[0];
  const now = typeof event.receivedTime === "number" ? event.receivedTime : performance.now();

  if (status === 0xF8) {
    handleMidiClock(now);
  } else if (status === 0xFA) {
    if (state.running) {
      state.paused = false;
      restartPlayback();
    } else start();
    resetMidiClock(now);
  } else if (status === 0xFB) {
    if (!state.running) start();
    else if (state.paused) togglePause();
  } else if (status === 0xFC) {
    stop();
    resetMidiClock(now);
  }
}

function restartPlayback(fade = false) {
  if (!state.running) return;
  clearSceneTransition();
  const wasPaused = state.paused;
  cancelAnimationFrame(state.raf);
  state.pendingPreset = null;
  prepareStateFromControls();
  state.lastBeat = -1;
  state.lastRenderAt = 0;
  state.lastFrameAt = 0;
  state.fpsSamples = [];
  state.currentFps = 0;
  state.paused = wasPaused;
  state.pausedAt = wasPaused ? state.startedAt : 0;
  updatePlaybackControls();
  resetSceneInterval(state.startedAt);
  controls.ascii.style.fontSize = `${getEffectiveGlyphSize()}px`;
  controls.ascii.style.lineHeight = `${getEffectiveGlyphSize()}px`;
  applyStagePalette();
  applyPresentationClasses(controls.stage, state.options);
  controls.stageHud.hidden = !state.options.stageBeatIndicator;
  if (wasPaused) {
    const capture = getCaptureSize();
    renderFrame(buildFrame(state.pausedAt, capture.width, capture.height, true));
  } else {
    state.raf = requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (!state.running) return;
  const now = performance.now();
  if (state.paused) {
    if (activeSceneTransition) activeSceneTransition.animations.forEach(animation => animation.play());
    state.startedAt += now - state.pausedAt;
    state.intervalDueAt += now - state.pausedAt;
    state.paused = false;
    state.lastRenderAt = 0;
    state.raf = requestAnimationFrame(loop);
  } else {
    if (activeSceneTransition) activeSceneTransition.animations.forEach(animation => animation.pause());
    state.paused = true;
    cancelAnimationFrame(state.raf);
    state.pausedAt = now;
  }
  controls.stageInfo.textContent = state.paused ? `Paused / ${state.currentFps || 0} FPS` : getStatusText(state.options, state.currentFps);
  updatePlaybackControls();
}

let stageControlsTimer = 0;
let playbackOrigin = null;

function updatePlaybackControls() {
  const pause = document.getElementById("stagePause");
  pause.textContent = state.paused ? "Resume" : "Pause";
  pause.setAttribute("aria-pressed", String(state.paused));
  pause.disabled = !state.running;
}

function revealPlaybackControls() {
  controls.stage.classList.add("controls-visible");
  clearTimeout(stageControlsTimer);
  stageControlsTimer = setTimeout(() => controls.stage.classList.remove("controls-visible"), 2200);
}

function nudgeBpm(delta, clockNow = performance.now()) {
  const bpm = clamp((Number(controls.bpm.value) || 120) + delta, 20, 360);
  controls.bpm.value = bpm;
  if (state.running) {
    const now = state.paused ? state.pausedAt : clockNow;
    const oldBeatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, (now - state.startedAt) / oldBeatMs);
    state.options.bpm = bpm;
    state.startedAt = now - elapsedBeats * (60000 / bpm);
    controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
  } else {
    schedulePreview();
  }
  updateSceneDirty();
  if (lockedFields().has("bpm")) saveSetup();
}

function toggleRunningCheckbox(control) {
  control.checked = !control.checked;
  updateSliderReadouts();
  if (!state.running) {
    schedulePreview();
    return;
  }
  state.options[control.id] = control.checked;
  applyPresentationClasses(controls.stage, state.options);
  updateSceneDirty();
  if (lockedFields().has(control.id)) saveSetup();
}

function cycleSelect(control) {
  control.selectedIndex = (control.selectedIndex + 1) % control.options.length;
  if (state.running) restartPlayback();
  else schedulePreview();
}

function applyPanicLook() {
  const preset = {
    ...getPreset(),
    visualizerMode: "ascii",
    colorMode: "spotlight",
    backgroundMode: "ray",
    charsetPreset: "minimal",
    beatRate: "1",
    wordMotion: "pulse",
    quality: "medium",
    fpsCap: "45",
    legibilityMode: "readable",
    glyphSize: "14",
    density: "1",
    glitch: "8",
    wordHalo: true,
    haloSize: "8",
    backgroundOnly: false,
    beatFlash: false,
    downbeatFlash: false,
    scanlines: true,
    invert: false
  };
  state.pendingPreset = null;
  applyPresetNow(preset, true);
  controls.sceneReadout.textContent = "Panic look applied";
}

function applyStagePalette() {
  const palette = palettePresets[state.options.palette] || palettePresets.cyber;
  const foreground = `hsl(${palette.leadHue} ${palette.saturation}% ${palette.light}%)`;
  const glowA = `hsla(${palette.bgHue} ${palette.bgSat}% 58% / 0.46)`;
  const glowB = `hsla(${palette.leadHue} ${palette.saturation}% 58% / 0.28)`;
  const glowC = `hsla(${palette.secondaryHue} ${palette.saturation}% 58% / 0.2)`;
  controls.ascii.style.color = foreground;
  controls.ascii.style.textShadow = `0 0 6px ${glowA}, 2px 0 0 ${glowB}, -2px 0 0 ${glowC}`;
}

function loop(now) {
  if (!state.running) return;
  if (state.paused) return;
  const frameInterval = getFrameInterval();
  if (frameInterval && now - state.lastRenderAt < frameInterval) {
    state.raf = requestAnimationFrame(loop);
    return;
  }

  try {
    if (advanceSceneInterval(now)) return;
    state.lastRenderAt = now;
    const capture = getCaptureSize();
    const frame = buildFrame(now, capture.width, capture.height);
    renderFrame(frame);
    trackFps(now);
    if (state.options.stageBeatIndicator) controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
    if (maybeApplyQueuedPreset(frame)) return;
    state.raf = requestAnimationFrame(loop);
  } catch (error) {
    showRenderError(error);
  }
}

function showRenderError(error) {
  clearSceneTransition();
  state.running = false;
  updatePlaybackControls();
  revealPlaybackControls();
  cancelAnimationFrame(state.raf);
  const message = error && error.message ? error.message : String(error);
  controls.canvas.hidden = true;
  controls.ascii.hidden = false;
  controls.ascii.classList.remove("colorized");
  controls.ascii.textContent = [
    "ASCII RENDER ERROR",
    "",
    message,
    "",
    "Press Escape to return to the menu."
  ].join("\n");
}

function resetSceneInterval(now = performance.now()) {
  const minutes = clamp(Number(intervalMinutes.value) || 1, 0.1, 1440);
  intervalMinutes.value = String(minutes);
  state.intervalDueAt = now + minutes * 60000;
}

function advanceSceneInterval(now) {
  if (!intervalMode.checked || now < state.intervalDueAt || state.pendingPreset) return false;
  resetSceneInterval(now);
  for (let offset = 1; offset <= sceneSlotCount; offset += 1) {
    const slot = (state.selectedSceneSlot - 1 + offset) % sceneSlotCount + 1;
    if (state.scenes[slot - 1]) {
      const immediate = controls.transitionMode.value === "cut";
      recallScene(slot);
      return immediate;
    }
  }
  return false;
}

function start() {
  if (state.running) return;
  playbackOrigin = controls.menu.contains(document.activeElement) ? document.activeElement : controls.toolMode;
  state.pendingPreset = null;
  if (intervalMode.checked && !state.running) {
    if (state.scenes[state.selectedSceneSlot - 1]) {
      recallScene(state.selectedSceneSlot);
    } else {
      const first = state.scenes.findIndex(Boolean);
      if (first !== -1) recallScene(first + 1);
    }
  }
  resetSceneInterval();
  stopPreviewLoop();
  prepareStateFromControls();
  state.lastBeat = -1;
  state.lastRenderAt = 0;
  state.running = true;
  state.paused = false;
  state.pausedAt = 0;
  updatePlaybackControls();

  controls.ascii.textContent = "";
  controls.ascii.style.fontSize = `${getEffectiveGlyphSize()}px`;
  controls.ascii.style.lineHeight = `${getEffectiveGlyphSize()}px`;
  applyStagePalette();
  applyPresentationClasses(controls.stage, state.options);
  controls.stageHud.hidden = !state.options.stageBeatIndicator;
  controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
  controls.menu.hidden = true;
  controls.stage.hidden = false;
  controls.stage.focus({ preventScroll: true });
  document.body.style.overflow = "hidden";
  document.body.classList.add("playing");
  if (!state.options.recordingMode) revealPlaybackControls();
  if (state.options.fullscreenOnStart) requestFullscreen();
  loop(state.startedAt);
}

function stop() {
  clearSceneTransition();
  if (!state.running && controls.stage.hidden && !document.body.classList.contains("playing")) return;
  state.running = false;
  state.paused = false;
  updatePlaybackControls();
  clearTimeout(stageControlsTimer);
  controls.stage.classList.remove("controls-visible");
  cancelAnimationFrame(state.raf);
  controls.canvas.hidden = true;
  controls.ascii.hidden = false;
  controls.stageHud.hidden = true;
  controls.stage.hidden = true;
  controls.menu.hidden = false;
  const focusTarget = playbackOrigin?.getClientRects().length ? playbackOrigin : controls.toolMode;
  focusTarget.focus({ preventScroll: true });
  document.body.style.overflow = "";
  document.body.classList.remove("playing");
  exitFullscreen();
  schedulePreview();
}
