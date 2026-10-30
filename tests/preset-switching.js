(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const quiet = () => {
    cancelPlaybackFrame(); stopPreviewLoop(); clearTimeout(state.previewTimer); clearTimeout(galleryRefreshTimer);
    if (galleryThumbnailTask) {
      if (window.cancelIdleCallback) window.cancelIdleCallback(galleryThumbnailTask); else clearTimeout(galleryThumbnailTask);
      galleryThumbnailTask = 0;
    }
  };
  const clickLook = name => {
    refreshPresetGallery(); quiet();
    const card = el("presetGallery").querySelector(`[data-preset="${name}"]`);
    assert(card, `gallery offers ${name}`);
    card.click(); quiet(); renderPreview(); quiet();
    assert(state.previewFrame && !controls.previewReadout.textContent.includes("failed"), `${name} updates the setup preview`);
  };
  const hasWords = frame => frame.grid.some(row => row.some(cell => cell.role === "lead" || cell.role === "secondary"));
  try {
    quiet();
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    const base = { ...galleryDefaultPreset(), lyrics: "ALPHA BETA GAMMA", seed: "preset-switch-test", bpm: "137", maskArt: "###\n # \n###", sceneName: "My working scene" };
    applyPreset(base); quiet();
    el("galleryFilter").value = "all";
    clickLook("backgroundPulse");
    assert(controls.backgroundOnly.checked && !hasWords(state.previewFrame), "Background pulse hides lyric layers");
    clickLook("galaxyMask");
    assert(!controls.backgroundOnly.checked && hasWords(state.previewFrame), "leaving Background pulse restores the Galaxy mask lyrics");
    clickLook("backgroundPulse"); clickLook("midiStrobe");
    assert(!controls.backgroundOnly.checked && hasWords(state.previewFrame), "leaving Background pulse restores MIDI strobe lyrics");

    // Every text look must resolve the same effect settings regardless of which
    // preset ran previously. User content and workspace preferences stay local.
    const effectFields = [...new Set(Object.values(presetBank).flatMap(preset => Object.keys(preset))), "maskMode", "maskLayer", "maskScale", "invert", "haloSize"];
    for (const source of Object.keys(presetBank)) {
      const sourceLook = getNamedPreset(source, base);
      for (const target of Object.keys(presetBank)) {
        const fresh = getNamedPreset(target, base), switched = getNamedPreset(target, sourceLook);
        assert(effectFields.every(id => String(switched[id]) === String(fresh[id])), `${source} → ${target} has no inherited effect toggles`);
        assert(switched.lyrics === base.lyrics && switched.seed === base.seed && switched.bpm === base.bpm && switched.maskArt === base.maskArt,
          `${source} → ${target} preserves user words, seed, tempo, and mask artwork`);
      }
    }

    for (const name of Object.keys(presetBank).filter(name => name !== "backgroundPulse")) {
      clickLook("backgroundPulse"); clickLook(name);
      assert(!controls.backgroundOnly.checked && hasWords(state.previewFrame), `${name} restores words after Background pulse`);
      clickLook("backgroundPulse");
      assert(controls.maskMode.value === "off" && controls.recordingMode.checked === false && controls.lyricMode.value === "words"
        && !controls.autoSections.checked && !controls.downbeatFlash.checked && !controls.midiSync.checked, "Background pulse clears unrelated mask, recording, parsing, and sync effects");
    }
    const pulse = getPreset();
    clickLook("galaxyMask"); undoEdit(); quiet();
    assert(JSON.stringify(getPreset()) === JSON.stringify(pulse), "one Undo restores Background pulse including its effect settings");
    redoEdit(); quiet();
    assert(!controls.backgroundOnly.checked && controls.maskMode.value === "reveal", "Redo restores the selected lyric look");

    applyPreset({ ...base, palette: "ocean", quality: "ultra", captureSize: "720x720", recordingMode: true, lyricMode: "markup", autoSections: true, midiSync: true }); quiet();
    for (const id of Object.keys(lockGroups)) el(id).checked = true;
    const locked = getPreset();
    clickLook("backgroundPulse"); clickLook("galaxyMask");
    assert([...lockedFields()].every(id => getPreset()[id] === locked[id]), "named look resets respect every enabled global lock");
    for (const id of Object.keys(lockGroups)) el(id).checked = false;

    applyPreset({ ...base, fullscreenOnStart: false }); applyNamedPreset("backgroundPulse"); quiet();
    start(); quiet(); togglePause();
    applyNamedPreset("galaxyMask"); quiet();
    assert(state.running && state.paused && !state.options.backgroundOnly && hasWords(state.currentFrame), "paused live playback updates its visible lyrics when leaving Background pulse");
    stop(); quiet();
    document.body.textContent = "PASS: Background pulse gallery switches in both directions, 256 order-independent text-look pairs, visible lyric layers, content preservation, Undo/Redo, global locks, and paused live playback";
  } catch (error) {
    quiet(); document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
