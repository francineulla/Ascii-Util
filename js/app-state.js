"use strict";

// Shared control references, defaults, session state, and scene field schema.
// Classic scripts share app-state.js bindings so index.html also works over file://.

const controls = {
  toolMode: document.getElementById("toolMode"),
  visualizerMode: document.getElementById("visualizerMode"),
  menu: document.getElementById("menu"),
  stage: document.getElementById("stage"),
  ascii: document.getElementById("ascii"),
  canvas: document.getElementById("asciiCanvas"),
  previewAscii: document.getElementById("previewAscii"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewPanel: document.getElementById("previewPanel"),
  previewReadout: document.getElementById("previewReadout"),
  livePreview: document.getElementById("livePreview"),
  refreshPreview: document.getElementById("refreshPreview"),
  beat: document.getElementById("beat"),
  lyrics: document.getElementById("lyrics"),
  maskArt: document.getElementById("maskArt"),
  maskMode: document.getElementById("maskMode"),
  maskLayer: document.getElementById("maskLayer"),
  maskScale: document.getElementById("maskScale"),
  maskScaleValue: document.getElementById("maskScaleValue"),
  seed: document.getElementById("seed"),
  bpm: document.getElementById("bpm"),
  colorMode: document.getElementById("colorMode"),
  backgroundMode: document.getElementById("backgroundMode"),
  charsetPreset: document.getElementById("charsetPreset"),
  customCharset: document.getElementById("customCharset"),
  beatRate: document.getElementById("beatRate"),
  wordMotion: document.getElementById("wordMotion"),
  palette: document.getElementById("palette"),
  barLength: document.getElementById("barLength"),
  sectionBars: document.getElementById("sectionBars"),
  transitionMode: document.getElementById("transitionMode"),
  quality: document.getElementById("quality"),
  fpsCap: document.getElementById("fpsCap"),
  lyricMode: document.getElementById("lyricMode"),
  captureSize: document.getElementById("captureSize"),
  glyphSize: document.getElementById("glyphSize"),
  density: document.getElementById("density"),
  glitch: document.getElementById("glitch"),
  haloSize: document.getElementById("haloSize"),
  glyphSizeValue: document.getElementById("glyphSizeValue"),
  densityValue: document.getElementById("densityValue"),
  glitchValue: document.getElementById("glitchValue"),
  haloSizeValue: document.getElementById("haloSizeValue"),
  legibilityMode: document.getElementById("legibilityMode"),
  beatFlash: document.getElementById("beatFlash"),
  invert: document.getElementById("invert"),
  scanlines: document.getElementById("scanlines"),
  wordHalo: document.getElementById("wordHalo"),
  backgroundOnly: document.getElementById("backgroundOnly"),
  downbeatFlash: document.getElementById("downbeatFlash"),
  stageBeatIndicator: document.getElementById("stageBeatIndicator"),
  fullscreenOnStart: document.getElementById("fullscreenOnStart"),
  midiSync: document.getElementById("midiSync"),
  autoSections: document.getElementById("autoSections"),
  recordingMode: document.getElementById("recordingMode"),
  splitWords: document.getElementById("splitWords"),
  lockSeed: document.getElementById("lockSeed"),
  presetData: document.getElementById("presetData"),
  copyPreset: document.getElementById("copyPreset"),
  loadPreset: document.getElementById("loadPreset"),
  copySceneBank: document.getElementById("copySceneBank"),
  loadSceneBank: document.getElementById("loadSceneBank"),
  randomizeAll: document.getElementById("randomizeAll"),
  tapTempo: document.getElementById("tapTempo"),
  fullscreenButton: document.getElementById("fullscreenButton"),
  copyShareUrl: document.getElementById("copyShareUrl"),
  copyObsUrl: document.getElementById("copyObsUrl"),
  saveFrame: document.getElementById("saveFrame"),
  panicButton: document.getElementById("panicButton"),
  connectMidi: document.getElementById("connectMidi"),
  midiInput: document.getElementById("midiInput"),
  tapReadout: document.getElementById("tapReadout"),
  obsReadout: document.getElementById("obsReadout"),
  midiReadout: document.getElementById("midiReadout"),
  stageHud: document.getElementById("stageHud"),
  beatDot: document.getElementById("beatDot"),
  stageInfo: document.getElementById("stageInfo"),
  start: document.getElementById("start"),
  randomizeSeed: document.getElementById("randomizeSeed"),
  sceneSlots: document.getElementById("sceneSlots"),
  storeScene: document.getElementById("storeScene"),
  clearScenes: document.getElementById("clearScenes"),
  sceneReadout: document.getElementById("sceneReadout"),
  defaultScenePreset: document.getElementById("defaultScenePreset"),
  applyDefaultScene: document.getElementById("applyDefaultScene"),
  randomizeVisual: document.getElementById("randomizeVisual"),
  randomizeMotion: document.getElementById("randomizeMotion"),
  randomizeColour: document.getElementById("randomizeColour"),
  randomizeTiming: document.getElementById("randomizeTiming")
};

const atariDefaults = {
  atariInput: "demo", atariShape: "solid", atariHorizontal: "2", atariVertical: "2",
  atariGainLeft: "100", atariGainRight: "100", atariContourLeft: "65", atariContourRight: "65",
  atariColor: "65", atariAutoRate: "2", atariAutoShape: "all", atariStretch: false
};
for (const id of Object.keys(atariDefaults)) controls[id] = document.getElementById(id);
const vm2Defaults = VideoMusic2.defaults;
for (const id of Object.keys(vm2Defaults)) controls[id] = document.getElementById(id);
const nethackDefaults = NetHackVisualizer.defaults;
for (const id of Object.keys(nethackDefaults)) controls[id] = document.getElementById(id);
const pixelmusicDefaults = Pixelmusic3000.defaults;
for (const id of Object.keys(pixelmusicDefaults)) controls[id] = document.getElementById(id);
const displayDefaults = { scanlineStrength: "8", scanlineSpacing: "4", scanlineThickness: "25" };
for (const id of Object.keys(displayDefaults)) controls[id] = document.getElementById(id);
const audioSceneDefaults = { audioResponse: "full" };
for (const id of Object.keys(audioSceneDefaults)) controls[id] = document.getElementById(id);
// The family selector is derived from the saved renderer, keeping old scene files compatible.
let lastVideoMode = "atari";

function isNativeVideoMode(mode) {
  return ["atari", "vm2", "nethack", "pixelmusic"].includes(mode);
}

function isDungeonMode() {
  return controls.visualizerMode.value === "nethack";
}

const intervalMode = document.getElementById("intervalMode");
const intervalMinutes = document.getElementById("intervalMinutes");
controls.sceneName = document.getElementById("sceneName");
const lockGroups = {
  lockTempo: ["bpm", "beatRate", "barLength", "sectionBars", "midiSync"],
  lockLyrics: ["lyrics", "lyricMode", "splitWords", "autoSections"],
  lockPalette: ["palette", "colorMode", "invert", "atariColor", "vm2Palette", "vm2Color", "vm2Hue", "vm2Saturation", "nhPalette", "pmPalette"],
  lockPerformance: ["quality", "fpsCap", "glyphSize", "captureSize", "recordingMode"]
};
const setupControls = [...Object.keys(lockGroups), "sceneEffect", "sceneDuration", "audioSensitivity", "audioSource", "audioAttack", "audioRelease", "audioGate"];
let sceneStorageFailed = false;

let state = {
  vm2Frame: null,
  previewVm2Frame: null,
  pixelmusicFrame: null,
  previewPixelmusicFrame: null,
  pixelmusicActions: { patternNext: 0, paletteNext: 0 },
  previewPixelmusicActions: { patternNext: 0, paletteNext: 0 },
  previewPixelmusicKey: "",
  previewFrame: null,
  intervalDueAt: 0,
  previewPrepared: null,
  raf: 0,
  running: false,
  startedAt: 0,
  lastBeat: -1,
  seedValue: 1,
  words: [],
  sections: [],
  activeWords: [],
  mask: null,
  options: {},
  canvasContext: null,
  canvasWidth: 0,
  canvasHeight: 0,
  currentFrame: null,
  paused: false,
  pausedAt: 0,
  previewTimer: 0,
  previewRaf: 0,
  previewStartedAt: 0,
  lastPreviewAt: 0,
  previewContext: null,
  scenes: [],
  selectedSceneSlot: 1,
  pendingPreset: null,
  lastRenderAt: 0,
  lastFrameAt: 0,
  fpsSamples: [],
  currentFps: 0,
  lastPreviewFrameAt: 0,
  previewFpsSamples: [],
  currentPreviewFps: 0,
  tapTimes: [],
  midiAccess: null,
  midiInputId: "",
  midiClockTimes: [],
  midiPulseCount: 0,
  midiStartedAt: 0
};

const presetFields = [
  "visualizerMode",
  ...Object.keys(atariDefaults),
  ...Object.keys(vm2Defaults),
  ...Object.keys(nethackDefaults),
  ...Object.keys(pixelmusicDefaults),
  ...Object.keys(displayDefaults),
  ...Object.keys(audioSceneDefaults),
  "sceneName",
  "lyrics",
  "maskArt",
  "maskMode",
  "maskLayer",
  "maskScale",
  "seed",
  "bpm",
  "colorMode",
  "backgroundMode",
  "charsetPreset",
  "customCharset",
  "beatRate",
  "wordMotion",
  "palette",
  "barLength",
  "sectionBars",
  "transitionMode",
  "quality",
  "fpsCap",
  "lyricMode",
  "captureSize",
  "glyphSize",
  "density",
  "glitch",
  "haloSize",
  "legibilityMode",
  "beatFlash",
  "downbeatFlash",
  "invert",
  "scanlines",
  "wordHalo",
  "backgroundOnly",
  "stageBeatIndicator",
  "fullscreenOnStart",
  "midiSync",
  "livePreview",
  "autoSections",
  "recordingMode",
  "splitWords",
  "lockSeed"
];
