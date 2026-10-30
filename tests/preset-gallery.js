(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const el = id => document.getElementById(id);
  const quiet = () => {
    clearTimeout(state.previewTimer);
    clearTimeout(galleryRefreshTimer);
    stopPreviewLoop();
    if (galleryThumbnailTask) {
      if (window.cancelIdleCallback) window.cancelIdleCallback(galleryThumbnailTask);
      else clearTimeout(galleryThumbnailTask);
      galleryThumbnailTask = 0;
    }
  };
  const decode = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  try {
    quiet();
    assert(typeof getNamedPreset === "function" && typeof renderGalleryThumbnail === "function", "gallery loads with the shared named-preset resolver");
    applyPreset({ ...getPreset(), visualizerMode: "ascii", transitionMode: "cut", livePreview: false, fullscreenOnStart: false });
    quiet();
    el("galleryFilter").value = "all";
    refreshPresetGallery(); refreshSceneGallery(); quiet();
    assert(el("presetGallery").children.length === controls.defaultScenePreset.options.length, "all-mode gallery exposes every built-in preset");
    const presets = Array.from(controls.defaultScenePreset.options).map(option => getNamedPreset(option.value, galleryBasePreset));
    const modes = new Set(presets.map(preset => preset.visualizerMode));
    assert(modes.size === 5, "built-in cards cover all five renderers");

    // A thumbnail must not assign the live editor's value: restoring its text
    // and caret alone still destroys the browser's native typing Undo history.
    const liveLyrics = controls.lyrics;
    liveLyrics.value = "BASE";
    liveLyrics.focus();
    liveLyrics.setSelectionRange(4, 4);
    assert(document.execCommand("insertText", false, " ADDED") && liveLyrics.value === "BASE ADDED"
      && document.queryCommandEnabled("undo"), "native text insertion creates a browser Undo step");
    renderGalleryThumbnail({ ...getNamedPreset("cleanTitles", galleryBasePreset), seed: "native-undo-isolation" });
    assert(controls.lyrics === liveLyrics && document.activeElement === liveLyrics, "thumbnail renderer restores original control references without moving focus");
    assert(document.execCommand("undo") && liveLyrics.value === "BASE", "thumbnail generation preserves native text Undo");
    quiet();

    // A prepared audio/Pixelmusic session must survive an all-mode gallery
    // refresh without consuming manual commands or replacing frame references.
    state.previewPixelmusicActions = { patternNext: 3, paletteNext: 7 };
    state.pixelmusicActions = { patternNext: 4, paletteNext: 2 };
    state.previewStartedAt = 1700;
    state.running = false;
    state.previewPixelmusicKey = "keep-session";
    state.previewPixelmusicFrame = { testFrame: "preview" };
    state.previewVm2Frame = { testFrame: "trails" };
    controls.lyrics.value = "Keep the editor selection while rendering\n".repeat(80);
    controls.lyrics.focus();
    controls.lyrics.setSelectionRange(5, 12, "backward");
    controls.lyrics.scrollTop = 40;
    const lyricsScrollTop = controls.lyrics.scrollTop;
    audioState.level = 0.76;
    audioState.features = { bass: 0.8, mid: 0.6, treble: 0.3, transient: 0.2, pan: -0.4 };
    const originalState = state;
    const stateFields = Object.entries(state);
    const controlReferences = Object.entries(controls);
    const controlsBefore = JSON.stringify(getPreset());
    const audioBefore = audioState.features;
    const storageBefore = JSON.stringify({ ...localStorage });
    const originalSetItem = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (...args) { writes++; return originalSetItem.apply(this, args); };
    const pictures = [];
    try {
      for (const preset of presets) pictures.push(renderGalleryThumbnail(preset));
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
    assert(pictures.every(url => url.startsWith("data:image/png")), "every built-in produces a rendered PNG thumbnail");
    assert(new Set(pictures).size >= 18, "thumbnails represent distinct preset appearances");
    assert(state === originalState && stateFields.every(([key, value]) => state[key] === value), "thumbnail generation preserves every active state reference and timer");
    assert(controlReferences.every(([id, control]) => controls[id] === control), "thumbnail generation restores every original control reference");
    assert(JSON.stringify(getPreset()) === controlsBefore, "thumbnail generation restores every input and checkbox");
    assert(document.activeElement === controls.lyrics && controls.lyrics.selectionStart === 5 && controls.lyrics.selectionEnd === 12
      && controls.lyrics.selectionDirection === "backward" && controls.lyrics.scrollTop === lyricsScrollTop, "thumbnail rendering preserves the active editor selection and scroll position");
    assert(audioState.features === audioBefore && audioState.level === 0.76, "thumbnail generation preserves connected audio features");
    assert(writes === 0 && JSON.stringify({ ...localStorage }) === storageBefore, "rendering cards performs no storage writes");
    assert(renderGalleryThumbnail(presets[0]) === pictures[0], "repeated thumbnail requests use a stable cached image");
    for (const mode of modes) {
      const picture = await decode(pictures[presets.findIndex(preset => preset.visualizerMode === mode)]);
      const pixels = picture.getContext("2d").getImageData(0, 0, picture.width, picture.height).data;
      assert(picture.width === 320 && picture.height === 180 && pixels.some((value, index) => index % 4 !== 3 && value > 12), `${mode} thumbnail contains a visible rendered picture`);
    }

    // The same restoration guarantee applies when a renderer fails.
    const originalBuildFrame = buildFrame;
    const failurePreset = { ...presets[0], seed: "uncached-error-test" };
    let failed = false;
    try {
      buildFrame = () => { throw new Error("thumbnail test failure"); };
      renderGalleryThumbnail(failurePreset);
    } catch (error) { failed = error.message === "thumbnail test failure"; }
    finally { buildFrame = originalBuildFrame; }
    assert(failed && state === originalState && JSON.stringify(getPreset()) === controlsBefore && audioState.features === audioBefore
      && controlReferences.every(([id, control]) => controls[id] === control), "failed renders also restore control references, renderer state, and audio");
    for (let index = 0; index < galleryThumbnailLimit + 2; index++) {
      renderGalleryThumbnail({ ...presets.find(preset => preset.visualizerMode === "atari"), seed: `cache-limit-${index}` });
    }
    assert(galleryThumbnailCache.size === galleryThumbnailLimit, "thumbnail cache remains bounded when many scene versions are rendered");
    state.running = false;

    el("galleryFilter").value = "current";
    for (const mode of modes) {
      controls.visualizerMode.value = mode;
      refreshPresetGallery(); quiet();
      assert(el("presetGallery").children.length > 0 && Array.from(el("presetGallery").children).every(button => button.galleryPreset.visualizerMode === mode), `${mode} filter shows only that renderer's presets`);
    }
    controls.visualizerMode.value = "ascii";
    refreshPresetGallery(); quiet();
    const card = el("presetGallery").querySelector('[data-preset="terminalRain"]');
    assert(card && card.tagName === "BUTTON" && card.type === "button" && card.querySelector("img").alt === "", "cards are named native buttons with decorative previews");
    card.focus();
    refreshPresetGallery(); quiet();
    assert(document.activeElement === card, "refreshing unchanged gallery cards preserves keyboard focus");
    const beforeApply = getPreset();
    card.click(); quiet();
    assert(controls.backgroundMode.value === "rain" && controls.palette.value === "terminal", "preset cards apply through the existing default-preset button");
    if (typeof undoEdit === "function") {
      undoEdit(); quiet();
      assert(controls.backgroundMode.value === beforeApply.backgroundMode && controls.palette.value === beforeApply.palette, "applying a gallery preset is undoable");
    }
    el("galleryFilter").value = "all";
    refreshPresetGallery(); quiet();
    el("presetGallery").querySelector('[data-preset="videoMusic2"]').click(); quiet();
    assert(controls.visualizerMode.value === "vm2" && controls.toolMode.value === "video", "all-mode preset cards switch to a different renderer even when its legacy option is hidden");
    refreshPresetGallery(); quiet();
    el("presetGallery").querySelector('[data-preset="cleanTitles"]').click(); quiet();
    assert(controls.visualizerMode.value === "ascii" && controls.toolMode.value === "text", "all-mode preset cards can also return from video to text mode");

    const saved = { ...getPreset(), sceneName: "Amber set", seed: "saved-gallery-scene", visualizerMode: "vm2" };
    state.scenes = [null, saved];
    el("galleryFilter").value = "all";
    refreshSceneGallery(); quiet();
    assert(el("sceneGallery").children.length === 8 && el("sceneGallery").querySelector('[data-scene-slot="2"]').textContent.includes("Amber set"), "saved cards retain named slots and empty placeholders");
    el("sceneGallery").querySelector('[data-scene-slot="2"]').click(); quiet();
    assert(state.selectedSceneSlot === 2 && controls.seed.value === "saved-gallery-scene" && controls.visualizerMode.value === "vm2", "saved scene cards recall the scene through existing slot actions");
    refreshSceneGallery(); quiet();
    assert(el("sceneGallery").querySelector('[data-scene-slot="2"]').getAttribute("aria-pressed") === "true", "saved scene cards expose the selected slot accessibly");
    el("sceneGallery").querySelector('[data-scene-slot="3"]').click(); quiet();
    assert(state.selectedSceneSlot === 3 && !state.scenes[2], "empty scene cards select without overwriting a slot");
    controls.seed.value = "shift-stored-gallery";
    refreshSceneGallery(); quiet();
    el("sceneGallery").querySelector('[data-scene-slot="3"]').dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    quiet();
    assert(state.scenes[2]?.seed === "shift-stored-gallery", "Shift-click preserves the existing Store scene shortcut");
    document.body.innerHTML = "<p>PASS: every-mode rendered preset cards, filters, keyboard focus, saved and empty scene actions, native text Undo, scene Undo, bounded cache, and renderer/audio/storage isolation</p>";
  } catch (error) {
    quiet();
    document.body.innerHTML = `<p>FAIL: ${error.message}</p>`;
  }
})();
