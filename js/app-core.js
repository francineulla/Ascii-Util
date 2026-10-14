"use strict";

// Seeded math, text parsing, option collection, and common timing helpers.
// Classic scripts share app-state.js bindings so index.html also works over file://.

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseTokensFromText(text) {
  if (!text) return [{ text: "VOID", emphasis: "normal" }];
  const mode = controls.lyricMode.value;
  const cleanLines = text
    .split(/\n+/)
    .map((line) => (mode === "markup" ? line.replace(/\/\/.*$/, "") : line).trim())
    .filter(Boolean);
  const source = cleanLines.join("\n");
  const pieces = mode === "phrases"
    ? cleanLines
    : mode === "markup"
      ? source.match(/\*[\p{L}\p{N}' ]+\*|\[[\p{L}\p{N}' ]+\]|[\p{L}\p{N}']+/gu) || []
      : controls.splitWords.checked
        ? source.match(/[\p{L}\p{N}']+/gu) || []
      : cleanLines;
  const tokens = pieces
    .map((piece) => parseToken(piece, mode === "markup"))
    .filter((token) => token.text)
    .slice(0, 800);
  return tokens.length ? tokens : [{ text: "VOID", emphasis: "normal" }];
}

function parseWords() {
  return parseTokensFromText(controls.lyrics.value.trim());
}

function parseSections() {
  const sections = controls.lyrics.value
    .replace(/\r/g, "")
    .split(/\n\s*\n+/)
    .map((section) => parseTokensFromText(section.trim()))
    .filter((section) => section.length);
  return sections.length ? sections : [parseWords()];
}

function parseToken(piece, allowMarkup = false) {
  let text = piece.trim();
  let emphasis = "normal";

  if (allowMarkup && text.startsWith("*") && text.endsWith("*") && text.length > 2) {
    emphasis = "huge";
    text = text.slice(1, -1);
  } else if (allowMarkup && text.startsWith("[") && text.endsWith("]") && text.length > 2) {
    emphasis = "secondary";
    text = text.slice(1, -1);
  }

  return {
    text: text.trim().toUpperCase(),
    emphasis
  };
}

function tokenText(token) {
  return typeof token === "string" ? token : token.text;
}

function parseMask() {
  const rawLines = controls.maskArt.value.replace(/\r/g, "").split("\n");
  let start = 0;
  let end = rawLines.length;
  while (start < end && rawLines[start].length === 0) start += 1;
  while (end > start && rawLines[end - 1].length === 0) end -= 1;
  const lines = rawLines.slice(start, end);
  if (!lines.some((line) => /[^\t ]/.test(line)) || controls.maskMode.value === "off") return null;

  const width = Math.max(...lines.map((line) => line.length));
  const rows = lines.map((line) => line.padEnd(width, " ").split(""));
  return {
    width,
    height: rows.length,
    rows
  };
}

function sampleMask(mask, x, y, gridWidth, gridHeight) {
  if (!mask) return null;
  const scale = Math.max(1, Number(state.options.maskScale) || 1);
  const targetWidth = mask.width * scale;
  const targetHeight = mask.height * scale;
  const startX = Math.floor((gridWidth - targetWidth) / 2);
  const startY = Math.floor((gridHeight - targetHeight) / 2);
  const mx = Math.floor((x - startX) / scale);
  const my = Math.floor((y - startY) / scale);

  if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return null;
  const char = mask.rows[my][mx];
  if (char === " " || char === "\t") return null;
  return char;
}

function collectOptions() {
  return {
    visualizerMode: controls.visualizerMode.value,
    audioResponse: controls.audioResponse.value,
    ...Object.fromEntries(Object.keys(atariDefaults).map(id => [id, controls[id].type === "checkbox" ? controls[id].checked : controls[id].value])),
    ...Object.fromEntries(Object.keys(vm2Defaults).map(id => [id, controls[id].value])),
    ...Object.fromEntries(Object.keys(nethackDefaults).map(id => [id, controls[id].type === "checkbox" ? controls[id].checked : controls[id].value])),
    ...Object.fromEntries(Object.keys(pixelmusicDefaults).map(id => [id, controls[id].type === "checkbox" ? controls[id].checked : controls[id].value])),
    ...Object.fromEntries(Object.keys(displayDefaults).map(id => [id, controls[id].value])),
    bpm: clamp(Number(controls.bpm.value) || 120, 20, 360),
    glyphSize: clamp(Number(controls.glyphSize.value) || 13, 8, 24),
    density: clamp(Number(controls.density.value) || 4, 1, 8),
    glitch: clamp(Number(controls.glitch.value) || 0, 0, 100) / 100,
    haloSize: clamp(Number(controls.haloSize.value) || 0, 0, 24),
    maskMode: controls.maskMode.value,
    maskLayer: controls.maskLayer.value,
    maskScale: clamp(Number(controls.maskScale.value) || 1, 1, 8),
    wordHalo: controls.wordHalo.checked,
    colorMode: controls.colorMode.value,
    backgroundMode: controls.backgroundMode.value,
    charsetPreset: controls.charsetPreset.value,
    customCharset: controls.customCharset.value,
    beatRate: clamp(Number(controls.beatRate.value) || 1, 0.125, 8),
    wordMotion: controls.wordMotion.value,
    palette: controls.palette.value,
    barLength: clamp(Number(controls.barLength.value) || 4, 1, 16),
    sectionBars: clamp(Number(controls.sectionBars.value) || 8, 1, 32),
    transitionMode: controls.transitionMode.value,
    quality: controls.quality.value,
    fpsCap: controls.fpsCap.value,
    lyricMode: controls.lyricMode.value,
    captureSize: controls.captureSize.value,
    legibilityMode: controls.legibilityMode.value,
    beatFlash: controls.beatFlash.checked,
    downbeatFlash: controls.downbeatFlash.checked,
    stageBeatIndicator: controls.stageBeatIndicator.checked,
    fullscreenOnStart: controls.fullscreenOnStart.checked,
    midiSync: controls.midiSync.checked,
    livePreview: controls.livePreview.checked,
    autoSections: controls.autoSections.checked,
    recordingMode: controls.recordingMode.checked,
    invert: controls.invert.checked,
    scanlines: controls.scanlines.checked,
    backgroundOnly: controls.backgroundOnly.checked
  };
}

function applyOptionMacros(options) {
  const adjusted = { ...options };
  if (adjusted.legibilityMode === "readable") {
    adjusted.glitch = Math.min(adjusted.glitch, 0.18);
    adjusted.density = Math.min(adjusted.density, 2);
    adjusted.wordHalo = adjusted.wordHalo && adjusted.haloSize > 0;
  } else if (adjusted.legibilityMode === "chaotic") {
    adjusted.glitch = Math.max(adjusted.glitch, 0.62);
    adjusted.density = Math.max(adjusted.density, 6);
    adjusted.wordHalo = adjusted.wordHalo && adjusted.haloSize > 0;
  }

  if (adjusted.recordingMode) {
    adjusted.fpsCap = adjusted.fpsCap === "0" ? "60" : adjusted.fpsCap;
    adjusted.stageBeatIndicator = false;
  }
  return adjusted;
}

function getCaptureSize() {
  const size = state.options.captureSize || "window";
  if (!state.options.recordingMode || size === "window") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return { width: window.innerWidth, height: window.innerHeight };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length) % list.length];
}

function getCharset() {
  if (state.options.charsetPreset === "custom") {
    const custom = controls.customCharset.value || state.options.customCharset || "";
    return custom.length ? custom : charsets.full;
  }
  return charsets[state.options.charsetPreset] || charsets.full;
}

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

function getQualityProfile() {
  const profiles = {
    low: { glyphScale: 1.35, glow: 0, defaultFps: 30 },
    medium: { glyphScale: 1, glow: 0, defaultFps: 45 },
    high: { glyphScale: 0.86, glow: 2, defaultFps: 60 },
    ultra: { glyphScale: 0.72, glow: 4, defaultFps: 0 }
  };
  return profiles[state.options.quality] || profiles.medium;
}

function getFrameInterval() {
  const value = state.options.fpsCap;
  const nativeVideo = isNativeVideoMode(state.options.visualizerMode);
  const fps = value === "auto" ? (nativeVideo ? 60 : getQualityProfile().defaultFps) : Number(value);
  return fps > 0 ? 1000 / fps : 0;
}

function trackFps(now, key = "fpsSamples", lastKey = "lastFrameAt", currentKey = "currentFps") {
  const last = state[lastKey];
  state[lastKey] = now;
  if (!last) return state[currentKey] || 0;
  const delta = now - last;
  if (delta <= 0) return state[currentKey] || 0;
  state[key].push(1000 / delta);
  state[key] = state[key].slice(-24);
  state[currentKey] = Math.round(state[key].reduce((sum, value) => sum + value, 0) / state[key].length);
  return state[currentKey];
}

function getStatusText(options = state.options, fps = state.currentFps) {
  const dungeon = options.visualizerMode === "nethack";
  const mode = options.visualizerMode === "pixelmusic" ? "Pixelmusic 3000" : dungeon ? "NetHack dungeon" : options.visualizerMode === "vm2" ? "Video Music 2"
    : options.visualizerMode === "atari" ? "Atari Video Music" : options.backgroundMode || controls.backgroundMode.value;
  const bpm = options.bpm || Number(controls.bpm.value) || 120;
  const fpsText = fps ? `${fps} FPS` : "static";
  return `${bpm} BPM / ${mode} / ${fpsText}`;
}
