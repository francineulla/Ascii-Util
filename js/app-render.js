"use strict";

// Renderer dispatch, canvas presentation, effects, and preview lifecycle.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function getScanlineSettings(options) {
  const numeric = (id, min, max) => {
    const value = Number(options[id] ?? displayDefaults[id]);
    return clamp(Number.isFinite(value) ? value : Number(displayDefaults[id]), min, max);
  };
  const spacing = numeric("scanlineSpacing", 2, 12);
  return { opacity: numeric("scanlineStrength", 0, 40) / 100, spacing, thickness: spacing * numeric("scanlineThickness", 10, 75) / 100 };
}

function applyPresentationClasses(target, options) {
  if (!target) return;
  const scan = getScanlineSettings(options);
  target.style.setProperty("--scanline-color", `rgba(255,255,255,${scan.opacity})`);
  target.style.setProperty("--scanline-spacing", `${scan.spacing}px`);
  target.style.setProperty("--scanline-thickness", `${scan.thickness}px`);
  target.classList.toggle("invert", Boolean(options.invert));
  target.classList.toggle("scanlines", Boolean(options.scanlines));
  target.classList.toggle("recording", Boolean(options.recordingMode));
}

function drawScanlines(ctx, width, height, options) {
  if (!options.scanlines) return;
  const scan = getScanlineSettings(options);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = `rgba(255,255,255,${scan.opacity})`;
  for (let y = 0; y < height; y += scan.spacing) ctx.fillRect(0, y, width, scan.thickness);
  ctx.restore();
}

function getEffectiveGlyphSize(width = window.innerWidth, height = window.innerHeight) {
  return Math.max(6, state.options.glyphSize * getQualityProfile().glyphScale);
}

