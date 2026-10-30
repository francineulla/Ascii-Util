"use strict";

// Playback, pause, tempo, MIDI clock, fullscreen, and interval transport.
// Classic scripts share app-state.js bindings so index.html also works over file://.

const midiSession = {
  request: null, generation: 0, input: null, timer: 0, uiTimer: 0, installed: false,
  lastClockAt: null, lastArrivalAt: null, waitingAt: 0, clockLost: false, stoppedTransport: null
};
const playbackSession = { generation: 0 };

function notifyPlaybackChanged() {
  // Auxiliary persistence and browser integrations must not stop the stage.
  const callbacks = [typeof historyPlaybackChanged === "function" ? historyPlaybackChanged : null,
    typeof galleryPlaybackChanged === "function" ? galleryPlaybackChanged : null,
    typeof livePlaybackChanged === "function" ? livePlaybackChanged : null];
  for (const callback of callbacks) if (callback) {
    try { callback(); } catch (error) { console.warn("A playback lifecycle update failed."); }
  }
}

function cancelPlaybackFrame() {
  playbackSession.generation++;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
}

function schedulePlaybackFrame() {
  if (!state.running || state.paused) return;
  cancelAnimationFrame(state.raf);
  const generation = playbackSession.generation;
  state.raf = requestAnimationFrame(now => {
    if (generation !== playbackSession.generation) return;
    state.raf = 0;
    loop(now);
  });
}

function requestFullscreen() {
  try {
    const target = controls.stage.hidden ? document.documentElement : controls.stage;
    if (target.requestFullscreen) {
      const request = target.requestFullscreen();
      if (request && typeof request.catch === "function") request.catch(() => {});
    }
  } catch (error) { /* Browser fullscreen is optional. */ }
}

function exitFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      const request = document.exitFullscreen();
      if (request && typeof request.catch === "function") request.catch(() => {});
    }
  } catch (error) { /* Setup remains available if fullscreen cannot exit. */ }
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
  if (!Number.isFinite(average) || average <= 0) return;
  const bpm = clamp(Math.round(60000 / average), 20, 360);
  nudgeBpm(bpm - (Number(controls.bpm.value) || 120), now);
  controls.tapReadout.textContent = `Tap BPM: ${bpm}`;
}

function setMidiStatus(message) {
  const text = `MIDI: ${message}`;
  if (controls.midiReadout.textContent !== text) controls.midiReadout.textContent = text;
}

function midiFreeRunning(reason) {
  setMidiStatus(`${reason} · free-running at ${Number(controls.bpm.value) || 120} BPM`);
}

function resetMidiTracking() {
  state.midiClockTimes = [];
  state.midiPulseCount = 0;
  midiSession.lastClockAt = null;
  midiSession.lastArrivalAt = null;
  midiSession.waitingAt = performance.now();
  midiSession.clockLost = false;
}

function checkMidiClockHealth(now = performance.now()) {
  if (!controls.midiSync.checked) {
    clearInterval(midiSession.timer); midiSession.timer = 0;
    setMidiStatus("off");
    return;
  }
  if (!Number.isFinite(now)) return;
  if (midiSession.lastArrivalAt !== null && now - midiSession.lastArrivalAt > 1500) {
    if (!midiSession.clockLost) {
      state.midiClockTimes = [];
      midiSession.clockLost = true;
      midiFreeRunning("clock lost");
    }
  } else if (midiSession.input && midiSession.lastArrivalAt === null && now - midiSession.waitingAt > 1500) {
    midiFreeRunning("waiting for clock");
  }
}

function initMidiTransport() {
  if (midiSession.installed) return;
  midiSession.installed = true;
  controls.midiSync.addEventListener("change", reconcileMidiSync);
  window.addEventListener("pagehide", disconnectMidi);
}

