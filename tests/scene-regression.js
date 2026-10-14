(async () => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const press = (target, key, code = "", extra = {}) => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...extra }));
  };
  try {
    clearTimeout(state.previewTimer);
    stopPreviewLoop();
    if (sessionStorage.getItem("verifyReload")) {
      assert(state.selectedSceneSlot === 6, "selected slot restored after reload");
      assert(controls.seed.value === "saved-six", "selected scene restored after reload");
      assert(state.scenes[0].seed === "saved-one" && state.scenes[5].seed === "saved-six", "bank survives reload");
      assert(intervalMode.checked && intervalMinutes.value === "2.5", "interval setup survives reload");
      document.body.innerHTML = "<p>PASS: scene shortcuts, paused recall, transitions, imports, storage failures, and reload persistence</p>";
      return;
    }

    const base = getPreset();
    state.options.density = 8;
    state.activeWords = [{ text: "ZZZZ", emphasis: "normal" }];
    const background = Array.from({ length: 30 }, () => Array.from({ length: 80 }, () => ({ char: " ", role: "bg", shade: 0 })));
    stampMicroText(background, 0, mulberry32(42));
    const fragments = background.flat().filter(cell => cell.role === "micro");
    assert(fragments.length && fragments.every(cell => cell.char === "Z"), "background fragments use supplied lyrics only");
    state.scenes = Array.from({ length: 8 }, (_, i) => ({ ...base, seed: `scene-${i + 1}`, transitionMode: "cut" }));
    controls.start.focus();
    press(document.activeElement, "8", "Digit8");
    assert(controls.seed.value === "scene-8", "menu button focus allows scene recall");
    controls.lyrics.focus();
    press(document.activeElement, "1", "Digit1");
    assert(state.selectedSceneSlot === 8, "typing in setup does not recall scenes");

    intervalMode.checked = true;
    start();
    cancelAnimationFrame(state.raf);
    assert(document.activeElement === controls.stage, "playback receives keyboard focus");
    assert(state.selectedSceneSlot === 8 && controls.seed.value === "scene-8", "Go respects selected scene in interval mode");
    for (const mode of ["cut", "beat", "bar", "fade"]) {
      for (const slot of [8, 7, 6, 5, 4, 3, 2, 1, 8, 2]) {
        controls.transitionMode.value = mode;
        press(document.activeElement, String(slot), `Digit${slot}`);
        if (state.pendingPreset) {
          const frame = buildFrame(state.startedAt + state.pendingPreset.targetBeat * 60000 / state.options.bpm + 1, 320, 240, true);
          maybeApplyQueuedPreset(frame);
        }
        cancelAnimationFrame(state.raf);
        assert(controls.seed.value === `scene-${slot}`, `${mode} recall ${slot}`);
      }
    }
    press(document.activeElement, "End", "Numpad1");
    cancelAnimationFrame(state.raf);
    assert(state.selectedSceneSlot === 1, "number pad works with Num Lock off");
    press(document.activeElement, "é", "Digit2");
    cancelAnimationFrame(state.raf);
    assert(state.selectedSceneSlot === 2, "physical number row supports other layouts");
    press(document.activeElement, "1", "Digit1", { ctrlKey: true });
    assert(state.selectedSceneSlot === 2, "browser shortcuts preserved");
    state.scenes[0] = null;
    press(document.activeElement, "1", "Digit1");
    assert(state.selectedSceneSlot === 2 && controls.sceneReadout.textContent.includes("empty"), "empty slot preserves interval position and updates setup status");
    assert(!document.getElementById("sceneNotice"), "playback has no scene notification overlay");
    controls.transitionMode.value = "bar";
    togglePause();
    press(document.activeElement, "3", "Digit3");
    assert(state.paused && !state.pendingPreset && controls.seed.value === "scene-3", "paused recall displays scene without resuming or waiting for a beat");
    stop();
    clearTimeout(state.previewTimer);

    selectSceneSlot(4);
    controls.presetData.value = JSON.stringify({ type: "ascii-bpm-scene", preset: { ...base, seed: "single-import" } });
    loadPreset();
    assert(JSON.parse(localStorage.getItem("asciiBpmScenes"))[3].seed === "single-import", "single import saves automatically");
    const before = JSON.stringify(state.scenes);
    const invalid = JSON.stringify({ type: "ascii-bpm-scene-bank", scenes: [base, "invalid"] });
    controls.presetData.value = invalid;
    loadSceneBank();
    assert(JSON.stringify(state.scenes) === before && controls.presetData.value === invalid, "invalid bank preserves saved bank and pasted JSON");

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("storage unavailable"); };
    try {
      controls.presetData.value = JSON.stringify({ seed: "unsaved-import" });
      loadPreset();
      assert(controls.sceneReadout.textContent.includes("storage failed"), "storage failure is reported honestly");
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }

    const bank = { type: "ascii-bpm-scene-bank", selectedSlot: 6, scenes: [{ ...base, seed: "saved-one" }, null, null, null, null, { ...base, seed: "saved-six" }] };
    controls.presetData.value = JSON.stringify(bank);
    loadSceneBank();
    assert(state.selectedSceneSlot === 6 && JSON.parse(localStorage.getItem("asciiBpmScenes"))[5].seed === "saved-six", "bank import saves automatically");
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(bank)], "scenes.json", { type: "application/json" }));
    const input = document.getElementById("sceneFile");
    controls.sceneReadout.textContent = "Waiting for file import";
    input.files = transfer.files;
    input.dispatchEvent(new Event("change"));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(input.value === "" && controls.sceneReadout.textContent.includes("Imported and saved 2 scenes"), "JSON file import saves bank");
    intervalMode.checked = true;
    intervalMinutes.value = "2.5";
    intervalMinutes.dispatchEvent(new Event("change"));
    sessionStorage.setItem("verifyReload", "1");
    location.reload();
  } catch (error) {
    document.body.innerHTML = "";
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