function setupCanvas(canvas = controls.canvas, width = window.innerWidth, height = window.innerHeight) {
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.floor(width * dpr);
  const targetHeight = Math.floor(height * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const contextKey = canvas === controls.previewCanvas ? "previewContext" : "canvasContext";
  if (!state[contextKey]) state[contextKey] = canvas.getContext("2d");
  state[contextKey].setTransform(dpr, 0, 0, dpr, 0, 0);
  if (canvas === controls.canvas) {
    state.canvasWidth = width;
    state.canvasHeight = height;
  }
  return state[contextKey];
}

function renderFrameToCanvas(frame, canvas = controls.canvas, width = window.innerWidth, height = window.innerHeight) {
  const ctx = setupCanvas(canvas, width, height);
  if (frame.pixelmusic) {
    Pixelmusic3000.draw(ctx, frame.pixelmusic, width, height);
    return;
  }
  if (frame.nethack) {
    NetHackVisualizer.draw(ctx, frame.nethack, width, height);
    return;
  }
  if (frame.vm2) {
    VideoMusic2.draw(ctx, frame.vm2, width, height);
    return;
  }
  if (frame.atari) {
    AtariVideoMusic.draw(ctx, frame.atari, width, height);
    return;
  }
  const glyphSize = getEffectiveGlyphSize(width, height);
  const charWidth = glyphSize * 0.62;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${glyphSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.shadowBlur = getQualityProfile().glow;

  let lastColor = "";
  for (let y = 0; y < frame.grid.length; y += 1) {
    const row = frame.grid[y];
    const py = y * glyphSize;
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (cell.char === " ") continue;
      const color = colorForCell(cell, x, y, frame);
      if (color !== lastColor) {
        ctx.fillStyle = color;
        if (ctx.shadowBlur) ctx.shadowColor = color;
        lastColor = color;
      }
      ctx.fillText(cell.char, x * charWidth, py);
    }
  }
}

function triggerBeatFlash(beatIndex, options) {
  if (state.lastBeat === beatIndex) return;
  state.lastBeat = beatIndex;
  const beatInBar = beatIndex % options.barLength;
  const shouldFlash = options.beatFlash && (!options.downbeatFlash || beatInBar === 0);
  if (options.stageBeatIndicator) {
    controls.beatDot.classList.remove("pop");
    void controls.beatDot.offsetWidth;
    controls.beatDot.classList.add("pop");
    controls.stageInfo.textContent = `${getStatusText(options, state.currentFps)} / ${beatInBar + 1}.${options.barLength}`;
  }
  if (shouldFlash) {
    controls.beat.classList.remove("pop");
    void controls.beat.offsetWidth;
    controls.beat.classList.add("pop");
  }
}

function buildFrame(now, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight, suppressEffects = false) {
  const options = state.options;
  const effectiveGlyphSize = getEffectiveGlyphSize(viewportWidth, viewportHeight);
  const lineHeight = effectiveGlyphSize;
  const charWidth = effectiveGlyphSize * 0.62;
  const width = Math.max(24, Math.floor(viewportWidth / charWidth));
  const height = Math.max(12, Math.floor(viewportHeight / lineHeight));
  const beatMs = 60000 / options.bpm;
  const elapsed = Math.max(0, now - state.startedAt);
  const beatIndex = Math.floor(elapsed / beatMs);
  const barIndex = Math.floor(beatIndex / options.barLength);
  const beatInBar = beatIndex % options.barLength;
  const wordPeriod = beatMs * options.beatRate;
  const wordStepIndex = Math.floor(elapsed / wordPeriod);
  const wordPhase = (elapsed % wordPeriod) / wordPeriod;
  const beatPhase = 1 - ((elapsed % beatMs) / beatMs);
  if (options.visualizerMode === "pixelmusic") {
    const signal = options.pmInput === "demo" ? AtariVideoMusic.demoSignal(elapsed, options.bpm, state.seedValue)
      : getSynthAudioSignal(options.audioResponse);
    const pixelmusic = Pixelmusic3000.buildFrame(options, elapsed, signal, state.seedValue, state.pixelmusicFrame, state.pixelmusicActions);
    state.pixelmusicFrame = pixelmusic;
    if (!suppressEffects) triggerBeatFlash(beatIndex, { ...options, beatFlash: false });
    return { grid: [], pixelmusic, beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed };
  }
  if (options.visualizerMode === "nethack") {
    const nethack = NetHackVisualizer.buildFrame(options, elapsed, state.seedValue, { ...audioState.features, level: audioState.level });
    if (!suppressEffects) triggerBeatFlash(beatIndex, { ...options, beatFlash: false });
    return { grid: [], nethack, beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed };
  }
  if (options.visualizerMode === "atari" || options.visualizerMode === "vm2") {
    const extended = options.visualizerMode === "vm2";
    const signal = (extended ? options.vm2Input : options.atariInput) === "demo"
      ? AtariVideoMusic.demoSignal(elapsed, options.bpm, state.seedValue)
      : getSynthAudioSignal(options.audioResponse);
    const picture = extended
      ? { vm2: VideoMusic2.buildFrame(options, elapsed, signal, state.seedValue, state.vm2Frame) }
      : { atari: AtariVideoMusic.buildFrame(options, elapsed, signal, state.seedValue) };
    if (extended) state.vm2Frame = picture.vm2;
    // Keep transport timing intact so scene queues and interval playback work in either mode.
    if (!suppressEffects) triggerBeatFlash(beatIndex, { ...options, beatFlash: false });
    return {
      grid: [], ...picture,
      beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed
    };
  }
  const frameSeed = state.seedValue ^ Math.imul(wordStepIndex + 1, 2654435761);
  const random = mulberry32(frameSeed);
  const motionRandom = mulberry32(frameSeed ^ 0x9E3779B9);
  const charset = getCharset();
  const audioLevel = options.audioResponse === "full" ? audioState.level : audioState.features[options.audioResponse] ?? audioState.level;
  const grid = makeBlank(width, height);
  const mask = state.mask;
  const activeWords = getActiveWords(beatIndex);
  state.activeWords = activeWords;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const shade = clamp(shadeFor(x, y, width, height, elapsed, beatPhase, random) * (1 + audioLevel * 0.4), 0, 1);
      const index = Math.floor(shade * (charset.length - 1));
      setCell(grid, x, y, charset[index], "bg", shade);
    }
  }

  if (state.options.maskLayer === "behind" || state.options.maskLayer === "replace") {
    applyMaskToBackground(grid, mask, charset, beatPhase, random);
  }

  if (options.backgroundOnly) {
    if (!suppressEffects) triggerBeatFlash(beatIndex, options);
    return { grid, beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed };
  }

  if (state.options.maskLayer === "replace" && mask && state.options.maskMode !== "off") {
    if (!suppressEffects) triggerBeatFlash(beatIndex, options);
    return { grid, beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed };
  }

  const leadToken = activeWords[wordStepIndex % activeWords.length];
  const secondaryToken = activeWords[(wordStepIndex + 3) % activeWords.length];
  const leadWord = tokenText(leadToken);
  const secondary = tokenText(secondaryToken);
  const pulse = Math.sin(wordPhase * Math.PI);
  const emphasisBoost = leadToken.emphasis === "huge" ? 2 : leadToken.emphasis === "secondary" ? -1 : 0;
  const bigScale = clamp(Math.floor(width / Math.max(12, leadWord.length * 2.8)) + Math.round(pulse * 2 + audioLevel * 2) + emphasisBoost, 1, 8);
  const placement = getWordPlacement(width, height, elapsed, beatMs, beatIndex, wordStepIndex, wordPhase, bigScale, motionRandom);
  const leadRole = leadToken.emphasis === "secondary" ? "secondary" : "lead";

  for (const item of placement.stack) {
    stampWord(grid, leadWord, item.x, item.y, Math.max(1, placement.leadScale - 1), random, "secondary");
  }
  stampWord(grid, leadWord, placement.leadX, placement.leadY, placement.leadScale, random, leadRole);
  if (state.options.density > 2) {
    stampWord(grid, secondary, placement.secondaryX, placement.secondaryY, placement.secondaryScale, random, "secondary");
  }
  stampMicroText(grid, wordStepIndex, random);

  if (state.options.maskLayer === "front") {
    overlayMask(grid, mask, charset, beatPhase, random);
  }

  if (options.glitch > 0.02) {
    const tears = Math.floor(options.glitch * 10);
    for (let i = 0; i < tears; i += 1) {
      const y = Math.floor(random() * height);
      const shift = Math.floor((random() - 0.5) * width * options.glitch);
      if (shift > 0) grid[y].unshift(...grid[y].splice(width - shift, shift));
      if (shift < 0) grid[y].push(...grid[y].splice(0, -shift));
    }
  }

  if (!suppressEffects) triggerBeatFlash(beatIndex, options);

  return { grid, beatIndex, barIndex, beatInBar, wordStepIndex, beatPhase, wordPhase, elapsed };
}

