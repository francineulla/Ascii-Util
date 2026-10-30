(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const el = id => document.getElementById(id);
  const quiet = () => {
    cancelPlaybackFrame(); stopPreviewLoop(); clearTimeout(state.previewTimer); clearTimeout(galleryRefreshTimer);
    if (galleryThumbnailTask) {
      if (window.cancelIdleCallback) window.cancelIdleCallback(galleryThumbnailTask); else clearTimeout(galleryThumbnailTask);
      galleryThumbnailTask = 0;
    }
  };
  const originalDpr = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  const originalWake = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
  const originalRender = renderFrameToCanvas;
  try {
    quiet();
    el("keepAwake").checked = false;
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    applyPreset({ ...getPreset(), visualizerMode: "ascii", quality: "ultra", glyphSize: "8", maskMode: "off", backgroundOnly: true, fullscreenOnStart: false, livePreview: false, recordingMode: false });
    quiet(); prepareStateFromControls();
    for (const [width, height, ratio] of [[3840, 2160, 3], [7680, 4320, 4], [16384, 16384, 10], [64, 16384, 4], [16384, 64, 4]]) {
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: ratio });
      const frame = buildFrame(state.startedAt + 900, width, height, true);
      assert(frame.grid.length * frame.grid[0].length <= renderLimits.maxCells, "large displays obey the per-frame cell budget");
      setupCanvas(controls.canvas, width, height);
      assert(controls.canvas.width * controls.canvas.height <= renderLimits.maxCanvasPixels && Math.max(controls.canvas.width, controls.canvas.height) <= renderLimits.maxCanvasSide, "stage backing memory is bounded at high DPR");
      setupCanvas(controls.previewCanvas, width, height);
      assert(controls.previewCanvas.width * controls.previewCanvas.height <= renderLimits.maxPreviewPixels, "setup preview uses its smaller backing budget");
      assert(getMonitorHeight(width, height) <= 1080, "native setup monitors are bounded even in extreme portrait windows");
    }
    if (originalDpr) Object.defineProperty(window, "devicePixelRatio", originalDpr); else delete window.devicePixelRatio;

    // Exercise the real drawing paths at widely separated musical positions.
    const timings = {}, frameCount = 60;
    for (const mode of ["ascii", "atari", "vm2", "nethack", "pixelmusic"]) {
      applyPreset({ ...getPreset(), visualizerMode: mode, quality: "medium", glyphSize: "13", colorMode: "spotlight", backgroundOnly: false,
        nhFog: true, nhView: "follow", vm2Trails: "60", pmAutomation: "bars", pmInput: "demo", atariInput: "demo", vm2Input: "demo" });
      quiet(); prepareStateFromControls();
      const times = [];
      for (let index = 0; index < frameCount; index++) {
        const started = performance.now();
        const frame = buildFrame(state.startedAt + index * 60000, 640, 360, true);
        renderFrameToCanvas(frame, controls.canvas, 640, 360);
        assert(Number.isFinite(frame.beatIndex) && frame.beatIndex >= 0, "long-running transport timing stays finite");
        times.push(performance.now() - started);
      }
      times.sort((first, second) => first - second);
      timings[mode] = { frames: frameCount, p95ms: Number(times[Math.floor(times.length * 0.95)].toFixed(2)), maxMs: Number(times.at(-1).toFixed(2)) };
    }

    applyPreset({ ...getPreset(), visualizerMode: "ascii", backgroundOnly: false, colorMode: "spotlight", livePreview: false });
    quiet(); start(); quiet();
    const goodFrame = state.currentFrame;
    renderFrameToCanvas = () => { throw new Error("Injected display failure <img src=x>"); };
    loop(performance.now() + 1000);
    assert(!state.running && state.currentFrame === goodFrame && !controls.canvas.hidden, "a renderer fault retains the last successful canvas frame");
    assert(!el("renderRecovery").hidden && !el("renderErrorMessage").querySelector("img"), "recovery controls show errors as literal text");
    renderFrameToCanvas = originalRender;
    el("retryPlayback").click(); quiet();
    assert(state.running && el("renderRecovery").hidden, "Retry look restarts playback and dismisses recovery");
    stop(); quiet();
    renderFrameToCanvas = () => { throw new Error("First frame failed"); };
    start(); quiet();
    assert(!state.running && !controls.canvas.hidden && !el("renderRecovery").hidden, "a failed first frame after returning from setup restores the prior canvas");
    renderFrameToCanvas = originalRender;
    el("retryPlayback").click(); quiet();
    controls.canvas.dispatchEvent(new Event("contextlost"));
    assert(!state.running && !el("renderRecovery").hidden, "context loss offers recovery without an uncaught loop");
    state.scenes[0] = { ...getPreset(), visualizerMode: "vm2" }; state.selectedSceneSlot = 1; intervalMode.checked = true;
    el("safePlayback").click(); quiet();
    assert(state.running && !controls.ascii.hidden && controls.canvas.hidden && state.options.colorMode === "classic" && !intervalMode.checked, "Safe look works without a canvas renderer or recalling a failing interval scene");
    stop(); quiet();

    let resolveRequest, requests = 0, releases = 0;
    const makeSentinel = () => ({ addEventListener() {}, release() { releases++; return Promise.resolve(); } });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); } } });
    state.running = true; el("keepAwake").checked = true;
    const pending = livePlaybackChanged();
    livePlaybackChanged();
    assert(requests === 1, "duplicate playback hooks share one pending wake request");
    state.running = false; await livePlaybackChanged();
    resolveRequest(makeSentinel()); await pending;
    assert(releases === 1 && !liveProtection.sentinel, "a late wake request cannot survive stopped playback");
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { requests++; return makeSentinel(); } } });
    state.running = true; await livePlaybackChanged();
    assert(liveProtection.sentinel && el("liveReadout").textContent.includes("active"), "visible playback can keep the screen awake");
    state.running = false; await livePlaybackChanged();
    assert(releases === 2 && !liveProtection.sentinel, "stop releases the screen wake lock");
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { throw new Error("Permission denied"); } } });
    state.running = true; await livePlaybackChanged();
    assert(state.running && el("liveReadout").textContent.includes("unavailable"), "denied wake protection leaves visual playback available");
    state.running = false; el("keepAwake").checked = false; await livePlaybackChanged();

    const violations = [];
    document.addEventListener("securitypolicyviolation", event => violations.push(event.effectiveDirective));
    window.inlineSecurityProbe = false;
    const script = document.createElement("script"); script.textContent = "window.inlineSecurityProbe = true"; document.head.append(script); script.remove();
    let dynamicBlocked = false;
    try { new Function("return 1")(); } catch (error) { dynamicBlocked = error instanceof EvalError; }
    await fetch("https://example.invalid/ascii-csp-check").catch(() => {});
    await wait(50);
    assert(!window.inlineSecurityProbe && dynamicBlocked && violations.includes("connect-src"), "CSP blocks inline execution, eval, and outgoing fetch");
    quiet();
    document.body.textContent = `PASS: bounded 4K/8K/large-DPR rendering, 300 frames spanning one hour per mode, frozen-frame recovery, canvas loss/safe output, wake-lock races, and enforced CSP. CPU timings (640x360, headless): ${JSON.stringify(timings)}`;
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  } finally {
    renderFrameToCanvas = originalRender;
    state.running = false; releaseScreenProtection(); quiet();
    if (originalDpr) Object.defineProperty(window, "devicePixelRatio", originalDpr); else delete window.devicePixelRatio;
    if (originalWake) Object.defineProperty(navigator, "wakeLock", originalWake); else delete navigator.wakeLock;
  }
})();
