(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const rejects = (action, message) => {
    let rejected = false;
    try { action(); } catch (error) { rejected = true; }
    assert(rejected, message);
  };
  const quiet = () => { stopPreviewLoop(); clearTimeout(state.previewTimer); cancelAnimationFrame(state.raf); };
  try {
    quiet();
    intervalMode.checked = false;
    for (const id of Object.keys(lockGroups)) document.getElementById(id).checked = false;
    applyPreset({ ...getPreset(), visualizerMode: "ascii", livePreview: false, fullscreenOnStart: false, lyrics: "SAFE WORDS", seed: "safe-look", maskMode: "off" });
    storeScene(1);
    const current = JSON.stringify(getPreset()), bank = JSON.stringify(state.scenes);
    const invalidPayloads = [
      null, [], { type: "unknown", preset: { seed: "changed" } },
      { type: "ascii-bpm-scene", version: 999, preset: { seed: "changed" } },
      { type: "ascii-bpm-scene", preset: [] },
      { type: "ascii-bpm-scene-bank", version: 3, scenes: [] },
      { type: "ascii-bpm-scene-bank", scenes: Array(9).fill(null) },
      { type: "ascii-bpm-scene-bank", selectedSlot: "Infinity", scenes: [{ seed: "changed" }] },
      { type: "ascii-bpm-scene-bank", scenes: [{ seed: "changed" }, { lyrics: { nested: "invalid" } }] },
      { seed: "changed", bpm: "Infinity" }, { seed: "changed", scanlines: [] },
      { seed: "changed", backgroundMode: "unknown" },
      { seed: "changed", lyrics: "X".repeat(maxTextareaChars + 1) }
    ];
    for (const payload of invalidPayloads) {
      controls.presetData.value = JSON.stringify(payload);
      loadPreset();
      assert(JSON.stringify(getPreset()) === current && JSON.stringify(state.scenes) === bank, "invalid scene or bank leaves look and saved bank unchanged");
      assert(controls.sceneReadout.textContent.includes("failed"), "invalid imports report a visible failure");
    }

    const originalParse = JSON.parse;
    let parseCalls = 0;
    JSON.parse = (...args) => { parseCalls++; return originalParse(...args); };
    try {
      rejects(() => parsePresetJson(" ".repeat(maxPresetJsonChars + 1)), "raw whitespace counts toward input limits");
      rejects(() => parsePresetInput(" ".repeat(maxSceneBankJsonChars + 1), "Scene", maxSceneBankJsonChars), "pasted input is bounded before trimming");
      rejects(() => parsePresetJson("[".repeat(20) + "0" + "]".repeat(20)), "deep JSON rejects before parsing");
      rejects(() => parsePresetJson("[" + "{},".repeat(300) + "{}]"), "container bombs reject before parsing");
      rejects(() => parsePresetJson("[" + "0,".repeat(5000) + "0]"), "large primitive arrays reject before parsing");
      assert(parseCalls === 0, "resource guards run before JSON.parse allocates untrusted structures");
    } finally { JSON.parse = originalParse; }
    const literal = '{"seed":"[{},] and \\\"quoted\\\" braces stay text"}';
    assert(parsePresetJson(literal).seed.includes("[{},]"), "JSON complexity scan ignores punctuation inside strings");

    const originalAtob = window.atob;
    let decodeCalls = 0;
    window.atob = (...args) => { decodeCalls++; return originalAtob(...args); };
    try {
      rejects(() => decodePresetFromUrl("A".repeat(maxPresetJsonChars * 4 + 1)), "oversized base64 is rejected before decoding");
      rejects(() => decodePresetFromUrl("A===garbage"), "malformed base64 is rejected before decoding");
      assert(decodeCalls === 0, "base64 preflight prevents decoder allocation");
    } finally { window.atob = originalAtob; }
    rejects(() => decodePresetFromUrl(btoa(String.fromCharCode(255))), "invalid UTF-8 is rejected");
    rejects(() => decodePresetFromUrl(btoa(JSON.stringify({ seed: "X".repeat(maxPresetJsonChars) }))), "decoded URL text is bounded before JSON parsing");
    rejects(() => decodePresetFromUrl(btoa(JSON.stringify({ type: "ascii-bpm-scene-bank", scenes: [] }))), "share URL cannot smuggle a bank envelope");
    const unicode = { ...getPreset(), lyrics: "HELLO 世界 — CAFÉ", seed: "unicode-safe" };
    assert(decodePresetFromUrl(encodePresetForUrl(unicode)).lyrics === unicode.lyrics, "bounded UTF-8 decoding preserves Unicode shares");

    controls.maskArt.value = "X".repeat(30000) + "\n" + "Y\n".repeat(14000);
    controls.maskMode.value = "texture";
    const mask = parseMask();
    assert(mask.width === 30000 && mask.height === 14001, "sparse mask geometry is preserved");
    assert(mask.rows.reduce((sum, row) => sum + row.length, 0) <= maxTextareaChars, "sparse mask storage stays bounded by source text instead of rectangular area");
    const previousOptions = state.options;
    state.options = { ...state.options, maskScale: 1 };
    assert(sampleMask(mask, 0, 1, mask.width, mask.height) === "Y" && sampleMask(mask, 2, 1, mask.width, mask.height) === null, "sparse rows sample missing cells as blanks");
    state.options.maskScale = Infinity;
    assert(sampleMask(mask, 0, 1, mask.width, mask.height) == null, "non-finite mask scale cannot produce an invalid row access");
    state.options = previousOptions;
    controls.maskMode.value = "off";
    controls.maskArt.value = "";
    controls.lyricMode.value = "phrases";
    controls.lyrics.value = "A".repeat(100000);
    assert(parseWords()[0].text.length <= 256, "a rendered phrase has a bounded glyph workload");
    controls.lyrics.value = "A\n\n".repeat(1000);
    assert(parseSections().length <= 128, "section parsing has a fixed upper bound");
    assert(clamp(NaN, 0, 1) === 0 && clamp(Infinity, 0, 1) === 1 && clamp(-Infinity, 0, 1) === 0, "non-finite arithmetic cannot escape numeric bounds");
    assert(Object.keys(normalizePreset({ bpm: Infinity, glyphSize: NaN, seed: { nested: true } })).length === 0, "normalization ignores non-finite and non-scalar settings");

    // Imported markup stays plain content throughout controls and scene names.
    const markup = '<img src=x onerror="window.securityTestExecuted=true">';
    controls.presetData.value = JSON.stringify({ sceneName: markup, seed: markup, lyrics: "SAFE WORDS" });
    loadPreset();
    assert(controls.seed.value === markup && controls.sceneName.value === markup, "markup imports as literal text");
    assert(!controls.sceneSlots.querySelector("img,script") && !window.securityTestExecuted, "scene labels never interpret imported markup");
    const bankBeforeStorageCheck = JSON.stringify(state.scenes);
    localStorage.setItem("asciiBpmScenes", JSON.stringify(Array(9).fill({ seed: "invalid" })));
    loadSceneSlots();
    assert(JSON.stringify(state.scenes) === bankBeforeStorageCheck, "invalid persisted scene bank preserves the current bank");
    saveSceneSlots();
    const setupBefore = localStorage.getItem("asciiBpmSetup"), lookBeforeSetup = JSON.stringify(getPreset()), slotBeforeSetup = state.selectedSceneSlot;
    localStorage.setItem("asciiBpmSetup", JSON.stringify({ selectedSlot: 8, intervalMinutes: { nested: true } }));
    loadSetup();
    assert(state.selectedSceneSlot === slotBeforeSetup && JSON.stringify(getPreset()) === lookBeforeSetup, "invalid saved setup rejects before changing selection or current look");
    if (setupBefore == null) localStorage.removeItem("asciiBpmSetup");
    else localStorage.setItem("asciiBpmSetup", setupBefore);

    const upload = document.getElementById("sceneFile");
    const uploadFile = file => {
      Object.defineProperty(upload, "files", { configurable: true, value: [file] });
      upload.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    controls.presetData.value = "Keep this import text";
    const beforeFile = JSON.stringify(getPreset()), beforeFileBank = JSON.stringify(state.scenes);
    let fileReads = 0;
    uploadFile({ size: maxSceneBankJsonChars * 3 + 1, text: async () => { fileReads++; return "{}"; } });
    await settle();
    assert(fileReads === 0 && controls.presetData.value === "Keep this import text", "oversized file bytes reject before reading or replacing the import editor");
    uploadFile({ size: 1, text: async () => " ".repeat(maxSceneBankJsonChars + 1) });
    await settle();
    assert(JSON.stringify(getPreset()) === beforeFile && JSON.stringify(state.scenes) === beforeFileBank
      && controls.presetData.value === "Keep this import text", "oversized decoded file text preserves the look, bank, and editor");
    let finishOlder;
    uploadFile({ size: 20, text: () => new Promise(resolve => { finishOlder = resolve; }) });
    uploadFile({ size: 20, text: async () => JSON.stringify({ seed: "newest-file" }) });
    await settle();
    finishOlder(JSON.stringify({ seed: "stale-file" })); await settle();
    assert(controls.seed.value === "newest-file" && controls.presetData.value.includes("newest-file"), "a late file read cannot replace a more recent import");
    quiet();
    document.body.innerHTML = "<p>PASS: bounded JSON/base64/UTF-8/file input, atomic validation, stale-file isolation, sparse mask memory, bounded text work, numeric safety, literal markup, and persisted bank failure recovery</p>";
  } catch (error) {
    quiet();
    document.body.innerHTML = "";
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