function renderFrame(frame) {
  state.currentFrame = frame;
  if (!frame.atari && !frame.vm2 && !frame.nethack && !frame.pixelmusic && state.options.colorMode === "classic" && !state.options.recordingMode) {
    controls.ascii.classList.remove("colorized");
    controls.ascii.hidden = false;
    controls.canvas.hidden = true;
    controls.ascii.textContent = frameToText(frame.grid);
    return;
  }

  controls.ascii.classList.add("colorized");
  controls.ascii.hidden = true;
  controls.canvas.hidden = false;
  // Size the on-screen CRT to the viewport; fixed capture formats are applied on export.
  const capture = frame.atari || frame.vm2 || frame.nethack || frame.pixelmusic ? { width: window.innerWidth, height: window.innerHeight } : getCaptureSize();
  renderFrameToCanvas(frame, controls.canvas, capture.width, capture.height);
}

function prepareStateFromControls(preserveStart = false) {
  state.options = applyOptionMacros(collectOptions());
  const textMode = state.options.visualizerMode === "ascii";
  state.words = textMode ? parseWords() : [];
  state.sections = textMode ? parseSections() : [];
  state.mask = textMode ? parseMask() : null;
  state.seedValue = hashString(textMode ? `${controls.seed.value}|${state.words.map(tokenText).join("|")}` : controls.seed.value);
  if (!preserveStart) {
    state.startedAt = performance.now();
    state.vm2Frame = null;
    state.pixelmusicFrame = null;
    state.pixelmusicActions = { patternNext: 0, paletteNext: 0 };
  }
}