function reconcileMidiSync() {
  if (!controls.midiSync.checked) {
    if (midiSession.request) {
      midiSession.generation++;
      midiSession.request = null;
      controls.connectMidi.disabled = false;
    }
    checkMidiClockHealth();
    return;
  }
  if (!state.midiAccess) return;
  const restarting = !midiSession.timer;
  if (restarting) resetMidiTracking();
  attachMidiInput();
  if (restarting && midiSession.input) midiFreeRunning(`${midiSession.input.name || "input connected"} · waiting for clock`);
  else checkMidiClockHealth();
}

function disconnectMidi() {
  midiSession.generation++;
  clearInterval(midiSession.timer); midiSession.timer = 0;
  clearTimeout(midiSession.uiTimer); midiSession.uiTimer = 0;
  if (midiSession.input) midiSession.input.onmidimessage = null;
  if (state.midiAccess) state.midiAccess.onstatechange = null;
  midiSession.input = null;
  midiSession.request = null;
  midiSession.stoppedTransport = null;
  state.midiAccess = null;
  resetMidiTracking();
  if (controls.connectMidi) controls.connectMidi.disabled = false;
  midiFreeRunning("disconnected");
}

function populateMidiInputs() {
  controls.midiInput.replaceChildren(new Option("No MIDI input", ""));
  if (!state.midiAccess) return;

  for (const input of state.midiAccess.inputs.values()) {
    if (input.state === "disconnected") continue;
    const option = document.createElement("option");
    option.value = input.id;
    option.textContent = input.name || input.manufacturer || input.id;
    controls.midiInput.appendChild(option);
  }

  if (state.midiInputId) {
    if (!Array.from(controls.midiInput.options).some(option => option.value === state.midiInputId)) {
      controls.midiInput.add(new Option("Selected input · disconnected", state.midiInputId));
    }
    controls.midiInput.value = state.midiInputId;
  }
}

function attachMidiInput() {
  if (!state.midiAccess) return;
  const selectedId = controls.midiInput.value;
  state.midiInputId = selectedId;
  const input = selectedId ? state.midiAccess.inputs.get(selectedId) : null;
  if (midiSession.input && midiSession.input !== input) midiSession.input.onmidimessage = null;
  if (!input || input.state === "disconnected") {
    if (midiSession.input) midiSession.input.onmidimessage = null;
    midiSession.input = null;
    clearInterval(midiSession.timer); midiSession.timer = 0;
    resetMidiTracking();
    midiFreeRunning(selectedId ? "input disconnected" : "no input");
    return;
  }
  const changed = midiSession.input !== input;
  midiSession.input = input;
  state.midiInputId = input.id;
  controls.midiInput.value = input.id;
  input.onmidimessage = handleMidiMessage;
  if (changed) {
    resetMidiTracking();
    midiFreeRunning(`${input.name || "input connected"} · waiting for clock`);
  }
  if (controls.midiSync.checked && !midiSession.timer) midiSession.timer = setInterval(checkMidiClockHealth, 250);
  if (!controls.midiSync.checked) setMidiStatus("off");
}

async function connectMidi() {
  initMidiTransport();
  if (midiSession.request) return midiSession.request;
  if (state.midiAccess) {
    controls.midiSync.checked = true;
    populateMidiInputs(); attachMidiInput();
    return;
  }
  if (!navigator.requestMIDIAccess) {
    setMidiStatus("not supported");
    return;
  }

  const generation = midiSession.generation;
  controls.connectMidi.disabled = true;
  setMidiStatus("waiting for permission");
  const request = (async () => { try {
    const access = await Promise.resolve().then(() => navigator.requestMIDIAccess({ sysex: false }));
    if (generation !== midiSession.generation) return;
    state.midiAccess = access;
    state.midiAccess.onstatechange = () => {
      populateMidiInputs();
      attachMidiInput();
    };
    populateMidiInputs();
    if (!controls.midiInput.value) controls.midiInput.value = Array.from(state.midiAccess.inputs.values()).find(input => input.state !== "disconnected")?.id || "";
    controls.midiSync.checked = true;
    attachMidiInput();
    schedulePreview();
    if (lockedFields().has("midiSync")) saveSetup();
  } catch (error) {
    if (generation === midiSession.generation) midiFreeRunning("permission denied");
  } finally {
    if (generation === midiSession.generation) {
      midiSession.request = null;
      controls.connectMidi.disabled = false;
    }
  } })();
  midiSession.request = request;
  return request;
}

