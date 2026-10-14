(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const stopBackgroundWork = () => {
    cancelAnimationFrame(state.raf);
    stopPreviewLoop();
    clearTimeout(state.previewTimer);
  };
  const change = (id, value) => {
    const control = el(id);
    if (control.type === "checkbox") control.checked = value;
    else control.value = value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    stopBackgroundWork();
  };
  const space = target => {
    const event = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const snapshotDocument = () => {
    // Layout runs inside real responsive viewports. Remove scripts from the clone so
    // it cannot start a second visualizer, write storage, or recursively run checks.
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll("script, iframe").forEach(node => node.remove());
    const base = document.createElement("base");
    base.href = location.href;
    copy.querySelector("head").prepend(base);
    copy.querySelectorAll("details").forEach(details => { details.open = true; });
    copy.querySelector("#previewReadout").textContent = getStatusText(getPreset(), 60);
    for (const control of copy.querySelectorAll("select, input, textarea")) {
      const source = el(control.id);
      if (!source) continue;
      if (control.tagName === "SELECT") {
        for (const option of control.options) option.toggleAttribute("selected", option.value === source.value);
      } else if (control.type === "checkbox") control.toggleAttribute("checked", source.checked);
      else if (control.tagName === "TEXTAREA") control.textContent = source.value;
      else control.setAttribute("value", source.value);
    }
    return "<!doctype html>" + copy.outerHTML;
  };
  const inspectLayout = async (width, mode, stage = false) => {
    const markup = snapshotDocument();
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { width: `${width}px`, height: "844px", border: "0", position: "fixed", left: "0", top: "0", opacity: "0", pointerEvents: "none" });
    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error("responsive fixture could not load"));
    });
    frame.srcdoc = markup;
    document.body.append(frame);
    try {
      await loaded;
      const doc = frame.contentDocument;
      const viewport = doc.documentElement.clientWidth;
      assert(frame.contentWindow.innerWidth === width, `${mode}: iframe uses its requested ${width}px viewport`);
      assert(doc.documentElement.scrollWidth <= viewport + 1 && doc.body.scrollWidth <= viewport + 1,
        `${mode}: no horizontal document overflow at ${width}px (${doc.documentElement.scrollWidth}/${doc.body.scrollWidth})`);
      const root = doc.getElementById(stage ? "stage" : "menu");
      const clipped = [];
      for (const control of root.querySelectorAll("input, select, textarea, button, summary, canvas, meter")) {
        if (!control.getClientRects().length) continue;
        const rect = control.getBoundingClientRect();
        if (rect.width <= 0 || rect.left < -1 || rect.right > viewport + 1) clipped.push(control.id || control.textContent.trim().slice(0, 24));
        const section = control.closest(".control-section");
        if (section) {
          const bounds = section.getBoundingClientRect();
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) clipped.push(`${control.id}: clipped by section`);
        }
        if ((width === 390 || stage) && control.matches("button, summary")) assert(rect.height >= 40, `${mode}: ${control.id || "disclosure"} has a usable touch target at ${width}px`);
      }
      assert(!clipped.length, `${mode}: controls remain within visible bounds at ${width}px: ${clipped.join(", ")}`);
      if (stage) {
        for (const id of ["stageMenu", "stagePause"]) {
          const button = doc.getElementById(id), rect = button.getBoundingClientRect();
          assert(rect.bottom <= 844 && rect.top >= 0, `${mode}: ${id} fits within the playback viewport`);
          assert(frame.contentWindow.getComputedStyle(button.parentElement).pointerEvents === "auto", `${mode}: revealed toolbar accepts touch/pointer input`);
        }
      } else {
        const view = frame.contentWindow, bar = doc.querySelector(".title-row");
        const picker = doc.querySelector(".visualizer-picker");
        const pickerStart = picker.getBoundingClientRect().top;
        const maxScroll = doc.scrollingElement.scrollHeight - view.innerHeight;
        assert(maxScroll > 600, `${mode}: fixture has enough content to exercise sticky scrolling at ${width}px`);
        let previousBarTop = null;
        for (const target of [Math.min(520, maxScroll * 0.3), Math.min(1400, maxScroll * 0.7)]) {
          view.scrollTo({ top: target, left: 0, behavior: "instant" });
          const rect = bar.getBoundingClientRect();
          assert(view.scrollY > 200 && picker.getBoundingClientRect().top < pickerStart - 200,
            `${mode}: the document actually scrolls beneath the preview bar at ${width}px`);
          assert(rect.top >= -1 && rect.bottom <= view.innerHeight && rect.left >= 0 && rect.right <= viewport + 1,
            `${mode}: preview bar stays within the scrolled viewport at ${width}px`);
          if (previousBarTop !== null) assert(Math.abs(rect.top - previousBarTop) <= 1,
            `${mode}: preview bar holds its top position during continued scrolling at ${width}px`);
          previousBarTop = rect.top;
          for (const id of ["previewReadout", "livePreview", "refreshPreview"]) {
            const control = doc.getElementById(id), bounds = control.getBoundingClientRect();
            assert(bounds.width > 0 && bounds.top >= rect.top && bounds.bottom <= rect.bottom + 1,
              `${mode}: ${id} stays visible inside the sticky bar at ${width}px`);
            const hit = doc.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
            assert(hit && (hit === control || control.contains(hit) || (id === "livePreview" && hit === control.closest("label"))),
              `${mode}: ${id} remains above scrolling controls at ${width}px`);
          }
          assert(doc.documentElement.scrollWidth <= viewport + 1 && doc.body.scrollWidth <= viewport + 1,
            `${mode}: sticky preview bar causes no horizontal overflow while scrolling at ${width}px`);
        }
      }
    } finally { frame.remove(); }
  };

  try {
    stopBackgroundWork();
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false;
    applyPreset({ ...getPreset(), visualizerMode: "ascii", livePreview: false, fullscreenOnStart: false,
      recordingMode: false, transitionMode: "cut", quality: "low", beatFlash: false, downbeatFlash: true,
      wordHalo: false, haloSize: "17", maskMode: "off", maskScale: "5", autoSections: false, sectionBars: "11",
      charsetPreset: "full", customCharset: "ABC", lyricMode: "phrases", splitWords: true });
    stopBackgroundWork();

    for (const control of document.querySelectorAll("label input, label select, label textarea")) {
      assert(control.labels.length > 0, `${control.id} retains its visible label even when a value output precedes the input`);
    }
    for (const [id, value, suffix] of [["audioAttack", "37", "ms"], ["audioRelease", "460", "ms"], ["audioGate", "-36", "dBFS"]]) {
      const control = el(id);
      assert(control.labels.length > 0 && el(control.getAttribute("aria-describedby")), `${id} has a visible label and response explanation`);
      change(id, value);
      assert(el(`${id}Value`).textContent.includes(value) && el(`${id}Value`).textContent.includes(suffix), `${id} readout follows its control with units`);
    }
    change("audioResponse", "transient");
    assert(el("audioResponse").labels.length > 0 && getPreset().audioResponse === "transient", "audio response is labelled and included in the scene");
    for (const side of ["Left", "Right"]) {
      const meter = el(`audioLevel${side}`), clip = el(`audioClip${side}`);
      assert(meter.tagName === "METER" && meter.min === 0 && meter.max === 1 && meter.labels.length > 0, `${side} meter exposes its channel name and normalized range`);
      assert(clip.getAttribute("aria-label").includes(side) && clip.getAttribute("aria-live") === "off", `${side} clipping status has a channel label without constant live announcements`);
    }
    await inspectLayout(320, "audio controls");

    const contextual = [
      ["wordHalo", true, "haloSize", "17"], ["beatFlash", true, "downbeatFlash", true],
      ["autoSections", true, "sectionBars", "11"], ["maskMode", "stencil", "maskScale", "5"],
      ["charsetPreset", "custom", "customCharset", "ABC"], ["lyricMode", "words", "splitWords", true]
    ];
    for (const [trigger, on, dependent, expected] of contextual) {
      assert(el(dependent).disabled, `${dependent} starts disabled when its feature is inactive`);
      change(trigger, on);
      assert(!el(dependent).disabled, `${dependent} enables when its feature is active`);
      const actual = el(dependent).type === "checkbox" ? el(dependent).checked : el(dependent).value;
      assert(actual === expected, `${dependent} preserves its configured value across disabled state`);
    }
    change("scanlines", false);
    for (const id of ["scanlineStrength", "scanlineSpacing", "scanlineThickness"]) assert(el(id).disabled, `${id} disables with scanlines`);
    change("scanlines", true);
    for (const id of ["scanlineStrength", "scanlineSpacing", "scanlineThickness"]) assert(!el(id).disabled, `${id} enables with scanlines`);
    change("intervalMode", true);
    assert(!intervalMinutes.disabled, "interval time enables with the interval feature");
    change("intervalMode", false);
    assert(intervalMinutes.disabled, "interval time disables without clearing its value");
    change("sceneEffect", "crossfade");
    assert(!el("sceneDuration").disabled, "transition duration enables with an effect");
    change("sceneEffect", "none");
    assert(el("sceneDuration").disabled, "transition duration disables when no effect is selected");

    const summary = document.querySelector("details:not([hidden]) > summary");
    summary.focus();
    assert(!space(summary).defaultPrevented && !controls.livePreview.checked, "Space on a disclosure is not hijacked into live preview");
    const initialOpen = summary.parentElement.open;
    summary.click();
    assert(summary.parentElement.open !== initialOpen, "disclosure retains its native activation");
    summary.parentElement.open = true;
    controls.refreshPreview.focus();
    assert(!space(controls.refreshPreview).defaultPrevented && !controls.livePreview.checked, "Space on a menu button retains native keyboard activation");

    applyPreset({ ...getPreset(), visualizerMode: "atari", atariShape: "auto", atariHorizontal: "5", atariVertical: "8" });
    assert(!el("atariAutoControls").hidden && el("atariHorizontal").disabled && el("atariVertical").disabled, "Atari preset updates automatic controls");
    change("atariShape", "solid");
    assert(el("atariAutoControls").hidden && !el("atariHorizontal").disabled && el("atariHorizontal").value === "5" && el("atariVertical").value === "8", "manual Atari layout survives automatic mode");
    applyPreset({ ...getPreset(), visualizerMode: "vm2", vm2Shape: "auto", vm2Aspect: "custom", vm2AspectWidth: "2.35", vm2AspectHeight: "1", vm2Columns: "7", vm2Rows: "5" });
    assert(!el("vm2AutoControls").hidden && el("vm2Columns").disabled && !el("vm2CustomAspect").hidden, "VM2 preset updates automatic and custom-ratio controls");
    change("vm2Shape", "ring"); change("vm2Aspect", "viewport");
    assert(el("vm2AutoControls").hidden && !el("vm2Columns").disabled && el("vm2Columns").value === "7" && el("vm2Rows").value === "5", "manual VM2 layout survives automatic mode");
    change("vm2Aspect", "custom");
    assert(el("vm2AspectWidth").value === "2.35" && el("vm2AspectHeight").value === "1", "custom aspect survives hiding and showing controls");

    applyPreset({ ...getPreset(), visualizerMode: "pixelmusic", pmRoutine: "auto", pmAutomation: "original", pmChangeEvery: "4", pmPatternHold: false, pmPaletteHold: false });
    assert(el("pmTimingControls").hidden && el("pmChangeEvery").disabled, "original Pixelmusic timing hides and disables the unused beat interval");
    change("pmAutomation", "beats");
    assert(!el("pmTimingControls").hidden && !el("pmChangeEvery").disabled, "beat timing reveals the editable interval");
    change("pmChangeEvery", "8");
    change("pmAutomation", "bars");
    assert(el("pmChangeEvery").value === "8" && !el("pmTimingControls").hidden, "bar timing retains the selected interval");
    change("pmAutomation", "original");
    assert(el("pmChangeEvery").value === "8" && el("pmChangeEvery").disabled, "returning to original timing preserves the interval");
    change("pmPatternHold", true); change("pmPaletteHold", true); change("pmFavorite3", false);
    change("pmRoutine", "3");
    assert(el("pmPatternHold").disabled && el("pmNextPattern").disabled && el("pmFavorite3").matches(":disabled"), "manual patterns disable pattern automation and favorite controls");
    assert(!el("pmPaletteHold").disabled && !el("pmNextPalette").disabled, "palette hold and stepping remain independent of the manual pattern");
    change("pmRoutine", "auto");
    assert(!el("pmPatternHold").disabled && el("pmPatternHold").checked && !el("pmNextPattern").disabled && !el("pmFavorite3").checked, "automatic patterns restore editable favorites and preserve the hold state");
    change("pmPalette", "pink");
    assert(!el("pmNextPalette").disabled && !el("pmPaletteHold").disabled && el("pmPaletteHold").checked, "fixed palette families still support independent hold and next controls");
    for (let pattern = 0; pattern < 8; pattern++) assert(el(`pmFavorite${pattern}`).labels.length > 0, `favorite ${pattern} has an accessible pattern name`);
    change("pmAutomation", "bars");
    await inspectLayout(320, "Pixelmusic automation");

    const panelModes = { atari: "atariPanel", vm2: "vm2Panel", nethack: "nethackPanel", pixelmusic: "pixelmusicPanel" };
    for (const mode of ["ascii", ...Object.keys(panelModes)]) {
      applyPreset({ ...getPreset(), visualizerMode: mode, atariShape: "auto", vm2Shape: "auto", vm2Aspect: "custom" });
      stopBackgroundWork();
      assert(controls.toolMode.value === (mode === "ascii" ? "text" : "video"), `${mode}: family selector follows scene changes`);
      for (const [panelMode, panelId] of Object.entries(panelModes)) {
        assert(el(panelId).hidden === (panelMode !== mode) && el(panelId).inert === (panelMode !== mode), `${mode}: ${panelId} visibility and keyboard availability agree`);
      }
      for (const section of document.querySelectorAll("[data-tools]")) {
        const hidden = section.dataset.tools !== controls.toolMode.value;
        assert(section.hidden === hidden && section.inert === hidden, `${mode}: unrelated family controls are hidden and inert`);
      }
      for (const width of [390, 1280]) await inspectLayout(width, mode);

      const origin = el(mode === "ascii" ? "start" : `${mode}Start`);
      origin.focus(); origin.click(); stopBackgroundWork();
      assert(state.running && !controls.stage.hidden && controls.menu.hidden && document.activeElement === controls.stage, `${mode}: Go enters focused playback`);
      assert(!el("stagePause").disabled && el("stagePause").textContent === "Pause" && el("stagePause").getAttribute("aria-pressed") === "false", `${mode}: playback starts with synchronized pause control`);
      el("stagePause").focus();
      assert(!space(el("stagePause")).defaultPrevented && !state.paused, `${mode}: Space on Pause is left for native button activation`);
      el("stagePause").click(); stopBackgroundWork();
      assert(state.paused && el("stagePause").textContent === "Resume" && el("stagePause").getAttribute("aria-pressed") === "true", `${mode}: Pause button updates state and accessible label`);
      controls.stage.focus();
      assert(space(controls.stage).defaultPrevented && !state.paused, `${mode}: Space on the stage resumes playback`);
      stopBackgroundWork();
      controls.stage.classList.remove("controls-visible");
      controls.stage.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
      assert(controls.stage.classList.contains("controls-visible"), `${mode}: touch reveals playback controls`);
      for (const width of [390, 1280]) await inspectLayout(width, `${mode} stage`, true);
      el("stageMenu").focus();
      assert(!space(el("stageMenu")).defaultPrevented && state.running, `${mode}: Space on Menu retains native button activation`);
      el("stageMenu").click(); stopBackgroundWork();
      assert(!state.running && !state.paused && controls.stage.hidden && !controls.menu.hidden && !document.body.classList.contains("playing"), `${mode}: Menu stops playback and restores the menu`);
      assert(document.activeElement === origin && el("stagePause").disabled && !controls.stage.classList.contains("controls-visible"), `${mode}: exit restores keyboard focus and clears playback controls`);
    }

    applyPreset({ ...getPreset(), visualizerMode: "atari", recordingMode: true, captureSize: "window" });
    el("atariStart").focus(); el("atariStart").click(); stopBackgroundWork();
    assert(controls.stage.classList.contains("recording") && !controls.stage.classList.contains("controls-visible"), "recording starts with a clean stage and no toolbar reveal");
    assert(getComputedStyle(el("stageControls")).pointerEvents === "none", "recording toolbar remains hidden until deliberately revealed");
    controls.stage.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    assert(getComputedStyle(el("stageControls")).pointerEvents === "auto", "touch can reveal playback controls during recording");
    el("stageMenu").click(); stopBackgroundWork();
    assert(document.activeElement === el("atariStart"), "recording exit also restores the initiating button");
    applyPreset({ ...getPreset(), recordingMode: false });
    el("atariStart").focus(); el("atariStart").click(); stopBackgroundWork();
    applyPreset({ ...getPreset(), visualizerMode: "ascii" });
    el("stageMenu").click(); stopBackgroundWork();
    assert(document.activeElement === controls.toolMode, "exit falls back to the visible mode selector when a scene hid the initiating button");

    document.body.innerHTML = "<p>PASS: responsive 320/390/1280px controls and sticky preview scrolling, all-mode menus/playback, keyboard activation, conditional values, stereo accessibility, touch/recording controls, pause lifecycle, and focus restoration</p>";
  } catch (error) {
    stopBackgroundWork();
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