function renderPreview(now = performance.now()) {
  if (!controls.previewCanvas || state.running) return;
  syncPixelmusicPreviewSession();
  const previous = {
    options: state.options,
    words: state.words,
    mask: state.mask,
    sections: state.sections,
    activeWords: state.activeWords,
    seedValue: state.seedValue,
    startedAt: state.startedAt,
    lastBeat: state.lastBeat,
    vm2Frame: state.vm2Frame,
    pixelmusicFrame: state.pixelmusicFrame,
    pixelmusicActions: state.pixelmusicActions
  };

  try {
    if (!state.previewPrepared) {
      prepareStateFromControls();
      state.previewPrepared = {
        options: state.options, words: state.words, sections: state.sections,
        mask: state.mask, seedValue: state.seedValue
      };
    } else {
      Object.assign(state, state.previewPrepared);
    }
    applyPresentationClasses(controls.previewPanel, state.options);
    state.vm2Frame = state.previewVm2Frame;
    state.pixelmusicFrame = state.previewPixelmusicFrame;
    state.pixelmusicActions = state.previewPixelmusicActions;
    if (!state.previewStartedAt) state.previewStartedAt = now;
    const staticElapsed = state.options.visualizerMode === "pixelmusic" ? state.previewPixelmusicFrame?.elapsedMs ?? 420 : 420;
    state.startedAt = controls.livePreview.checked ? state.previewStartedAt : now - staticElapsed;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const frame = buildFrame(now, width, height, true);
    state.previewFrame = frame;
    if (frame.vm2) state.previewVm2Frame = frame.vm2;
    if (frame.pixelmusic) state.previewPixelmusicFrame = frame.pixelmusic;
    const lines = frame.pixelmusic ? ["Pixelmusic 3000"] : frame.nethack ? ["NetHack dungeon"] : frame.vm2 ? ["Video Music 2"] : frame.atari ? ["Atari Video Music"] : frameToText(frame.grid.slice(0, 22)).split("\n");
    if (controls.previewAscii) controls.previewAscii.textContent = lines.join("\n");
    renderFrameToCanvas(frame, controls.previewCanvas, width, height);
    if (frame.pixelmusic) {
      const monitor = document.getElementById("pixelmusicMonitor");
      const monitorHeight = state.options.pmStretch ? Math.max(120, Math.round(480 * height / width)) : 360;
      if (monitor.height !== monitorHeight) monitor.height = monitorHeight;
      monitor.style.filter = state.options.invert ? "invert(1) contrast(1.35)" : "none";
      Pixelmusic3000.draw(monitor.getContext("2d"), frame.pixelmusic, monitor.width, monitor.height);
      drawScanlines(monitor.getContext("2d"), monitor.width, monitor.height, state.options);
      updatePixelmusicReadout(frame.pixelmusic);
    }
    if (frame.nethack) {
      const monitor = document.getElementById("nethackMonitor");
      const ctx = monitor.getContext("2d");
      monitor.style.filter = state.options.invert ? "invert(1) contrast(1.35)" : "none";
      const monitorHeight = Math.max(120, Math.round(480 * height / width));
      if (monitor.height !== monitorHeight) monitor.height = monitorHeight;
      NetHackVisualizer.draw(ctx, frame.nethack, monitor.width, monitor.height);
      drawScanlines(ctx, monitor.width, monitor.height, state.options);
    }
    if (frame.atari) {
      const monitor = document.getElementById("atariMonitor");
      const monitorHeight = frame.atari.stretch ? Math.max(120, Math.round(480 * height / width)) : 360;
      if (monitor.height !== monitorHeight) monitor.height = monitorHeight;
      monitor.style.aspectRatio = `${monitor.width} / ${monitor.height}`;
      monitor.style.filter = state.options.invert ? "invert(1) contrast(1.35)" : "none";
      AtariVideoMusic.draw(monitor.getContext("2d"), frame.atari, monitor.width, monitor.height);
      drawScanlines(monitor.getContext("2d"), monitor.width, monitor.height, state.options);
    }
    if (frame.vm2) {
      const monitor = document.getElementById("vm2Monitor");
      const monitorHeight = Math.max(120, Math.round(480 * height / width));
      if (monitor.height !== monitorHeight) monitor.height = monitorHeight;
      monitor.style.filter = state.options.invert ? "invert(1) contrast(1.35)" : "none";
      VideoMusic2.draw(monitor.getContext("2d"), frame.vm2, monitor.width, monitor.height);
      drawScanlines(monitor.getContext("2d"), monitor.width, monitor.height, state.options);
    }
    const fps = controls.livePreview.checked
      ? trackFps(now, "previewFpsSamples", "lastPreviewFrameAt", "currentPreviewFps")
      : 0;
    controls.previewReadout.textContent = getStatusText(state.options, fps);
  } catch (error) {
    applyPresentationClasses(controls.previewPanel, collectOptions());
    if (controls.previewAscii) controls.previewAscii.textContent = "Preview failed";
    controls.previewReadout.textContent = error && error.message ? error.message : "Preview error";
  } finally {
    state.options = previous.options;
    state.words = previous.words;
    state.mask = previous.mask;
    state.sections = previous.sections;
    state.activeWords = previous.activeWords;
    state.seedValue = previous.seedValue;
    state.startedAt = previous.startedAt;
    state.lastBeat = previous.lastBeat;
    state.vm2Frame = previous.vm2Frame;
    state.pixelmusicFrame = previous.pixelmusicFrame;
    state.pixelmusicActions = previous.pixelmusicActions;
  }
}