function resetMidiClock(now = performance.now()) {
  if (!Number.isFinite(now)) now = performance.now();
  resetMidiTracking();
  state.midiStartedAt = now;
  if (state.running) state.startedAt = now;
}

function handleMidiClock(now) {
  if (!Number.isFinite(now) || now < 0 || midiSession.lastClockAt !== null && now <= midiSession.lastClockAt) return;
  const previousClock = midiSession.lastClockAt;
  if (previousClock !== null && now - previousClock < 3) return;
  // Preset and history changes set checked directly. Keep health monitoring
  // alive even when a caller has not dispatched a native checkbox event.
  if (controls.midiSync.checked && midiSession.input && !midiSession.timer) midiSession.timer = setInterval(checkMidiClockHealth, 250);
  if (midiSession.clockLost || previousClock !== null && now - previousClock > 1500) {
    state.midiClockTimes = [];
    state.midiPulseCount = 0;
  }
  midiSession.clockLost = false;
  midiSession.lastClockAt = now;
  midiSession.lastArrivalAt = performance.now();
  state.midiPulseCount += 1;
  state.midiClockTimes.push(now);
  state.midiClockTimes = state.midiClockTimes.filter((time) => now - time < 2400).slice(-96);

  if (state.midiClockTimes.length >= 12) {
    const intervals = state.midiClockTimes.slice(1).map((time, index) => time - state.midiClockTimes[index]);
    const sorted = intervals.slice().sort((first, second) => first - second);
    const median = sorted[Math.floor(sorted.length / 2)];
    const regular = intervals.filter(interval => interval >= median * 0.5 && interval <= median * 1.5);
    const averageClockMs = regular.reduce((sum, interval) => sum + interval, 0) / regular.length;
    const bpm = clamp(Math.round(60000 / (averageClockMs * 24)), 20, 360);
    if (Number.isFinite(averageClockMs) && averageClockMs > 0 && Number(controls.bpm.value) !== bpm) setPlaybackTempo(bpm, now, false);
    setMidiStatus(`clock locked · ${bpm} BPM`);
  } else if (state.midiClockTimes.length === 1) setMidiStatus("clock detected · acquiring tempo");

  if (state.running && !state.paused && state.midiPulseCount % 24 === 0) {
    const beatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, Math.round((now - state.startedAt) / beatMs));
    state.startedAt = now - elapsedBeats * beatMs;
  }
}

function handleMidiMessage(event) {
  if (!controls.midiSync.checked || !event?.data?.length) return;
  const status = event.data[0];
  const received = typeof event.receivedTime === "number" ? event.receivedTime : typeof event.timeStamp === "number" ? event.timeStamp : performance.now();
  const arrival = performance.now();
  if (!Number.isFinite(received) || received < 0 || received > arrival + 1000 || received < arrival - 5000) return;
  const now = received;

  if (status === 0xF8) {
    handleMidiClock(now);
  } else if (status === 0xFA) {
    midiSession.stoppedTransport = null;
    if (state.running) {
      state.paused = false;
      restartPlayback();
    } else start();
    resetMidiClock(now);
  } else if (status === 0xFB) {
    if (!state.running) {
      if (midiSession.stoppedTransport) midiSession.stoppedTransport.resumeAt = now;
      start(midiSession.stoppedTransport);
    }
    else if (state.paused) togglePause();
  } else if (status === 0xFC) {
    const position = state.running ? captureMidiStopPosition(now) : midiSession.stoppedTransport;
    stop();
    midiSession.stoppedTransport = position;
    resetMidiClock(now);
  }
}

