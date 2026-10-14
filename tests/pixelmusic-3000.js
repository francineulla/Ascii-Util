(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const canvasFor = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    return canvas;
  };
  const pixelsOf = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  const equalPixels = (first, second) => first.length === second.length && first.every((value, index) => value === second[index]);
  const litPixels = pixels => {
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) count++;
    return count;
  };
  const pngCanvas = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  const channel = level => ({ level, crossings: 440, samples: new Float32Array(1024).fill(level) });

  try {
    clearTimeout(state.previewTimer); stopPreviewLoop();
    if (sessionStorage.getItem("pixelmusicReload")) {
      assert(controls.visualizerMode.value === "pixelmusic" && el("toolMode").value === "video", "saved Pixelmusic scene restores the video tool");
      assert(controls.pmRoutine.value === "5" && controls.pmPalette.value === "aqua" && controls.pmGainLeft.value === "143", "routine, palette, and independent gain survive reload");
      assert(controls.pmStretch.checked && controls.pmInput.value === "audio", "stretch and audio source survive reload");
      assert(controls.pmAutomation.value === "bars" && controls.pmChangeEvery.value === "8" && controls.pmPatternHold.checked && controls.pmPaletteHold.checked, "musical automation and independent holds survive reload");
      assert(controls.pmFavorite2.checked && controls.pmFavorite5.checked && !controls.pmFavorite0.checked, "the favourite pool survives reload");
      assert(!audioState.stream, "scene restore never opens audio capture automatically");
      document.body.innerHTML = "<p>PASS: Pixelmusic source routines, original/beat/bar automation, favourites/holds/manual steps, stereo, immutable frames, live edits, preview/PNG, and scene persistence</p>";
      return;
    }
    assert(typeof Pixelmusic3000 === "object", "Pixelmusic engine loads before application startup");
    const defaults = Pixelmusic3000.defaults, fields = Object.keys(defaults);
    for (const id of fields) {
      const control = controls[id];
      assert(control && control === el(id), `${id} is a connected control`);
      if (control.type === "number" || control.type === "range") assert(Number(normalizePreset({ [id]: -1000 })[id]) === Number(control.min) && Number(normalizePreset({ [id]: 1000 })[id]) === Number(control.max), `${id} clamps imported values`);
      if (control.tagName === "SELECT") assert(!(id in normalizePreset({ [id]: "unsupported" })), `${id} rejects invalid imported choices`);
    }
    assert(Array.from({ length: 8 }, (_, index) => String(index)).every(value => Array.from(controls.pmRoutine.options).some(option => option.value === value)), "all eight routines from the source are selectable");
    const families = ["brown", "blue", "pink", "aqua", "orange"];
    assert(families.every(value => Array.from(controls.pmPalette.options).some(option => option.value === value)), "all five source palette families are selectable");
    assert(normalizePreset({ pmStretch: "false" }).pmStretch === false && normalizePreset({ pmStretch: "true" }).pmStretch === true, "stretch remains a boolean in imported scenes");
    const quiet = { left: channel(0), right: channel(0) };
    const loud = { left: channel(0.8), right: channel(0.8) };
    const stereo = { left: channel(0.8), right: channel(0.3) };
    const options = { ...defaults, pmRoutine: "5", pmPalette: "pink", pmSpeed: "1" };
    const build = (extra = {}, elapsed = 900, signal = stereo, previous = null, seed = 42) => Pixelmusic3000.buildFrame({ ...options, ...extra }, elapsed, signal, seed, previous);
    const raster = frame => Pixelmusic3000.rasterize(frame);
    const base = build();
    assert(raster(base).length === 256 * 192 * 4 && litPixels(raster(base)) > 0, "renderer uses the source's 256 by 192 bitmap and draws its sprites");
    assert(equalPixels(raster(base), raster(build())), "identical input and timing reproduce the same source routine");
    assert(base.scalarLeft > base.scalarRight && base.scalarRight > 0 && base.scalarLeft <= 15, "left and right signals produce independent bounded ADC-style scalars");
    const mutedLeft = build({ pmGainLeft: 0 });
    assert(mutedLeft.scalarLeft === 0 && mutedLeft.scalarRight === base.scalarRight, "left gain changes only the left input scalar");
    assert(!equalPixels(raster(base), raster(mutedLeft)), "independent stereo gain changes the picture");
    assert(litPixels(raster(build({ pmRoutine: "0" }, 0, quiet))) > 0, "silence retains the source's minimum-size sprite marks");
    const cardinal = new Set(build({ pmRoutine: "4" }).stamps.map(stamp => `${stamp.x},${stamp.y}`));
    const diagonal = new Set(build({ pmRoutine: "5" }).stamps.map(stamp => `${stamp.x},${stamp.y}`));
    assert(["-90,0", "90,0", "0,-90", "0,90"].every(point => cardinal.has(point)), "routine 4 reproduces the source's four cardinal satellite positions");
    assert(["-90,-90", "90,90", "-90,90", "90,-90"].every(point => diagonal.has(point)) && !cardinal.has("90,90"), "routine 5 adds the source's diagonal satellites");
    const routinePictures = Array.from({ length: 8 }, (_, index) => raster(build({ pmRoutine: String(index) })));
    assert(routinePictures.every(pixels => litPixels(pixels) > 0), "each source routine produces a visible picture");
    assert(routinePictures.filter(pixels => !equalPixels(pixels, routinePictures[0])).length >= 5, "the selectable routines produce visibly different compositions");
    assert(new Set(families.map(pmPalette => JSON.stringify(build({ pmPalette }).palette))).size === families.length, "palette families have distinct source-inspired colors");
    assert(!equalPixels(raster(base), raster(build({ pmThickness: 6 }))), "thickness changes the drawn sprite marks");
    assert(build({ pmSpeed: "2" }, 1000).tick === build({ pmSpeed: "1" }, 2000).tick, "speed scales the emulated animation clock");
    assert(build({ pmSpeed: "0.25" }, 4000).tick === build({ pmSpeed: ".25" }, 4000).tick, "fractional speed normalization accepts equivalent numeric forms");

    const automatic = { pmRoutine: "auto", pmPalette: "auto" };
    const startup = build(automatic, 0, quiet);
    assert(startup.activeRoutine === 0 && startup.paletteIndex === 15, "Auto begins with routine 0 and palette 15 from the supplied Spin source");
    const waiting = build(automatic, 999, loud, startup);
    assert(waiting.paletteIndex === 15, "the initial Auto delay lasts one second");
    const threshold = build(automatic, 1000, { left: channel(0.25), right: channel(0.25) }, waiting);
    assert(threshold.total === 4 && threshold.paletteIndex === 15, "Auto respects the source's strict total greater than four gate");
    const firstChange = build(automatic, 1000, loud, threshold);
    assert(firstChange.paletteIndex === 1 && firstChange.auto.counter === 1, "the first loud ready event advances to source palette 1");
    const held = build(automatic, firstChange.auto.nextChangeAt + 5000, quiet, firstChange);
    assert(held.paletteIndex === firstChange.paletteIndex && held.activeRoutine === firstChange.activeRoutine && held.auto.counter === firstChange.auto.counter, "quiet input holds the current Auto selection even after its timer expires");
    const resumed = build(automatic, held.elapsedMs + 1, loud, held);
    assert(resumed.auto.counter === held.auto.counter + 1, "loud input resumes Auto with one change rather than catching up missed quiet events");
    const trace = seed => {
      let previous = build(automatic, 0, quiet, null, seed);
      const events = [];
      for (let index = 0; index < 12; index++) {
        previous = build(automatic, previous.auto.nextChangeAt, loud, previous, seed);
        events.push([previous.activeRoutine, previous.paletteIndex, previous.auto.nextChangeAt]);
      }
      return JSON.stringify(events);
    };
    assert(trace(42) === trace(42) && trace(42) !== trace(271), "Auto's routine and delay sequence is reproducible and responds to the seed");
    const legacyTrace = [[2, 1, 2500], [1, 2, 2625], [1, 3, 6375], [4, 4, 7375], [7, 5, 9000], [1, 6, 12375],
      [6, 7, 14125], [6, 8, 17250], [3, 9, 21250], [4, 10, 21375], [7, 11, 22500], [5, 12, 25000]];
    assert(trace(42) === JSON.stringify(legacyTrace), "default Original retains the pre-extension source RNG sequence, delays, palette order, and natural repeated routines");

    const musical = { ...defaults, pmAutomation: "beats", pmChangeEvery: "4", bpm: "120", barLength: "4" };
    const musicFrame = (extra = {}, elapsed = 0, previous = null, actions = {}) => Pixelmusic3000.buildFrame({ ...musical, ...extra }, elapsed, quiet, 42, previous, actions);
    const beatStart = musicFrame(), beforeBeat = musicFrame({}, 1999, beatStart), onBeat = musicFrame({}, 2000, beforeBeat);
    assert(beforeBeat.paletteIndex === 15 && onBeat.paletteIndex === 16 && onBeat.activeRoutine !== beatStart.activeRoutine,
      "beat automation advances at the exact four-beat boundary even with silent input");
    assert(onBeat.automationStep === 1 && musicFrame({ pmSpeed: "4" }, 2000).paletteIndex === onBeat.paletteIndex
      && musicFrame({ pmSpeed: "0.25" }, 2000).activeRoutine === onBeat.activeRoutine, "musical selection ignores sprite animation speed");
    const bars = { pmAutomation: "bars", pmChangeEvery: "2", barLength: "3" };
    const barStart = musicFrame(bars), beforeBar = musicFrame(bars, 2999, barStart), onBar = musicFrame(bars, 3000, beforeBar);
    assert(beforeBar.paletteIndex === 15 && onBar.paletteIndex === 16, "bar automation uses the selected bar length and interval");
    let dense = musicFrame({ pmChangeEvery: "1" });
    for (let elapsed = 100; elapsed <= 42000; elapsed += 100) dense = musicFrame({ pmChangeEvery: "1" }, elapsed, dense);
    const sparse = musicFrame({ pmChangeEvery: "1" }, 42000, musicFrame({ pmChangeEvery: "1" }));
    assert(dense.activeRoutine === sparse.activeRoutine && dense.paletteIndex === sparse.paletteIndex
      && JSON.stringify(dense.auto) === JSON.stringify(sparse.auto), "musical selection is independent of rendering frame rate and missed frames");
    let paced = musicFrame({ pmChangeEvery: "1", bpm: "127" });
    for (let elapsed = 100; elapsed <= 5300; elapsed += 100) paced = musicFrame({ pmChangeEvery: "1", bpm: "127" }, elapsed, paced);
    assert(equalPixels(raster(paced), raster(musicFrame({ pmChangeEvery: "1", bpm: "127" }, 5300))),
      "musical sprite stripe phase is also independent of intermediate rendering frames");
    const distant = musicFrame({ pmChangeEvery: "1", bpm: "360" }, 1e12, beatStart);
    assert(Number.isFinite(distant.automationStep) && distant.activeRoutine >= 0 && distant.activeRoutine < 8,
      "large transport jumps use bounded arithmetic rather than iterating every missed beat");

    const favourites = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`pmFavorite${index}`, [2, 5, 7].includes(index)]));
    let favourite = musicFrame({ ...favourites, pmChangeEvery: "1" });
    for (let index = 1; index <= 24; index++) {
      const next = musicFrame({ ...favourites, pmChangeEvery: "1" }, index * 500, favourite);
      assert([2, 5, 7].includes(next.activeRoutine) && next.activeRoutine !== favourite.activeRoutine, "beat choices use only favourites and never immediately repeat when alternatives exist");
      favourite = next;
    }
    let restrictedOriginal = build({ ...automatic, ...favourites }, 0, quiet);
    for (let index = 0; index < 12; index++) {
      const next = build({ ...automatic, ...favourites }, restrictedOriginal.auto.nextChangeAt, loud, restrictedOriginal);
      assert([2, 5, 7].includes(next.activeRoutine) && next.activeRoutine !== restrictedOriginal.activeRoutine, "restricted Original choices respect favourites without immediate repeats");
      restrictedOriginal = next;
    }
    const none = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`pmFavorite${index}`, false]));
    const emptyPool = musicFrame(none);
    assert(Array.from({ length: 8 }, (_, index) => emptyPool.options[`pmFavorite${index}`]).every(Boolean), "an empty favourite pool safely falls back to all patterns");
    const one = musicFrame({ ...none, pmFavorite5: true });
    assert(musicFrame({ ...none, pmFavorite5: true }, 2000, one).activeRoutine === 5, "a single favourite remains stable without a repeat-selection loop");

    const patternHeld = musicFrame({ pmChangeEvery: "1", pmPatternHold: true }, 2500, onBeat);
    // A timing configuration change establishes the next boundary without changing the current look.
    const patternHeldNext = musicFrame({ pmChangeEvery: "1", pmPatternHold: true }, 3000, patternHeld);
    assert(patternHeldNext.activeRoutine === onBeat.activeRoutine && patternHeldNext.paletteIndex !== onBeat.paletteIndex, "pattern hold freezes only patterns while palette automation continues");
    const bothHeld = musicFrame({ pmChangeEvery: "1", pmPatternHold: true, pmPaletteHold: true }, 9000, patternHeldNext);
    assert(bothHeld.activeRoutine === patternHeldNext.activeRoutine && bothHeld.paletteIndex === patternHeldNext.paletteIndex, "independent holds consume scheduled events without changing either selection");
    const heldPixels = raster(bothHeld);
    const nextActions = { patternNext: 1, paletteNext: 1 };
    const stepped = musicFrame({ pmChangeEvery: "1", pmPatternHold: true, pmPaletteHold: true }, 9000, bothHeld, nextActions);
    assert(stepped.activeRoutine !== bothHeld.activeRoutine && stepped.paletteIndex === (bothHeld.paletteIndex + 1) % 30,
      "manual Next overrides both holds without advancing transport");
    const repeated = musicFrame({ pmChangeEvery: "1", pmPatternHold: true, pmPaletteHold: true }, 9000, stepped, nextActions);
    assert(repeated.activeRoutine === stepped.activeRoutine && repeated.paletteIndex === stepped.paletteIndex
      && equalPixels(raster(repeated), raster(stepped)), "acknowledged Next counters do not execute twice when repainting a frozen frame");
    assert(Object.isFrozen(stepped.actions) && equalPixels(heldPixels, raster(bothHeld)), "manual stepping never mutates its prior paused snapshot");
    const released = musicFrame({ pmChangeEvery: "1", pmPaletteHold: true }, 9000, stepped, nextActions);
    assert(released.activeRoutine === stepped.activeRoutine && released.paletteIndex === stepped.paletteIndex, "releasing Hold does not replay events missed while held");
    const releaseNext = musicFrame({ pmChangeEvery: "1", pmPaletteHold: true }, 9500, released, nextActions);
    assert(releaseNext.activeRoutine !== released.activeRoutine && releaseNext.paletteIndex === released.paletteIndex, "released patterns resume on the next boundary while palette hold remains independent");
    const manualStart = musicFrame({ pmRoutine: "5", pmPalette: "aqua", pmPatternHold: true, pmPaletteHold: true });
    const manualStepped = musicFrame({ pmRoutine: "5", pmPalette: "aqua", pmPatternHold: true, pmPaletteHold: true }, 0, manualStart, nextActions);
    assert(manualStepped.activeRoutine === 5 && manualStepped.actions.patternNext === 1 && manualStepped.paletteFamily === "aqua"
      && manualStepped.paletteIndex !== manualStart.paletteIndex, "manual pattern overrides ignore and acknowledge pattern Next; palette Next stays within its selected family");
    const massiveActions = musicFrame({ pmPatternHold: true, pmPaletteHold: true }, 0, beatStart, { patternNext: 1e9, paletteNext: 1e9 });
    assert(massiveActions.activeRoutine >= 0 && massiveActions.activeRoutine < 8 && massiveActions.paletteIndex < 30, "large queued action counts remain bounded and valid");
    const edited = build({ ...automatic, pmGainLeft: "150", pmThickness: "5", pmStretch: true, bpm: "100" }, firstChange.elapsedMs, quiet, firstChange);
    assert(edited.activeRoutine === firstChange.activeRoutine && edited.paletteIndex === firstChange.paletteIndex
      && JSON.stringify(edited.auto) === JSON.stringify(firstChange.auto), "gain, pixel scale, stretch, and BPM edits preserve Original automatic history");
    assert(build({ ...automatic, pmInput: "audio" }, 0, quiet, firstChange).paletteIndex === 15
      && build(automatic, 0, quiet, firstChange).activeRoutine === 0, "new input or a transport rewind starts a fresh Original session");
    const invalidAutomation = musicFrame({ pmAutomation: "unsupported", pmChangeEvery: -1, pmPatternHold: "false", pmPaletteHold: "true" });
    assert(invalidAutomation.options.pmAutomation === "original" && invalidAutomation.options.pmChangeEvery === 4
      && !invalidAutomation.options.pmPatternHold && invalidAutomation.options.pmPaletteHold, "automation settings normalize invalid values and string booleans safely");
    let locked = build({ pmRoutine: "3", pmPalette: "aqua" }, 0, quiet);
    for (let index = 0; index < 8; index++) {
      locked = build({ pmRoutine: "3", pmPalette: "aqua" }, locked.auto.nextChangeAt, loud, locked);
      assert(locked.activeRoutine === 3 && locked.paletteFamily === "aqua", "manual routine and palette-family locks survive automatic source events");
    }
    const mutable = { left: channel(0.8), right: channel(0.3) };
    const frozen = build({}, 900, mutable), beforeMutation = raster(frozen);
    mutable.left.level = 0; mutable.left.samples.fill(0); mutable.right.samples.fill(1);
    build({}, 1200, mutable, frozen);
    assert(Object.isFrozen(frozen) && Object.isFrozen(frozen.stamps) && Object.isFrozen(frozen.auto) && equalPixels(beforeMutation, raster(frozen)), "later samples and animation cannot mutate a paused frame");
    const safe = build({ pmRoutine: "invalid", pmPalette: "invalid", pmGainLeft: 99999, pmGainRight: -999, pmThickness: 999, pmSpeed: Infinity, pmStretch: "false" }, -1000, loud);
    assert(safe.elapsedMs === 0 && safe.scalarLeft <= 15 && safe.scalarRight === 0 && safe.options.pmThickness <= 6 && !safe.stretch, "engine normalizes malformed settings and negative time safely");
    assert(safe.activeRoutine >= 0 && safe.activeRoutine < 8 && families.includes(safe.paletteFamily), "invalid selectors fall back to supported routines and palettes");
    const canvas = canvasFor(480, 270), ctx = canvas.getContext("2d");
    Pixelmusic3000.draw(ctx, base, canvas.width, canvas.height);
    const firstDraw = pixelsOf(canvas);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    Pixelmusic3000.draw(ctx, base, canvas.width, canvas.height);
    assert(equalPixels(firstDraw, pixelsOf(canvas)), "repainting a stored picture clears old target content without advancing it");
    assert(litPixels(ctx.getImageData(0, 0, 59, 270).data) === 0, "default display fits the original 4:3 bitmap inside a wide canvas");
    Pixelmusic3000.draw(ctx, build({ pmStretch: true }, 900, loud), canvas.width, canvas.height);
    assert(litPixels(ctx.getImageData(0, 0, 59, 270).data) > 0, "stretch extends the source picture into the widescreen side area");

    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false; controls.livePreview.checked = false;
    const interactive = { ...getPreset(), ...defaults, visualizerMode: "pixelmusic", pmRoutine: "auto",
      pmPatternHold: true, pmPaletteHold: true, pmAutomation: "beats", pmChangeEvery: "1",
      livePreview: false, fullscreenOnStart: false, recordingMode: false, transitionMode: "cut" };
    applyPreset(interactive); clearTimeout(state.previewTimer); renderPreview();
    assert(!el("pmNextPattern").disabled && !el("pmNextPalette").disabled, "both manual Next buttons remain available while held in Auto");
    const beforePreviewStep = state.previewFrame.pixelmusic;
    el("pmNextPattern").click(); clearTimeout(state.previewTimer); renderPreview();
    assert(state.previewFrame.pixelmusic.activeRoutine !== beforePreviewStep.activeRoutine
      && state.previewFrame.pixelmusic.paletteIndex === beforePreviewStep.paletteIndex, "Next pattern updates a static preview independently of palette Hold");
    const afterPatternStep = state.previewFrame.pixelmusic;
    el("pmNextPalette").click(); clearTimeout(state.previewTimer); renderPreview();
    assert(state.previewFrame.pixelmusic.activeRoutine === afterPatternStep.activeRoutine
      && state.previewFrame.pixelmusic.paletteIndex === (afterPatternStep.paletteIndex + 1) % 30, "Next palette updates the static preview without stepping its pattern");
    const beforePreviewEdit = state.previewFrame.pixelmusic;
    controls.pmGainLeft.value = "130";
    controls.pmGainLeft.dispatchEvent(new Event("input", { bubbles: true }));
    clearTimeout(state.previewTimer); renderPreview();
    assert(state.previewFrame.pixelmusic.activeRoutine === beforePreviewEdit.activeRoutine
      && state.previewFrame.pixelmusic.paletteIndex === beforePreviewEdit.paletteIndex, "editing gain preserves preview automatic selection and manual-step history");
    const beforeLive = state.previewFrame.pixelmusic;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
    stopPreviewLoop();
    renderPreview(state.previewStartedAt + beforeLive.elapsedMs + 50);
    assert(controls.livePreview.checked && state.previewFrame.pixelmusic.activeRoutine === beforeLive.activeRoutine
      && state.previewFrame.pixelmusic.paletteIndex === beforeLive.paletteIndex
      && state.previewFrame.pixelmusic.elapsedMs >= beforeLive.elapsedMs, "Space enables live preview without rewinding manual selection history");
    const liveStartedAt = state.previewStartedAt;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
    assert(state.previewStartedAt === liveStartedAt, "Space does not restart an already live preview");
    el("pmNextPattern").click(); stopPreviewLoop();
    const beforeLivePalette = state.previewFrame.pixelmusic;
    el("pmNextPalette").click(); stopPreviewLoop();
    assert(state.previewFrame.pixelmusic.activeRoutine === beforeLivePalette.activeRoutine
      && state.previewFrame.pixelmusic.paletteIndex === (beforeLivePalette.paletteIndex + 1) % 30, "live preview consumes a palette command exactly once");
    controls.livePreview.checked = false;
    controls.livePreview.dispatchEvent(new Event("change")); stopPreviewLoop();
    clearTimeout(state.previewTimer); renderPreview();
    const beforeImmediateExport = state.previewFrame.pixelmusic;
    controls.pmThickness.value = "3";
    controls.pmThickness.dispatchEvent(new Event("input", { bubbles: true }));
    const clickBeforePreviewExport = HTMLAnchorElement.prototype.click;
    let previewDownload;
    HTMLAnchorElement.prototype.click = function () { previewDownload = this.href; };
    try { saveFrame(); } finally { HTMLAnchorElement.prototype.click = clickBeforePreviewExport; }
    assert(previewDownload?.startsWith("data:image/png")
      && state.currentFrame.pixelmusic === state.previewFrame.pixelmusic
      && state.currentFrame.pixelmusic.activeRoutine === beforeImmediateExport.activeRoutine
      && state.currentFrame.pixelmusic.paletteIndex === beforeImmediateExport.paletteIndex
      && state.currentFrame.pixelmusic.options.pmThickness === 3, "PNG during a queued preview edit retains selections and uses the edited look");
    start(); cancelAnimationFrame(state.raf); togglePause();
    const beforePausedStep = state.currentFrame, beforePausedPixels = raster(beforePausedStep.pixelmusic);
    el("pmNextPattern").click(); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.pixelmusic.activeRoutine !== beforePausedStep.pixelmusic.activeRoutine,
      "Next pattern can deliberately update a paused frame without resuming playback");
    assert(equalPixels(beforePausedPixels, raster(beforePausedStep.pixelmusic)), "paused manual stepping retains the old immutable capture snapshot");
    const afterPausedStep = state.currentFrame;
    renderFrame(afterPausedStep);
    assert(state.currentFrame === afterPausedStep && state.paused, "repainting a manually stepped paused frame does not consume another action");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
    applyPreset({ ...interactive, pmRoutine: "5" }); clearTimeout(state.previewTimer);
    assert(state.previewPixelmusicActions.patternNext === 0 && state.previewPixelmusicActions.paletteNext === 0,
      "applying a new scene clears temporary preview command history");
    assert(el("pmNextPattern").disabled && !el("pmNextPalette").disabled, "manual pattern selection disables only the inapplicable Next pattern action");
    const preset = { ...getPreset(), ...defaults, ...none, pmFavorite2: true, pmFavorite5: true,
      pmAutomation: "bars", pmChangeEvery: "8", pmPatternHold: true, pmPaletteHold: true,
      visualizerMode: "pixelmusic", seed: "pixelmusic-scene", pmInput: "demo", pmRoutine: "5", pmPalette: "aqua", pmGainLeft: "143", pmStretch: true, recordingMode: false, fullscreenOnStart: false, scanlines: false, invert: false, transitionMode: "cut", colorMode: "classic", quality: "low" };
    applyPreset(preset);
    assert(el("toolMode").value === "video" && !el("pixelmusicPanel").hidden && el("atariPanel").hidden && el("vm2Panel").hidden && el("nethackPanel").hidden, "Pixelmusic appears as an independent video synthesizer");
    prepareStateFromControls();
    const native = buildFrame(state.startedAt + 900, 640, 480, true);
    assert(native.pixelmusic && native.grid.length === 0, "Pixelmusic uses its own native frame payload");
    const nativeSeed = state.seedValue, nativePixels = raster(native.pixelmusic);
    controls.lyrics.value = "IGNORED HIDDEN LYRICS"; controls.maskArt.value = "###"; controls.colorMode.value = "thermal"; controls.palette.value = "amber";
    prepareStateFromControls();
    assert(state.seedValue === nativeSeed && equalPixels(nativePixels, raster(buildFrame(state.startedAt + 900, 640, 480, true).pixelmusic)), "hidden text, masks, and ASCII palette do not affect Pixelmusic");
    renderFrame(native);
    assert(!controls.canvas.hidden && controls.ascii.hidden && litPixels(pixelsOf(controls.canvas)) > 0, "native Pixelmusic draws to canvas independently of ASCII color settings");
    schedulePreview(); clearTimeout(state.previewTimer); renderPreview();
    assert(litPixels(pixelsOf(controls.previewCanvas)) > 0 && litPixels(pixelsOf(el("pixelmusicMonitor"))) > 0, "menu and Pixelmusic monitor previews both draw the source sprites");
    const shared = decodePresetFromUrl(encodePresetForUrl(getPreset()));
    assert(shared.visualizerMode === "pixelmusic" && fields.every(id => shared[id] === getPreset()[id]), "all Pixelmusic controls survive share URL encoding");
    start(); cancelAnimationFrame(state.raf);
    for (let index = 1; index <= 10; index++) {
      loop(state.startedAt + index * 250); cancelAnimationFrame(state.raf);
      assert(state.running && state.currentFrame.pixelmusic, "subsequent Pixelmusic playback frames render successfully");
    }
    togglePause();
    const paused = state.currentFrame, pausedPixels = raster(paused.pixelmusic);
    let download;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { download = this.href; };
    try {
      saveFrame();
      assert(download?.startsWith("data:image/png") && litPixels(pixelsOf(await pngCanvas(download))) > 0 && state.currentFrame === paused && equalPixels(pausedPixels, raster(paused.pixelmusic)), "paused PNG export preserves the same immutable source frame");
      stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
      controls.recordingMode.checked = true; controls.captureSize.value = "1280x720";
      schedulePreview(); clearTimeout(state.previewTimer); saveFrame();
      const exported = await pngCanvas(download);
      assert(exported.width === 1280 && exported.height === 720 && litPixels(pixelsOf(exported)) > 0, "Pixelmusic PNG honors exact fixed capture dimensions");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    const legacy = { ...preset, backgroundMode: "plasma", glyphSize: "24" };
    delete legacy.visualizerMode;
    for (const id of fields) delete legacy[id];
    state.scenes = [preset, legacy, { ...preset, visualizerMode: "atari" }, { ...preset, visualizerMode: "vm2" }, { ...preset, visualizerMode: "nethack" }];
    applyPreset(preset); start(); cancelAnimationFrame(state.raf); togglePause();
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(state.paused && controls.visualizerMode.value === "ascii" && !state.currentFrame.pixelmusic && el("sceneDirty").textContent.includes("no changes"), "legacy text scene recall remains compatible and clean");
    assert(fields.every(id => (controls[id].type === "checkbox" ? controls[id].checked : controls[id].value) === (controls[id].type === "checkbox" ? defaults[id] : String(defaults[id]))), "legacy scenes receive Pixelmusic defaults instead of inheriting another scene's controls");
    for (const [slot, payload] of [[3, "atari"], [4, "vm2"], [5, "nethack"]]) {
      recallScene(slot); cancelAnimationFrame(state.raf);
      assert(state.paused && state.currentFrame[payload] && !state.currentFrame.pixelmusic, `paused ${payload} scene remains independent of Pixelmusic`);
    }
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.pixelmusic && controls.pmRoutine.value === "5" && controls.pmPalette.value === "aqua", "paused recall restores the Pixelmusic frame and locks immediately");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
    applyNamedPreset("pixelmusic3000"); clearTimeout(state.previewTimer);
    assert(controls.visualizerMode.value === "pixelmusic" && el("toolMode").value === "video", "built-in Pixelmusic preset selects its synthesizer");
    applyPreset({ ...preset, pmInput: "audio" }); selectSceneSlot(1); storeScene(1); saveSceneSlots(); saveSetup();
    sessionStorage.setItem("pixelmusicReload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