function resetPixelmusicPreview() {
  state.previewPixelmusicFrame = null;
  state.previewPixelmusicActions = { patternNext: 0, paletteNext: 0 };
  state.previewPixelmusicKey = "";
}

function syncPixelmusicPreviewSession() {
  const pixelmusicKey = JSON.stringify([controls.visualizerMode.value, controls.seed.value, controls.pmInput.value]);
  if (state.previewPixelmusicKey !== pixelmusicKey) {
    resetPixelmusicPreview();
    state.previewPixelmusicKey = pixelmusicKey;
  }
}

function schedulePreview() {
  updateContextualControls();
  updateSceneDirty();
  state.previewPrepared = null;
  state.previewFrame = null;
  state.previewVm2Frame = null;
  syncPixelmusicPreviewSession();
  if (state.running) return;
  clearTimeout(state.previewTimer);
  if (controls.livePreview.checked) {
    startPreviewLoop();
    return;
  }
  state.previewTimer = setTimeout(() => renderPreview(), 80);
}

function startPreviewLoop() {
  if (state.running || !controls.livePreview.checked || state.previewRaf) return;
  if (!state.previewStartedAt) state.previewStartedAt = performance.now();
  state.previewRaf = requestAnimationFrame(previewLoop);
}

function stopPreviewLoop() {
  cancelAnimationFrame(state.previewRaf);
  state.previewRaf = 0;
  state.lastPreviewAt = 0;
}

function previewLoop(now) {
  state.previewRaf = 0;
  if (state.running || !controls.livePreview.checked) return;
  if (!state.lastPreviewAt || now - state.lastPreviewAt >= 1000 / 18) {
    state.lastPreviewAt = now;
    renderPreview(now);
  }
  state.previewRaf = requestAnimationFrame(previewLoop);
}