function captureMidiStopPosition(now) {
  const timelineNow = state.paused ? state.pausedAt : now;
  return {
    elapsedBeats: Math.max(0, timelineNow - state.startedAt) * state.options.bpm / 60000,
    intervalRemaining: Math.max(0, state.intervalDueAt - timelineNow), pendingPreset: state.pendingPreset,
    visualizerMode: state.options.visualizerMode, seedValue: state.seedValue,
    vm2Frame: state.vm2Frame, pixelmusicFrame: state.pixelmusicFrame, pixelmusicActions: state.pixelmusicActions,
    lastBeat: state.lastBeat
  };
}

function restartPlayback(fade = false) {
  if (!state.running) return;
  try {
    clearSceneTransition();
    const wasPaused = state.paused;
    cancelPlaybackFrame();
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
      const recovery = document.getElementById("renderRecovery");
      if (recovery) recovery.hidden = true;
    } else {
      schedulePlaybackFrame();
    }
  } catch (error) { showRenderError(error); }
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
    schedulePlaybackFrame();
  } else {
    if (activeSceneTransition) activeSceneTransition.animations.forEach(animation => animation.pause());
    state.paused = true;
    cancelPlaybackFrame();
    state.pausedAt = now;
  }
  controls.stageInfo.textContent = state.paused ? `Paused / ${state.currentFps || 0} FPS` : getStatusText(state.options, state.currentFps);
  updatePlaybackControls();
  notifyPlaybackChanged();
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

function setPlaybackTempo(value, clockNow = performance.now(), manual = true) {
  if (!Number.isFinite(value)) return;
  const bpm = clamp(value, 20, 360);
  controls.bpm.value = bpm;
  if (state.running) {
    const now = state.paused ? state.pausedAt : clockNow;
    const oldBeatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, (now - state.startedAt) / oldBeatMs);
    state.options.bpm = bpm;
    state.startedAt = now - elapsedBeats * (60000 / bpm);
    controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
  } else if (manual) {
    schedulePreview();
  } else {
    // Keep parsed lyrics, trails, and active automation when only external
    // tempo changes. MIDI must never enter edit history or synchronous storage.
    if (state.previewPrepared) state.previewPrepared.options.bpm = bpm;
  }
  if (manual) {
    updateSceneDirty();
    if (lockedFields().has("bpm")) saveSetup();
  } else {
    if (typeof historyExternalTempoChanged === "function") historyExternalTempoChanged();
    if (!midiSession.uiTimer) {
      midiSession.uiTimer = setTimeout(() => {
        midiSession.uiTimer = 0;
        updateSceneDirty();
        if (!state.running) {
          if (controls.livePreview.checked) startPreviewLoop();
          else renderPreview();
        }
      }, 100);
    }
  }
}

function nudgeBpm(delta, clockNow = performance.now()) {
  if (!Number.isFinite(delta)) return;
  setPlaybackTempo((Number(controls.bpm.value) || 120) + delta, clockNow, true);
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
  try {
    if (!Number.isFinite(now)) now = performance.now();
    const frameInterval = getFrameInterval();
    if (frameInterval && now - state.lastRenderAt < frameInterval) {
      schedulePlaybackFrame();
      return;
    }
    if (advanceSceneInterval(now)) return;
    state.lastRenderAt = now;
    const capture = getCaptureSize();
    const frame = buildFrame(now, capture.width, capture.height);
    renderFrame(frame);
    const recovery = document.getElementById("renderRecovery");
    if (recovery) recovery.hidden = true;
    trackFps(now);
    if (state.options.stageBeatIndicator) controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
    if (maybeApplyQueuedPreset(frame)) return;
    schedulePlaybackFrame();
  } catch (error) {
    showRenderError(error);
  }
}

