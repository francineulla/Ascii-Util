"use strict";

// Share and OBS URLs, canvas capture, and PNG downloads.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function copyObsUrl() {
  try {
    const encodedPreset = encodePresetForUrl(getPreset());
    const url = `${location.href.split("#")[0].split("?")[0]}?obs=1#preset=${encodedPreset}`;
    controls.obsReadout.textContent = url;
    controls.presetData.value = url;
    controls.presetData.select();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => document.execCommand("copy"));
    } else {
      document.execCommand("copy");
    }
  } catch (error) {
    controls.obsReadout.textContent = error.message;
  }
}

function copyShareUrl() {
  try {
    const encodedPreset = encodePresetForUrl(getPreset());
    const url = `${location.href.split("#")[0].split("?")[0]}#preset=${encodedPreset}`;
    controls.obsReadout.textContent = "Share URL copied";
    controls.presetData.value = url;
    controls.presetData.select();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => document.execCommand("copy"));
    } else {
      document.execCommand("copy");
    }
  } catch (error) {
    controls.obsReadout.textContent = error.message;
  }
}

function renderTextFrameToImage(frame) {
  const capture = getCaptureSize();
  const canvas = document.createElement("canvas");
  canvas.width = capture.width;
  canvas.height = capture.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (frame.atari || frame.vm2 || frame.nethack || frame.pixelmusic) {
    if (frame.pixelmusic) Pixelmusic3000.draw(ctx, frame.pixelmusic, canvas.width, canvas.height);
    else if (frame.nethack) NetHackVisualizer.draw(ctx, frame.nethack, canvas.width, canvas.height);
    else if (frame.vm2) VideoMusic2.draw(ctx, frame.vm2, canvas.width, canvas.height);
    else AtariVideoMusic.draw(ctx, frame.atari, canvas.width, canvas.height);
  } else {
    const glyphSize = getEffectiveGlyphSize(canvas.width, canvas.height);
    const charWidth = glyphSize * 0.62;
    const palette = palettePresets[state.options.palette] || palettePresets.cyber;
    const classicColor = `hsl(${palette.leadHue} ${palette.saturation}% ${palette.light}%)`;
    ctx.font = `${glyphSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.shadowBlur = state.options.colorMode === "classic" ? 5 : getQualityProfile().glow;
    for (let y = 0; y < frame.grid.length; y += 1) {
      for (let x = 0; x < frame.grid[y].length; x += 1) {
        const cell = frame.grid[y][x];
        if (cell.char === " ") continue;
        ctx.fillStyle = state.options.colorMode === "classic" ? classicColor : colorForCell(cell, x, y, frame);
        if (ctx.shadowBlur) ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(cell.char, x * charWidth, y * glyphSize);
      }
    }
  }
  ctx.shadowBlur = 0;
  drawScanlines(ctx, canvas.width, canvas.height, state.options);
  if (state.options.invert) {
    const inverted = document.createElement("canvas");
    inverted.width = canvas.width; inverted.height = canvas.height;
    const output = inverted.getContext("2d");
    output.filter = "invert(1) contrast(1.35)";
    output.drawImage(canvas, 0, 0);
    return inverted.toDataURL("image/png");
  }
  return canvas.toDataURL("image/png");
}

function saveFrame() {
  if (!state.running) {
    // A pending look edit must retain Pixelmusic's automatic selection and Next
    // history instead of exporting a fresh engine at the static default time.
    if (controls.visualizerMode.value === "pixelmusic" && !state.previewFrame?.pixelmusic) {
      clearTimeout(state.previewTimer);
      renderPreview();
    }
    prepareStateFromControls();
    const capture = getCaptureSize();
    const matchingPreview = state.options.visualizerMode === "atari" ? state.previewFrame?.atari
      : state.options.visualizerMode === "vm2" ? state.previewFrame?.vm2
        : state.options.visualizerMode === "nethack" ? state.previewFrame?.nethack
          : state.options.visualizerMode === "pixelmusic" ? state.previewFrame?.pixelmusic : null;
    state.currentFrame = matchingPreview
      ? state.previewFrame : buildFrame(state.startedAt + 420, capture.width, capture.height, true);
  }
  if (!state.currentFrame) return;

  const url = renderTextFrameToImage(state.currentFrame);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.currentFrame.pixelmusic ? "pixelmusic-3000" : state.currentFrame.nethack ? "nethack-dungeon" : state.currentFrame.vm2 ? "video-music-2" : state.currentFrame.atari ? "atari-video-music" : "ascii-bpm"}-${Date.now()}.png`;
  link.click();
  controls.obsReadout.textContent = "Frame saved";
}
