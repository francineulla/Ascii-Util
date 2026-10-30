"use strict";

// Playback protection is optional and never prevents starting a show.
const liveProtection = { sentinel: null, pending: false, generation: 0, initialized: false };

function liveStatus(message) {
  const output = document.getElementById("liveReadout");
  if (output && output.textContent !== message) output.textContent = message;
}

function releaseScreenProtection() {
  liveProtection.generation++;
  liveProtection.pending = false;
  const sentinel = liveProtection.sentinel;
  liveProtection.sentinel = null;
  if (sentinel) {
    try { Promise.resolve(sentinel.release()).catch(() => {}); } catch (error) { /* Already released by the system. */ }
  }
}

async function livePlaybackChanged() {
  const enabled = document.getElementById("keepAwake")?.checked;
  if (!state.running || document.hidden || !enabled) {
    releaseScreenProtection();
    liveStatus(!enabled ? "Screen protection off" : document.hidden ? "Screen protection waits for a visible tab" : "Screen protection ready · enabled on Go");
    return;
  }
  if (liveProtection.sentinel || liveProtection.pending) return;
  if (!navigator.wakeLock?.request) {
    liveStatus("Screen protection unavailable · use your system display settings");
    return;
  }
  const generation = ++liveProtection.generation;
  liveProtection.pending = true;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    if (generation !== liveProtection.generation || !state.running || document.hidden || !document.getElementById("keepAwake").checked) {
      try { await sentinel.release(); } catch (error) { /* Already released. */ }
      return;
    }
    liveProtection.sentinel = sentinel;
    sentinel.addEventListener("release", () => {
      if (liveProtection.sentinel !== sentinel) return;
      liveProtection.sentinel = null;
      liveStatus("Screen protection released by the system · check display settings");
    });
    liveStatus("Screen protection active");
  } catch (error) {
    if (generation === liveProtection.generation) liveStatus("Screen protection unavailable · check system display settings");
  } finally {
    if (generation === liveProtection.generation) liveProtection.pending = false;
  }
}

function initLiveProtection() {
  if (liveProtection.initialized) return;
  liveProtection.initialized = true;
  document.getElementById("keepAwake").addEventListener("change", () => { saveSetup(); livePlaybackChanged(); });
  document.getElementById("retryPlayback").addEventListener("click", start);
  document.getElementById("safePlayback").addEventListener("click", () => {
    historyAction("Use safe look", () => {
      // A failing saved interval scene must not replace the fallback on Go.
      intervalMode.checked = false;
      state.pendingPreset = null;
      applyPanicLook();
      // The fallback does not depend on an available GPU canvas.
      controls.colorMode.value = "classic";
      controls.recordingMode.checked = false;
      controls.glyphSize.value = "18";
      controls.quality.value = "low";
      start();
    });
  });
  document.getElementById("recoveryMenu").addEventListener("click", stop);
  document.addEventListener("visibilitychange", () => {
    livePlaybackChanged();
    if (document.hidden) stopPreviewLoop();
    else if (!state.running) schedulePreview();
  });
  window.addEventListener("pagehide", releaseScreenProtection);
  for (const canvas of [controls.canvas, controls.previewCanvas]) {
    canvas.addEventListener("contextlost", () => {
      if (canvas === controls.canvas && state.running && !controls.canvas.hidden) {
        showRenderError(new Error("Display context lost. Choose Retry look after recovery, or Safe look to use text output."));
      }
    });
    canvas.addEventListener("contextrestored", () => {
      state[canvas === controls.canvas ? "canvasContext" : "previewContext"] = null;
      if (!state.running) schedulePreview();
    });
  }
  livePlaybackChanged();
}