function showRenderError(error) {
  clearSceneTransition();
  state.running = false;
  state.paused = false;
  state.pendingPreset = null;
  updatePlaybackControls();
  revealPlaybackControls();
  cancelPlaybackFrame();
  const message = error && error.message ? error.message : String(error);
  const recovery = document.getElementById("renderRecovery"), details = document.getElementById("renderErrorMessage");
  if (details) details.textContent = message;
  if (recovery) recovery.hidden = false;
  controls.stage.hidden = false;
  controls.menu.hidden = true;
  document.body.classList.add("playing");
  const output = state.lastGoodOutput;
  if (output && state.currentFrame) {
    controls.canvas.hidden = !output.canvas;
    controls.ascii.hidden = output.canvas;
    controls.ascii.classList.toggle("colorized", output.canvas);
    const failedOptions = state.options;
    try {
      state.options = output.options;
      const fontSize = `${getEffectiveGlyphSize()}px`;
      controls.ascii.style.fontSize = fontSize;
      controls.ascii.style.lineHeight = fontSize;
      applyStagePalette();
      applyPresentationClasses(controls.stage, output.options);
    } finally { state.options = failedOptions; }
  } else if (!state.currentFrame) {
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
  notifyPlaybackChanged();
}

function resetSceneInterval(now = performance.now()) {
  if (!Number.isFinite(now)) now = performance.now();
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

function start(resumePosition = null) {
  if (state.running) return;
  // Native click events also reach start; only our saved MIDI stop position
  // authorizes continuing a stopped timeline instead of starting a new one.
  const resume = resumePosition && resumePosition === midiSession.stoppedTransport ? resumePosition : null;
  midiSession.stoppedTransport = null;
  try {
    cancelPlaybackFrame();
    playbackOrigin = controls.menu.contains(document.activeElement) ? document.activeElement : controls.toolMode;
    state.pendingPreset = null;
    if (intervalMode.checked && !resume) {
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
    if (resume) {
      state.startedAt = resume.resumeAt - resume.elapsedBeats * 60000 / state.options.bpm;
      state.intervalDueAt = resume.resumeAt + resume.intervalRemaining;
      state.pendingPreset = resume.pendingPreset;
      if (state.options.visualizerMode === resume.visualizerMode && state.seedValue === resume.seedValue) {
        state.vm2Frame = resume.vm2Frame;
        state.pixelmusicFrame = resume.pixelmusicFrame;
        state.pixelmusicActions = resume.pixelmusicActions;
      }
    }
    state.lastBeat = resume ? resume.lastBeat : -1;
    state.lastRenderAt = 0;
    state.running = true;
    state.paused = false;
    state.pausedAt = 0;
    updatePlaybackControls();
    notifyPlaybackChanged();
    if (!state.currentFrame) controls.ascii.textContent = "";
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
    loop(resume ? resume.resumeAt : state.startedAt);
  } catch (error) { showRenderError(error); }
}

function stop() {
  midiSession.stoppedTransport = null;
  clearSceneTransition();
  if (!state.running && controls.stage.hidden && !document.body.classList.contains("playing")) return;
  state.running = false;
  state.paused = false;
  updatePlaybackControls();
  clearTimeout(stageControlsTimer);
  controls.stage.classList.remove("controls-visible");
  cancelPlaybackFrame();
  controls.canvas.hidden = true;
  controls.ascii.hidden = false;
  controls.stageHud.hidden = true;
  controls.stage.hidden = true;
  controls.menu.hidden = false;
  const focusTarget = playbackOrigin?.getClientRects().length ? playbackOrigin : controls.toolMode;
  focusTarget.focus({ preventScroll: true });
  document.body.style.overflow = "";
  document.body.classList.remove("playing");
  const recovery = document.getElementById("renderRecovery");
  if (recovery) recovery.hidden = true;
  exitFullscreen();
  notifyPlaybackChanged();
  schedulePreview();
}
