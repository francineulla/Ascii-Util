"use strict";

const controls = {
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

const glyphRamp = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const charsets = {
  full: glyphRamp,
  minimal: " .:-=+*#%@",
  dots: " .oO80Q@",
  numbers: " 0123456789",
  binary: " 01",
  punctuation: " .,:;!|/\\[]{}()<>?+-=*#%@",
  slashes: " /\\|xX",
  waves: " ~-=+*#@"
};
const palettePresets = {
  cyber: { bgHue: 164, leadHue: 326, secondaryHue: 45, saturation: 96, bgSat: 82, light: 64 },
  terminal: { bgHue: 128, leadHue: 128, secondaryHue: 92, saturation: 88, bgSat: 82, light: 62 },
  amber: { bgHue: 37, leadHue: 42, secondaryHue: 18, saturation: 98, bgSat: 92, light: 62 },
  apple: { bgHue: 112, leadHue: 102, secondaryHue: 142, saturation: 90, bgSat: 84, light: 66 },
  commodore: { bgHue: 224, leadHue: 190, secondaryHue: 280, saturation: 82, bgSat: 70, light: 70 },
  dos: { bgHue: 217, leadHue: 195, secondaryHue: 55, saturation: 92, bgSat: 76, light: 72 },
  vga: { bgHue: 0, leadHue: 60, secondaryHue: 180, saturation: 100, bgSat: 100, light: 78 }
};
const borderGlyphs = ["#", "@", "%", "&", "8", "M", "W", "$"];
const tinyWords = ["SYNC", "BPM", "PHASE", "ECHO", "NOISE", "SIGNAL", "FRAME", "BLOOM"];
const maxPresetJsonChars = 300000;
const maxTextareaChars = 60000;
const maxTextInputChars = 512;
const maxCustomCharsetChars = 256;
const sceneSlotCount = 8;
const maxSceneBankJsonChars = maxPresetJsonChars * sceneSlotCount;
const letterFont = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"]
};

let state = {
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

const helpText = {
  lyrics: "Paste lyrics, words, or short phrases here. The lyric mode decides how this text is split during playback.",
  maskArt: "Paste ASCII art here. Any non-space character can become a stencil, beat reveal, or texture layer.",
  maskMode: "Chooses how pasted ASCII mask art affects the generated scene.",
  maskLayer: "Chooses whether the ASCII mask appears behind words, in front of words, or replaces the word layer.",
  maskScale: "Scales pasted mask art up on the ASCII grid.",
  seed: "Controls repeatable randomness. The same seed and settings recreate the same visual sequence.",
  bpm: "Sets the tempo for beat flashes, word changes, and beat-reactive animation.",
  colorMode: "Chooses how colours are applied to background characters, words, masks, and depth.",
  backgroundMode: "Chooses the procedural ASCII background engine.",
  charsetPreset: "Chooses which characters are used for the generated background texture.",
  customCharset: "Used when Character Set is Custom. Characters earlier in the field are darker; later characters are brighter.",
  beatRate: "Controls how quickly the displayed lyric advances relative to the BPM.",
  wordMotion: "Chooses how the large lyric word moves or appears on each step.",
  palette: "Chooses the colour family used by the colour modes and classic glow.",
  barLength: "Sets how many beats make a bar for downbeat effects, section changes, and queued scene changes.",
  sectionBars: "When Auto sections is on, each blank-line lyric section plays for this many bars before advancing.",
  transitionMode: "Chooses how live scene and preset changes are applied while playback is running.",
  quality: "Balances density and glow against performance. Low is fastest; Ultra is most detailed.",
  fpsCap: "Caps render speed. Higher values are ceilings, not guaranteed frame rates.",
  lyricMode: "Words splits text into tokens, Phrases uses lines, and Markup words enables emphasis syntax.",
  captureSize: "Recording mode can pin the renderer to this output size instead of the browser window.",
  glyphSize: "Controls the base size of each monospaced character.",
  density: "Controls how many small background lyric fragments are stamped into the scene.",
  glitch: "Controls background noise and horizontal tear intensity.",
  haloSize: "Controls the cleared area around large words. Each step adds one character cell of halo.",
  legibilityMode: "A master readability macro. Readable calms the image; Chaotic pushes density and glitch harder.",
  beatFlash: "Adds a full-screen pulse on beats.",
  invert: "Inverts the stage colours for a bright-on-dark or dark-on-bright flip.",
  scanlines: "Adds a subtle scanline overlay.",
  wordHalo: "Clears visual space around large words so they read more clearly.",
  backgroundOnly: "Hides all lyric and microtext layers, leaving only the BPM-reactive background.",
  downbeatFlash: "Limits the full-screen flash to the first beat of each bar.",
  stageBeatIndicator: "Shows a small BPM HUD and beat dot during playback.",
  fullscreenOnStart: "Requests browser fullscreen when Go is pressed.",
  midiSync: "Lets incoming MIDI clock messages set and nudge the tempo when a MIDI input is connected.",
  livePreview: "Animates the page background preview while the menu is open.",
  autoSections: "Splits lyrics by blank lines and rotates through sections every chosen number of bars.",
  recordingMode: "Pins capture sizing and steadier performance settings for screen recording or OBS.",
  splitWords: "When Lyric Mode is Words, splits pasted text into individual words.",
  lockSeed: "Keeps the current seed when Randomize all is pressed.",
  tapTempo: "Tap repeatedly to estimate BPM from your timing. You can also press T from the menu.",
  fullscreenButton: "Requests browser fullscreen from the menu.",
  copyObsUrl: "Copies a URL that restores the current preset and autostarts for OBS browser sources.",
  connectMidi: "Requests Web MIDI access and lists available MIDI clock sources.",
  midiInput: "Chooses which connected MIDI input should provide clock messages.",
  tapReadout: "Shows the BPM calculated from tap tempo.",
  obsReadout: "Shows the most recent OBS/capture URL.",
  midiReadout: "Shows MIDI connection and clock status.",
  previewAscii: "Shows a small live sample of the current settings before playback.",
  refreshPreview: "Redraws the menu preview using the current settings.",
  copyShareUrl: "Copies a URL that restores the current preset without autostarting.",
  saveFrame: "Downloads the most recent frame as a PNG image.",
  panicButton: "Immediately applies a stable, readable look. You can also press 0 during playback.",
  copyPreset: "Exports the currently selected scene as JSON.",
  loadPreset: "Imports the JSON box into the currently selected scene.",
  copySceneBank: "Exports all eight scene slots as JSON.",
  loadSceneBank: "Imports all eight scene slots from the JSON box.",
  randomizeAll: "Randomizes the current controls only. Lock seed prevents seed changes; stored scene slots are not overwritten.",
  sceneSlots: "Click a filled slot to recall it. Select a slot and press Store scene to save current settings.",
  storeScene: "Stores all current settings into the selected scene slot.",
  clearScenes: "Clears all saved scene slots from this browser.",
  sceneReadout: "Shows which scene slot is selected, stored, recalled, or queued.",
  defaultScenePreset: "Chooses a built-in starting look to apply to the current scene.",
  applyDefaultScene: "Applies the selected built-in look to the current controls or running scene.",
  randomizeVisual: "Randomizes texture, character set, quality, and detail controls.",
  randomizeMotion: "Randomizes word movement, density, halo, and mask layering.",
  randomizeColour: "Randomizes colour mode, palette, inversion, and scanlines.",
  randomizeTiming: "Randomizes BPM, beat timing, flash behaviour, and FPS cap.",
  presetData: "Holds exported scene JSON, full scene-bank JSON, or a share URL for importing.",
  start: "Starts playback with the current settings. Escape returns to the menu.",
  randomizeSeed: "Generates a new random seed."
};

const optionHelpText = {
  maskMode: {
    off: "Ignores pasted mask art.",
    stencil: "Keeps the generated background strongest inside the pasted ASCII shape.",
    reveal: "Pulses the pasted ASCII shape into view on beats.",
    texture: "Draws the pasted ASCII characters into the scene."
  },
  maskLayer: {
    behind: "Applies the mask before words are stamped.",
    front: "Draws the mask over the word layers.",
    replace: "Uses the mask as the foreground and skips lyric words."
  },
  colorMode: {
    classic: "Single-colour text with glow, rendered as fast plain text.",
    prism: "Randomized per-character colour field with beat-coloured words.",
    spotlight: "Dim background with brighter words and masks.",
    thermal: "Depth-like heat colours based on brightness."
  },
  backgroundMode: {
    ray: "A pulsing radial field with wave and lens shading.",
    starfield: "A warp-tunnel starfield driven by the beat.",
    galaxy: "A rotating spiral/core pattern.",
    plasma: "Layered sine waves for liquid motion.",
    rain: "Vertical falling streaks.",
    maze: "Circuit-like grid lines and flickering paths.",
    vortex: "A spiral lens with beat-reactive rings.",
    terrain: "A horizon and wire-grid terrain sweep.",
    scope: "Oscilloscope-style traces crossing the grid.",
    blocks: "Blocky data slabs and stepped digital noise."
  },
  charsetPreset: {
    full: "Uses the full brightness ramp for detailed shading.",
    minimal: "Uses a compact classic ASCII ramp.",
    dots: "Uses round characters for soft dithering.",
    numbers: "Uses numeric texture.",
    binary: "Uses only zeroes and ones.",
    punctuation: "Uses punctuation-heavy texture.",
    slashes: "Uses slash and pipe characters for angular motion.",
    waves: "Uses wave-like characters for smoother patterns.",
    custom: "Uses the characters from Custom Characters."
  },
  beatRate: {
    "0.125": "Advances words eight times per beat.",
    "0.25": "Advances words four times per beat.",
    "0.5": "Advances words twice per beat.",
    "1": "Advances words once per beat.",
    "2": "Holds each word for two beats.",
    "4": "Holds each word for four beats.",
    "8": "Holds each word for eight beats."
  },
  wordMotion: {
    pulse: "Keeps the main word near center with beat-size pulsing.",
    slide: "Slides the main word across the screen.",
    zoom: "Pops the main word larger at the start of each step.",
    jitter: "Cuts the main word to random positions.",
    orbit: "Moves the main word in an orbital path.",
    stack: "Adds offset afterimages behind the main word."
  },
  palette: {
    cyber: "Cyan, magenta, and warm neon.",
    terminal: "Green terminal phosphor.",
    amber: "Warm amber monitor tones.",
    apple: "Apple II-style green.",
    commodore: "Blue and violet home-computer colours.",
    dos: "Blue DOS-inspired contrast.",
    vga: "Hard high-contrast VGA colour."
  },
  barLength: {
    "3": "Three-beat bars for waltz or asymmetric pulses.",
    "4": "Standard four-beat bars.",
    "5": "Five-beat bars for off-kilter section timing.",
    "6": "Six-beat bars for longer phrases.",
    "7": "Seven-beat bars for uneven cycles.",
    "8": "Eight-beat bars for slow, extended downbeats."
  },
  transitionMode: {
    cut: "Applies live changes immediately.",
    beat: "Queues live scene changes until the next beat.",
    bar: "Queues live scene changes until the next bar start.",
    fade: "Queues until the next beat and adds a quick brightness fade."
  },
  quality: {
    low: "Largest characters and fastest rendering.",
    medium: "Balanced density and speed.",
    high: "Smaller characters with light canvas glow.",
    ultra: "Densest grid and strongest glow."
  },
  fpsCap: {
    auto: "Uses the default FPS for the selected quality.",
    "15": "Caps playback around 15 FPS for dense looks or slower machines.",
    "24": "Caps playback around 24 FPS for a filmier cadence.",
    "30": "Caps playback around 30 FPS.",
    "45": "Caps playback around 45 FPS.",
    "60": "Caps playback around 60 FPS.",
    "0": "Renders every animation frame."
  },
  lyricMode: {
    words: "Splits the lyrics into individual words.",
    phrases: "Uses each line as a phrase.",
    markup: "Enables *huge*, [secondary], and // comment syntax."
  },
  captureSize: {
    window: "Uses the current browser window size.",
    "1920x1080": "Pins capture output to 16:9 full HD.",
    "1080x1920": "Pins capture output to vertical full HD.",
    "1280x720": "Pins capture output to 16:9 HD.",
    "720x720": "Pins capture output to a square frame."
  },
  legibilityMode: {
    balanced: "Uses the controls as set.",
    readable: "Reduces clutter and increases word separation at render time.",
    chaotic: "Pushes density and glitch for rougher live energy."
  }
};

const presetHelpText = {
  lyricPrism: "Colour-rich lyric typography over a balanced ray field.",
  terminalRain: "Green terminal characters falling behind readable words.",
  galaxyMask: "A rotating galaxy shaped by the ASCII mask panel.",
  backgroundPulse: "A clean, beat-reactive background with lyric layers hidden.",
  midiStrobe: "Fast high-contrast cuts designed for an incoming MIDI clock.",
  phraseGlow: "Slower phrase-sized lyrics with a soft spotlight treatment.",
  cleanTitles: "Large restrained title cards with minimal clutter.",
  binaryTunnel: "A binary-character starfield tunnel with punchy motion.",
  amberPunch: "Warm amber monitor tones with centered beat pulses.",
  softBloom: "Low-glitch colour bloom with gentle word movement.",
  hardCutNoise: "Dense noisy textures and abrupt rhythmic cuts.",
  verticalPoster: "Large typography arranged for portrait capture.",
  vortexLens: "Spiral lens motion with bright depth-coloured text.",
  wireTerrain: "Retro wire-grid terrain under bold lyric forms.",
  scopeTrace: "Oscilloscope traces with crisp terminal-style text.",
  dataBlocks: "Chunky digital blocks, VGA colour, and stacked words."
};

const presetBank = {
  lyricPrism: {
    colorMode: "prism",
    backgroundMode: "ray",
    charsetPreset: "full",
    wordMotion: "pulse",
    palette: "cyber",
    barLength: "4",
    transitionMode: "cut",
    quality: "medium",
    fpsCap: "auto",
    beatRate: "1",
    glyphSize: "13",
    density: "5",
    glitch: "44",
    legibilityMode: "balanced",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: true
  },
  terminalRain: {
    colorMode: "classic",
    backgroundMode: "rain",
    charsetPreset: "minimal",
    wordMotion: "slide",
    palette: "terminal",
    barLength: "4",
    transitionMode: "beat",
    quality: "low",
    fpsCap: "45",
    beatRate: "0.5",
    glyphSize: "14",
    density: "3",
    glitch: "24",
    legibilityMode: "readable",
    wordHalo: true,
    haloSize: "4",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: false
  },
  galaxyMask: {
    colorMode: "thermal",
    backgroundMode: "galaxy",
    charsetPreset: "waves",
    wordMotion: "orbit",
    palette: "commodore",
    barLength: "4",
    transitionMode: "bar",
    quality: "high",
    fpsCap: "45",
    beatRate: "2",
    glyphSize: "12",
    density: "4",
    glitch: "18",
    legibilityMode: "balanced",
    maskMode: "reveal",
    maskLayer: "behind",
    maskScale: "2",
    wordHalo: false,
    haloSize: "0",
    scanlines: true,
    beatFlash: true
  },
  backgroundPulse: {
    colorMode: "spotlight",
    backgroundMode: "plasma",
    charsetPreset: "dots",
    wordMotion: "zoom",
    palette: "amber",
    barLength: "4",
    transitionMode: "fade",
    quality: "medium",
    fpsCap: "60",
    beatRate: "1",
    glyphSize: "11",
    density: "1",
    glitch: "34",
    legibilityMode: "chaotic",
    backgroundOnly: true,
    wordHalo: false,
    scanlines: false,
    beatFlash: true
  },
  midiStrobe: {
    colorMode: "spotlight",
    backgroundMode: "maze",
    charsetPreset: "punctuation",
    wordMotion: "stack",
    palette: "vga",
    barLength: "4",
    transitionMode: "beat",
    quality: "low",
    fpsCap: "30",
    beatRate: "0.25",
    glyphSize: "15",
    density: "6",
    glitch: "72",
    legibilityMode: "chaotic",
    midiSync: true,
    wordHalo: true,
    haloSize: "3",
    downbeatFlash: true,
    beatFlash: true,
    scanlines: false
  },
  phraseGlow: {
    colorMode: "prism",
    backgroundMode: "starfield",
    charsetPreset: "slashes",
    wordMotion: "jitter",
    palette: "apple",
    barLength: "4",
    sectionBars: "4",
    transitionMode: "fade",
    quality: "high",
    fpsCap: "60",
    lyricMode: "phrases",
    beatRate: "4",
    glyphSize: "12",
    density: "2",
    glitch: "12",
    autoSections: true,
    legibilityMode: "readable",
    wordHalo: true,
    haloSize: "6",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: false
  },
  cleanTitles: {
    colorMode: "spotlight",
    backgroundMode: "ray",
    charsetPreset: "minimal",
    wordMotion: "pulse",
    palette: "cyber",
    barLength: "4",
    transitionMode: "cut",
    quality: "medium",
    fpsCap: "45",
    beatRate: "2",
    glyphSize: "16",
    density: "1",
    glitch: "4",
    legibilityMode: "readable",
    wordHalo: true,
    haloSize: "10",
    backgroundOnly: false,
    scanlines: false,
    beatFlash: false
  },
  binaryTunnel: {
    colorMode: "prism",
    backgroundMode: "starfield",
    charsetPreset: "binary",
    wordMotion: "zoom",
    palette: "dos",
    barLength: "4",
    transitionMode: "beat",
    quality: "high",
    fpsCap: "60",
    beatRate: "0.5",
    glyphSize: "11",
    density: "5",
    glitch: "28",
    legibilityMode: "balanced",
    wordHalo: true,
    haloSize: "4",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: true
  },
  amberPunch: {
    colorMode: "thermal",
    backgroundMode: "maze",
    charsetPreset: "punctuation",
    wordMotion: "stack",
    palette: "amber",
    barLength: "4",
    transitionMode: "fade",
    quality: "medium",
    fpsCap: "45",
    beatRate: "1",
    glyphSize: "13",
    density: "4",
    glitch: "52",
    legibilityMode: "balanced",
    wordHalo: true,
    haloSize: "3",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: true
  },
  softBloom: {
    colorMode: "spotlight",
    backgroundMode: "plasma",
    charsetPreset: "dots",
    wordMotion: "orbit",
    palette: "apple",
    barLength: "4",
    transitionMode: "bar",
    quality: "high",
    fpsCap: "45",
    beatRate: "4",
    glyphSize: "12",
    density: "2",
    glitch: "10",
    legibilityMode: "readable",
    wordHalo: true,
    haloSize: "7",
    backgroundOnly: false,
    scanlines: false,
    beatFlash: false
  },
  hardCutNoise: {
    colorMode: "prism",
    backgroundMode: "rain",
    charsetPreset: "slashes",
    wordMotion: "jitter",
    palette: "vga",
    barLength: "4",
    transitionMode: "cut",
    quality: "low",
    fpsCap: "30",
    beatRate: "0.25",
    glyphSize: "15",
    density: "8",
    glitch: "88",
    legibilityMode: "chaotic",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: false,
    beatFlash: true
  },
  verticalPoster: {
    colorMode: "thermal",
    backgroundMode: "galaxy",
    charsetPreset: "full",
    wordMotion: "slide",
    palette: "commodore",
    barLength: "4",
    transitionMode: "beat",
    quality: "medium",
    fpsCap: "45",
    beatRate: "2",
    captureSize: "1080x1920",
    glyphSize: "14",
    density: "3",
    glitch: "18",
    legibilityMode: "readable",
    wordHalo: true,
    haloSize: "5",
    backgroundOnly: false,
    recordingMode: true,
    scanlines: true,
    beatFlash: false
  },
  vortexLens: {
    colorMode: "prism",
    backgroundMode: "vortex",
    charsetPreset: "full",
    wordMotion: "orbit",
    palette: "cyber",
    barLength: "4",
    transitionMode: "fade",
    quality: "medium",
    fpsCap: "30",
    beatRate: "1",
    glyphSize: "13",
    density: "4",
    glitch: "38",
    legibilityMode: "balanced",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: true
  },
  wireTerrain: {
    colorMode: "thermal",
    backgroundMode: "terrain",
    charsetPreset: "slashes",
    wordMotion: "slide",
    palette: "dos",
    barLength: "4",
    transitionMode: "beat",
    quality: "medium",
    fpsCap: "24",
    beatRate: "2",
    glyphSize: "14",
    density: "2",
    glitch: "18",
    legibilityMode: "readable",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: false
  },
  scopeTrace: {
    colorMode: "spotlight",
    backgroundMode: "scope",
    charsetPreset: "minimal",
    wordMotion: "pulse",
    palette: "terminal",
    barLength: "4",
    transitionMode: "cut",
    quality: "low",
    fpsCap: "30",
    beatRate: "0.5",
    glyphSize: "15",
    density: "3",
    glitch: "30",
    legibilityMode: "balanced",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: false,
    beatFlash: true
  },
  dataBlocks: {
    colorMode: "prism",
    backgroundMode: "blocks",
    charsetPreset: "binary",
    wordMotion: "stack",
    palette: "vga",
    barLength: "4",
    transitionMode: "bar",
    quality: "low",
    fpsCap: "15",
    beatRate: "0.25",
    glyphSize: "16",
    density: "7",
    glitch: "62",
    legibilityMode: "chaotic",
    wordHalo: false,
    haloSize: "0",
    backgroundOnly: false,
    scanlines: true,
    beatFlash: true
  }
};

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

function randomizeSeed() {
  const chunks = new Uint32Array(2);
  crypto.getRandomValues(chunks);
  controls.seed.value = `${chunks[0].toString(36)}-${chunks[1].toString(36)}`;
  schedulePreview();
}

function collectOptions() {
  return {
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
  const fps = value === "auto" ? getQualityProfile().defaultFps : Number(value);
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
  const mode = options.backgroundMode || controls.backgroundMode.value;
  const bpm = options.bpm || Number(controls.bpm.value) || 120;
  const fpsText = fps ? `${fps} FPS` : "static";
  return `${bpm} BPM / ${mode} / ${fpsText}`;
}

function applyPresentationClasses(target, options) {
  if (!target) return;
  target.classList.toggle("invert", Boolean(options.invert));
  target.classList.toggle("scanlines", Boolean(options.scanlines));
}

function getEffectiveGlyphSize() {
  return Math.max(6, state.options.glyphSize * getQualityProfile().glyphScale);
}

function makeBlank(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => ({
    char: " ",
    role: "bg",
    shade: 0
  })));
}

function readableLetters(word) {
  return word.split("").filter((letter) => letter === " " || letterFont[letter]);
}

function setCell(grid, x, y, char, role, shade = 1) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = { char, role, shade };
}

function applyMaskToBackground(grid, mask, charset, beatPhase, random) {
  if (!mask || state.options.maskMode === "off") return;
  const height = grid.length;
  const width = grid[0].length;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const maskChar = sampleMask(mask, x, y, width, height);
      if (state.options.maskMode === "stencil" && !maskChar) {
        setCell(grid, x, y, random() < 0.05 ? "." : " ", "mask-dim", 0.02);
      } else if (state.options.maskMode === "reveal") {
        if (!maskChar) {
          setCell(grid, x, y, random() < 0.04 ? "." : " ", "mask-dim", 0.02);
        } else if (beatPhase > 0.28 || random() < beatPhase) {
          setCell(grid, x, y, charset[Math.floor(random() * charset.length)], "mask", 0.78 + beatPhase * 0.22);
        }
      } else if (state.options.maskMode === "texture" && maskChar) {
        setCell(grid, x, y, maskChar, "mask", 0.92);
      }
    }
  }
}

function overlayMask(grid, mask, charset, beatPhase, random) {
  if (!mask || state.options.maskMode === "off") return;
  if (state.options.maskMode === "stencil" && state.options.maskLayer !== "front") return;
  const height = grid.length;
  const width = grid[0].length;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const maskChar = sampleMask(mask, x, y, width, height);
      if (!maskChar) continue;
      if (state.options.maskMode === "reveal" && beatPhase < 0.28 && random() > beatPhase) continue;
      const char = state.options.maskMode === "texture"
        ? maskChar
        : charset[Math.floor(random() * charset.length)];
      setCell(grid, x, y, char, "mask", 0.95);
    }
  }
}

function frameToText(grid) {
  return grid.map((row) => row.map((cell) => cell.char).join("")).join("\n");
}

function shadeFor(x, y, width, height, time, beatPhase, random) {
  const nx = (x / width - 0.5) * 2;
  const ny = (y / height - 0.5) * 2;
  const radius = Math.sqrt(nx * nx * 1.4 + ny * ny * 0.9);
  const noise = (random() - 0.5) * state.options.glitch * 2.5;
  const seedPhase = (state.seedValue % 1000) / 1000;

  if (state.options.backgroundMode === "starfield") {
    const angle = Math.atan2(ny, nx);
    const warp = time * 0.018;
    const spoke = Math.sin(angle * 34 + seedPhase * 12);
    const tunnel = Math.sin(radius * 82 - warp);
    const star = tunnel > 0.82 || spoke > 0.94 ? 1 : 0;
    const depth = clamp(1 - radius * 0.75, 0, 1);
    return clamp(star * (0.45 + depth * 0.55) + beatPhase * 0.16 + noise, 0, 1);
  }

  if (state.options.backgroundMode === "galaxy") {
    const angle = Math.atan2(ny, nx);
    const arms = Math.cos(angle * 3 + radius * 12 - time * 0.003);
    const core = Math.exp(-radius * 2.8);
    const dust = Math.sin((x + y) * 0.27 + time * 0.004);
    return clamp(core * 0.74 + Math.max(0, arms) * 0.44 + dust * 0.09 + beatPhase * 0.12 + noise, 0, 1);
  }

  if (state.options.backgroundMode === "plasma") {
    const plasma =
      Math.sin(nx * 8 + time * 0.004) +
      Math.sin(ny * 10 - time * 0.005) +
      Math.sin((nx + ny) * 7 + time * 0.003);
    return clamp(0.46 + plasma * 0.16 + beatPhase * 0.12 + noise, 0, 1);
  }

  if (state.options.backgroundMode === "rain") {
    const column = Math.sin(x * 1.7 + seedPhase * 40) * 0.5 + 0.5;
    const drop = Math.sin(y * 0.9 + time * 0.03 + column * 8);
    const streak = column > 0.58 ? Math.max(0, drop) : 0;
    return clamp(streak * 0.78 + beatPhase * 0.08 + noise * 0.55, 0, 1);
  }

  if (state.options.backgroundMode === "maze") {
    const cellX = Math.floor((x + time * 0.012) / 4);
    const cellY = Math.floor(y / 2);
    const line = x % 4 === 0 || y % 4 === 0 ? 0.62 : 0.12;
    const circuit = Math.sin(cellX * 12.9898 + cellY * 78.233 + seedPhase * 19);
    return clamp(line + (circuit > 0.72 ? 0.3 : 0) + beatPhase * 0.08 + noise * 0.5, 0, 1);
  }

  if (state.options.backgroundMode === "vortex") {
    const angle = Math.atan2(ny, nx);
    const twist = Math.sin(angle * 9 + radius * 26 - time * 0.007 + seedPhase * 8);
    const rings = Math.sin(radius * 46 - time * 0.014);
    const core = Math.exp(-radius * 3.2);
    return clamp(0.24 + twist * 0.2 + rings * 0.18 + core * 0.62 + beatPhase * 0.18 + noise * 0.72, 0, 1);
  }

  if (state.options.backgroundMode === "terrain") {
    const horizon = height * 0.38 + Math.sin(time * 0.002 + seedPhase * 6) * height * 0.03;
    const distance = clamp((y - horizon) / Math.max(1, height - horizon), 0, 1);
    const perspective = Math.pow(distance, 1.7);
    const groundWave = Math.sin(nx * (8 + perspective * 34) + perspective * 28 - time * 0.004);
    const horizontal = distance > 0 && Math.abs(Math.sin((perspective * 58 - time * 0.006))) > 0.9 ? 0.62 : 0;
    const vertical = distance > 0 && Math.abs(Math.sin((nx / Math.max(0.08, distance)) * 4 + seedPhase * 9)) > 0.94 ? 0.56 : 0;
    const sky = y < horizon ? Math.max(0, Math.sin((x + y) * 0.08 + time * 0.003)) * 0.18 : 0;
    return clamp(sky + horizontal + vertical + groundWave * 0.16 + distance * 0.22 + beatPhase * 0.12 + noise * 0.5, 0, 1);
  }

  if (state.options.backgroundMode === "scope") {
    const center = height * (0.48 + Math.sin(time * 0.0016 + seedPhase * 7) * 0.08);
    const waveA = center + Math.sin(x * 0.12 + time * 0.006) * height * 0.16;
    const waveB = center + Math.sin(x * 0.055 - time * 0.004 + seedPhase * 10) * height * 0.24;
    const traceA = 1 - clamp(Math.abs(y - waveA) / 3.4, 0, 1);
    const traceB = 1 - clamp(Math.abs(y - waveB) / 4.8, 0, 1);
    const graticule = x % 10 === 0 || y % 5 === 0 ? 0.16 : 0;
    return clamp(Math.max(traceA, traceB * 0.76) + graticule + beatPhase * 0.14 + noise * 0.48, 0, 1);
  }

  if (state.options.backgroundMode === "blocks") {
    const blockW = 5 + Math.floor(seedPhase * 5);
    const blockH = 2 + Math.floor(seedPhase * 3);
    const bx = Math.floor((x + time * 0.012) / blockW);
    const by = Math.floor((y + Math.sin(time * 0.002 + x * 0.08) * 2) / blockH);
    const value = Math.sin(bx * 12.9898 + by * 78.233 + seedPhase * 43);
    const edge = x % blockW === 0 || y % blockH === 0 ? 0.2 : 0;
    const pulse = value > 0.72 ? 0.68 : value > 0.36 ? 0.34 : 0.08;
    return clamp(edge + pulse + beatPhase * (value > 0.6 ? 0.24 : 0.07) + noise * 0.58, 0, 1);
  }

  const wave = Math.sin(radius * 12 - time * 0.006) + Math.cos(nx * 9 + time * 0.003);
  const scan = Math.sin((y + beatPhase * 12) * 0.55);
  const lens = 1 - clamp(radius, 0, 1);
  return clamp((wave + scan) * 0.18 + lens * 0.78 + noise + beatPhase * 0.22, 0, 1);
}

function stampWord(grid, word, cx, cy, scale, random, role = "lead") {
  const height = grid.length;
  const width = grid[0].length;
  const letters = readableLetters(word);

  if (!letters.length) {
    stampMicroWord(grid, word, cx, cy, random, role);
    return;
  }

  const maxCell = Math.max(1, Math.floor(scale));
  const rawWidth = letters.reduce((sum, letter) => sum + (letter === " " ? 3 : letterFont[letter][0].length) + 1, -1);
  const cell = clamp(Math.floor((width * 0.86) / rawWidth), 1, maxCell);
  const wordWidth = rawWidth * cell;
  const wordHeight = 7 * cell;
  const startX = Math.floor(cx - wordWidth / 2);
  const startY = Math.floor(cy - wordHeight / 2);

  const haloPad = state.options.wordHalo ? Math.floor(state.options.haloSize) : 0;
  if (haloPad > 0) {
    for (let y = startY - haloPad; y < startY + wordHeight + haloPad; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = startX - haloPad; x < startX + wordWidth + haloPad; x += 1) {
        if (x < 0 || x >= width) continue;
        if (grid[y][x].role !== "bg" && grid[y][x].role !== "halo") continue;
        const dx = x < startX ? startX - x : x >= startX + wordWidth ? x - (startX + wordWidth - 1) : 0;
        const dy = y < startY ? startY - y : y >= startY + wordHeight ? y - (startY + wordHeight - 1) : 0;
        const falloff = 1 - clamp(Math.max(dx, dy) / haloPad, 0, 1);
        setCell(grid, x, y, random() < 0.04 + falloff * 0.06 ? "." : " ", "halo", 0.06 + falloff * 0.16);
      }
    }
  }

  let cursor = startX;
  for (const letter of letters) {
    if (letter === " ") {
      cursor += 4 * cell;
      continue;
    }
    const pattern = letterFont[letter];
    const fill = letter;
    const edge = pick(borderGlyphs, random);
    for (let py = 0; py < pattern.length; py += 1) {
      for (let px = 0; px < pattern[py].length; px += 1) {
        if (pattern[py][px] !== "1") continue;
        for (let yy = 0; yy < cell; yy += 1) {
          for (let xx = 0; xx < cell; xx += 1) {
            const x = cursor + px * cell + xx;
            const y = startY + py * cell + yy;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const isEdge = xx === 0 || yy === 0 || xx === cell - 1 || yy === cell - 1;
            setCell(grid, x, y, isEdge && random() < 0.14 ? edge : fill, role, 1);
          }
        }
      }
    }
    cursor += (pattern[0].length + 1) * cell;
  }
}

function stampMicroWord(grid, word, cx, cy, random, role = "micro") {
  const height = grid.length;
  const width = grid[0].length;
  const startX = Math.floor(cx - word.length / 2);
  const y = clamp(Math.floor(cy), 0, height - 1);

  for (let i = 0; i < word.length; i += 1) {
    const x = startX + i;
    if (x >= 0 && x < width) setCell(grid, x, y, random() < 0.25 ? pick(borderGlyphs, random) : word[i], role, 0.9);
  }
}

function stampMicroText(grid, beatIndex, random) {
  const height = grid.length;
  const width = grid[0].length;
  const count = Math.floor(state.options.density * 4);
  const words = state.activeWords || state.words;

  for (let i = 0; i < count; i += 1) {
    const word = random() < 0.7 ? tokenText(pick(words, random)) : pick(tinyWords, random);
    const y = Math.floor(random() * height);
    const x = Math.floor(random() * Math.max(1, width - word.length));
    const drift = Math.floor(Math.sin(beatIndex + i) * 4);
    for (let j = 0; j < word.length; j += 1) {
      const tx = x + j + drift;
      if (tx >= 0 && tx < width) setCell(grid, tx, y, word[j], "micro", 0.85);
    }
  }
}

function getActiveWords(beatIndex) {
  if (!state.options.autoSections || !state.sections.length) return state.words;
  const sectionBeats = Math.max(1, state.options.barLength * state.options.sectionBars);
  const sectionIndex = Math.floor(beatIndex / sectionBeats) % state.sections.length;
  return state.sections[sectionIndex] || state.words;
}

function colorForCell(cell, x, y, frame) {
  const palette = palettePresets[state.options.palette] || palettePresets.cyber;
  const seedHue = (state.seedValue + palette.bgHue) % 360;
  const leadHue = (palette.leadHue + frame.wordStepIndex * 47 + seedHue * 0.08) % 360;
  const secondaryHue = (palette.secondaryHue + frame.wordStepIndex * 31) % 360;
  const flickerHue = (seedHue + x * 31 + y * 17 + frame.wordStepIndex * 29) % 360;
  const heatHue = Math.round(palette.bgHue + (1 - cell.shade) * 110 + Math.sin(frame.elapsed * 0.004 + x * 0.1) * 14);
  const wordLight = palette.light;

  if (state.options.colorMode === "classic") {
    if (cell.role === "halo" || cell.role === "mask-dim") return "hsl(0 0% 7%)";
    return `hsl(${palette.leadHue} ${palette.saturation}% ${Math.max(18, 28 + cell.shade * 44)}%)`;
  }

  if (state.options.colorMode === "spotlight") {
    if (cell.role === "lead") return `hsl(${leadHue} ${palette.saturation}% ${wordLight}%)`;
    if (cell.role === "secondary") return `hsl(${secondaryHue} ${palette.saturation}% ${Math.max(48, wordLight - 8)}%)`;
    if (cell.role === "mask") return `hsl(${secondaryHue} ${palette.saturation}% ${Math.min(82, wordLight + 8)}%)`;
    if (cell.role === "micro") return `hsl(${palette.bgHue} ${palette.bgSat}% 58%)`;
    if (cell.role === "halo") return "hsl(0 0% 15%)";
    if (cell.role === "mask-dim") return "hsl(0 0% 8%)";
    return `hsl(${palette.bgHue} 18% ${18 + Math.round(cell.shade * 24)}%)`;
  }

  if (state.options.colorMode === "thermal") {
    if (cell.role === "lead") return `hsl(${leadHue} ${palette.saturation}% ${Math.min(82, wordLight + 4)}%)`;
    if (cell.role === "secondary") return `hsl(${secondaryHue} ${palette.saturation}% ${Math.max(48, wordLight - 6)}%)`;
    if (cell.role === "mask") return `hsl(${leadHue} ${palette.saturation}% ${Math.min(86, wordLight + 10)}%)`;
    if (cell.role === "halo") return "hsl(0 0% 8%)";
    if (cell.role === "mask-dim") return "hsl(0 0% 6%)";
    return `hsl(${heatHue} ${palette.bgSat}% ${30 + Math.round(cell.shade * 42)}%)`;
  }

  if (cell.role === "lead") return `hsl(${leadHue} ${palette.saturation}% ${Math.min(84, wordLight + 6)}%)`;
  if (cell.role === "secondary") return `hsl(${secondaryHue} ${palette.saturation}% ${Math.max(50, wordLight - 2)}%)`;
  if (cell.role === "mask") return `hsl(${(secondaryHue + x + y) % 360} ${palette.saturation}% ${Math.min(84, wordLight + 8)}%)`;
  if (cell.role === "micro") return `hsl(${(flickerHue + 90) % 360} ${palette.bgSat}% 66%)`;
  if (cell.role === "halo") return "hsl(0 0% 7%)";
  if (cell.role === "mask-dim") return "hsl(0 0% 5%)";
  return `hsl(${flickerHue} ${palette.bgSat}% ${36 + Math.round(cell.shade * 35)}%)`;
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
  const glyphSize = getEffectiveGlyphSize();
  const charWidth = glyphSize * 0.62;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${glyphSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.shadowBlur = getQualityProfile().glow;

  for (let y = 0; y < frame.grid.length; y += 1) {
    const row = frame.grid[y];
    const py = y * glyphSize;
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (cell.char === " ") continue;
      ctx.fillStyle = colorForCell(cell, x, y, frame);
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillText(cell.char, x * charWidth, py);
    }
  }
}

function getWordPlacement(width, height, elapsed, beatMs, beatIndex, wordStepIndex, wordPhase, bigScale, random) {
  const wobble = Math.sin(wordStepIndex * 1.7);
  const placement = {
    leadX: width * (0.5 + wobble * 0.09),
    leadY: height * 0.5,
    leadScale: bigScale,
    secondaryX: width * (0.23 + random() * 0.54),
    secondaryY: height * (0.18 + random() * 0.64),
    secondaryScale: clamp(Math.floor(bigScale * 0.55), 1, 4),
    stack: []
  };

  if (state.options.wordMotion === "slide") {
    const direction = wordStepIndex % 2 === 0 ? 1 : -1;
    placement.leadX = width * (0.5 + direction * (0.72 - wordPhase * 1.44));
    placement.leadY = height * (0.48 + Math.sin(wordStepIndex) * 0.08);
  }

  if (state.options.wordMotion === "zoom") {
    placement.leadScale = clamp(bigScale + Math.round((1 - wordPhase) * 3), 2, 8);
  }

  if (state.options.wordMotion === "jitter") {
    placement.leadX = width * randomBetween(random, 0.38, 0.62);
    placement.leadY = height * randomBetween(random, 0.34, 0.66);
  }

  if (state.options.wordMotion === "orbit") {
    const angle = elapsed * 0.0022 + beatIndex * 0.18;
    placement.leadX = width * (0.5 + Math.cos(angle) * 0.21);
    placement.leadY = height * (0.5 + Math.sin(angle * 1.14) * 0.22);
  }

  if (state.options.wordMotion === "stack") {
    const offset = Math.max(2, Math.floor(bigScale * 1.4));
    placement.stack = [
      { x: placement.leadX - offset, y: placement.leadY - offset },
      { x: placement.leadX + offset, y: placement.leadY + offset }
    ];
  }

  return placement;
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
  const effectiveGlyphSize = getEffectiveGlyphSize();
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
  const frameSeed = state.seedValue ^ Math.imul(wordStepIndex + 1, 2654435761);
  const random = mulberry32(frameSeed);
  const motionRandom = mulberry32(frameSeed ^ 0x9E3779B9);
  const charset = getCharset();
  const grid = makeBlank(width, height);
  const mask = state.mask;
  const activeWords = getActiveWords(beatIndex);
  state.activeWords = activeWords;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const shade = shadeFor(x, y, width, height, elapsed, beatPhase, random);
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
  const bigScale = clamp(Math.floor(width / Math.max(12, leadWord.length * 2.8)) + Math.round(pulse * 2) + emphasisBoost, 1, 8);
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
  if (state.options.colorMode === "classic" && !state.options.recordingMode) {
    controls.ascii.classList.remove("colorized");
    controls.ascii.hidden = false;
    controls.canvas.hidden = true;
    controls.ascii.textContent = frameToText(frame.grid);
    return;
  }

  controls.ascii.classList.add("colorized");
  controls.ascii.hidden = true;
  controls.canvas.hidden = false;
  const capture = getCaptureSize();
  renderFrameToCanvas(frame, controls.canvas, capture.width, capture.height);
}

function prepareStateFromControls(preserveStart = false) {
  state.options = applyOptionMacros(collectOptions());
  state.words = parseWords();
  state.sections = parseSections();
  state.mask = parseMask();
  state.seedValue = hashString(`${controls.seed.value}|${state.words.map(tokenText).join("|")}`);
  if (!preserveStart) state.startedAt = performance.now();
}

function renderPreview(now = performance.now()) {
  if (!controls.previewCanvas || state.running) return;
  const previous = {
    options: state.options,
    words: state.words,
    mask: state.mask,
    sections: state.sections,
    activeWords: state.activeWords,
    seedValue: state.seedValue,
    startedAt: state.startedAt,
    lastBeat: state.lastBeat
  };

  try {
    prepareStateFromControls();
    applyPresentationClasses(controls.previewPanel, state.options);
    if (!state.previewStartedAt) state.previewStartedAt = now;
    state.startedAt = controls.livePreview.checked ? state.previewStartedAt : now - 420;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const frame = buildFrame(controls.livePreview.checked ? now : state.startedAt + 420, width, height, true);
    const lines = frameToText(frame.grid).split("\n").slice(0, 22);
    if (controls.previewAscii) controls.previewAscii.textContent = lines.join("\n");
    renderFrameToCanvas(frame, controls.previewCanvas, width, height);
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
  }
}

function schedulePreview() {
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

function getPreset() {
  return presetFields.reduce((preset, id) => {
    const control = controls[id];
    if (!control) return preset;
    preset[id] = control.type === "checkbox" ? control.checked : control.value;
    return preset;
  }, {});
}

function parsePresetJson(raw, label = "Scene JSON", maxChars = maxPresetJsonChars) {
  const text = String(raw || "").trim();
  if (!text) throw new Error(`${label} is empty.`);
  if (text.length > maxChars) throw new Error(`${label} is too large.`);
  return JSON.parse(text);
}

function parsePresetInput(raw, label = "Scene JSON", maxChars = maxPresetJsonChars) {
  const text = String(raw || "").trim();
  if (text.startsWith("#preset=")) return decodePresetFromUrl(text.slice(8));
  if (/^(file|https?):/i.test(text) && text.includes("#preset=")) {
    return decodePresetFromUrl(new URL(text, location.href).hash.slice(8));
  }
  return parsePresetJson(text, label, maxChars);
}

function controlHasOption(control, value) {
  return Array.from(control.options).some((option) => option.value === value);
}

function normalizePreset(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return {};
  return presetFields.reduce((normalized, id) => {
    if (!Object.prototype.hasOwnProperty.call(preset, id) || !controls[id]) return normalized;
    const control = controls[id];
    if (control.type === "checkbox") {
      normalized[id] = preset[id] === true || preset[id] === "true" || preset[id] === 1 || preset[id] === "1";
      return normalized;
    }
    const value = String(preset[id] ?? "");
    if (control.tagName === "SELECT") {
      if (controlHasOption(control, value)) normalized[id] = value;
      return normalized;
    }
    if (control.type === "number" || control.type === "range") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return normalized;
      const min = control.min === "" ? numeric : Number(control.min);
      const max = control.max === "" ? numeric : Number(control.max);
      normalized[id] = String(clamp(numeric, min, max));
      return normalized;
    }
    const limit = id === "customCharset" ? maxCustomCharsetChars : control.tagName === "TEXTAREA" ? maxTextareaChars : maxTextInputChars;
    normalized[id] = value.slice(0, limit);
    return normalized;
  }, {});
}

function applyPreset(preset) {
  const safePreset = normalizePreset(preset);
  for (const id of presetFields) {
    if (!Object.prototype.hasOwnProperty.call(safePreset, id) || !controls[id]) continue;
    const control = controls[id];
    if (control.type === "checkbox") {
      control.checked = safePreset[id];
    } else {
      control.value = safePreset[id];
    }
  }
  updateSliderReadouts();
}

async function copyPreset() {
  const json = JSON.stringify({
    type: "ascii-bpm-scene",
    version: 2,
    slot: state.selectedSceneSlot,
    preset: normalizePreset(getPreset())
  }, null, 2);
  controls.presetData.value = json;
  controls.presetData.select();
  try {
    await navigator.clipboard.writeText(json);
  } catch (error) {
    document.execCommand("copy");
  }
  controls.sceneReadout.textContent = `Exported scene ${state.selectedSceneSlot}`;
}

function loadPreset() {
  try {
    const payload = parsePresetInput(controls.presetData.value, "Scene JSON", maxSceneBankJsonChars);
    if (payload.type === "ascii-bpm-scene-bank") {
      importSceneBank(payload);
      return;
    }
    const preset = payload.type === "ascii-bpm-scene" && payload.preset ? payload.preset : payload;
    applyPreset(preset);
    const stored = storeScene(state.selectedSceneSlot);
    schedulePreview();
    if (state.running) restartPlayback(true);
    controls.sceneReadout.textContent = stored
      ? `Imported scene ${state.selectedSceneSlot}`
      : `Imported scene ${state.selectedSceneSlot}, but browser storage failed`;
  } catch (error) {
    controls.presetData.value = `Scene import failed: ${error.message}`;
  }
}

async function copySceneBank() {
  const scenes = Array.from({ length: sceneSlotCount }, (_, index) => state.scenes[index] ? normalizePreset(state.scenes[index]) : null);
  scenes[state.selectedSceneSlot - 1] = normalizePreset(getPreset());
  const json = JSON.stringify({
    type: "ascii-bpm-scene-bank",
    version: 2,
    selectedSlot: state.selectedSceneSlot,
    scenes
  }, null, 2);
  controls.presetData.value = json;
  controls.presetData.select();
  try {
    await navigator.clipboard.writeText(json);
  } catch (error) {
    document.execCommand("copy");
  }
  controls.sceneReadout.textContent = "Exported all scenes";
}

function importSceneBank(payload) {
  const scenes = Array.isArray(payload.scenes) ? payload.scenes.slice(0, sceneSlotCount) : [];
  state.scenes = Array.from({ length: sceneSlotCount }, (_, index) => scenes[index] ? normalizePreset(scenes[index]) : null);
  state.selectedSceneSlot = clamp(Number(payload.selectedSlot) || state.selectedSceneSlot, 1, 8);
  const stored = saveSceneSlots();
  refreshSceneButtons();
  const selected = state.scenes[state.selectedSceneSlot - 1];
  if (selected) applyPreset(selected);
  schedulePreview();
  if (state.running) restartPlayback(true);
  controls.sceneReadout.textContent = stored
    ? `Imported scene bank, selected ${state.selectedSceneSlot}`
    : "Imported scene bank, but browser storage failed";
}

function loadSceneBank() {
  try {
    const payload = parsePresetInput(controls.presetData.value, "Scene bank JSON", maxSceneBankJsonChars);
    if (payload.type !== "ascii-bpm-scene-bank") {
      throw new Error("Expected an ascii-bpm-scene-bank JSON export.");
    }
    importSceneBank(payload);
  } catch (error) {
    controls.presetData.value = `Scene bank import failed: ${error.message}`;
  }
}

function encodePresetForUrl(preset) {
  const json = JSON.stringify(normalizePreset(preset));
  if (json.length > maxPresetJsonChars) throw new Error("Preset is too large for a share URL.");
  return btoa(unescape(encodeURIComponent(json)));
}

function decodePresetFromUrl(hash) {
  if (hash.length > Math.ceil(maxPresetJsonChars * 1.4)) throw new Error("Preset URL is too large.");
  return parsePresetJson(decodeURIComponent(escape(atob(hash))), "Preset URL");
}

function requestFullscreen() {
  const target = controls.stage.hidden ? document.documentElement : controls.stage;
  if (target.requestFullscreen) {
    const request = target.requestFullscreen();
    if (request && typeof request.catch === "function") request.catch(() => {});
  }
}

function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    const request = document.exitFullscreen();
    if (request && typeof request.catch === "function") request.catch(() => {});
  }
}

function tapTempo() {
  const now = performance.now();
  state.tapTimes = state.tapTimes.filter((time) => now - time < 5000);
  state.tapTimes.push(now);

  if (state.tapTimes.length < 2) {
    controls.tapReadout.textContent = "Tap BPM: --";
    return;
  }

  const intervals = [];
  for (let i = 1; i < state.tapTimes.length; i += 1) {
    intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
  }
  const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const bpm = clamp(Math.round(60000 / average), 20, 360);
  controls.bpm.value = bpm;
  controls.tapReadout.textContent = `Tap BPM: ${bpm}`;
  schedulePreview();
}

function setMidiStatus(message) {
  controls.midiReadout.textContent = `MIDI: ${message}`;
}

function populateMidiInputs() {
  controls.midiInput.replaceChildren(new Option("No MIDI input", ""));
  if (!state.midiAccess) return;

  for (const input of state.midiAccess.inputs.values()) {
    const option = document.createElement("option");
    option.value = input.id;
    option.textContent = input.name || input.manufacturer || input.id;
    controls.midiInput.appendChild(option);
  }

  if (state.midiInputId && state.midiAccess.inputs.has(state.midiInputId)) {
    controls.midiInput.value = state.midiInputId;
  }
}

function attachMidiInput() {
  if (!state.midiAccess) return;

  for (const input of state.midiAccess.inputs.values()) {
    input.onmidimessage = null;
  }

  const selectedId = controls.midiInput.value;
  state.midiInputId = selectedId;
  const input = selectedId ? state.midiAccess.inputs.get(selectedId) : state.midiAccess.inputs.values().next().value;
  if (!input) {
    setMidiStatus("no input");
    return;
  }

  state.midiInputId = input.id;
  controls.midiInput.value = input.id;
  input.onmidimessage = handleMidiMessage;
  setMidiStatus(input.name || "connected");
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    setMidiStatus("not supported");
    return;
  }

  try {
    state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess.onstatechange = () => {
      populateMidiInputs();
      attachMidiInput();
    };
    populateMidiInputs();
    attachMidiInput();
    controls.midiSync.checked = true;
  } catch (error) {
    setMidiStatus("permission denied");
  }
}

function resetMidiClock(now = performance.now()) {
  state.midiClockTimes = [];
  state.midiPulseCount = 0;
  state.midiStartedAt = now;
  if (state.running) state.startedAt = now;
}

function handleMidiClock(now) {
  state.midiPulseCount += 1;
  state.midiClockTimes.push(now);
  state.midiClockTimes = state.midiClockTimes.filter((time) => now - time < 2400).slice(-96);

  if (state.midiClockTimes.length >= 12) {
    const first = state.midiClockTimes[0];
    const last = state.midiClockTimes[state.midiClockTimes.length - 1];
    const averageClockMs = (last - first) / (state.midiClockTimes.length - 1);
    const bpm = clamp(Math.round(60000 / (averageClockMs * 24)), 20, 360);
    controls.bpm.value = bpm;
    if (state.running) state.options.bpm = bpm;
    setMidiStatus(`${bpm} BPM`);
  }

  if (state.running && state.midiPulseCount % 24 === 0) {
    const beatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, Math.round((now - state.startedAt) / beatMs));
    state.startedAt = now - elapsedBeats * beatMs;
  }
}

function handleMidiMessage(event) {
  if (!controls.midiSync.checked) return;
  const status = event.data[0];
  const now = typeof event.receivedTime === "number" ? event.receivedTime : performance.now();

  if (status === 0xF8) {
    handleMidiClock(now);
  } else if (status === 0xFA) {
    resetMidiClock(now);
    if (!state.running) start();
  } else if (status === 0xFB) {
    if (!state.running) start();
  } else if (status === 0xFC) {
    stop();
    resetMidiClock(now);
  }
}

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
  const glyphSize = getEffectiveGlyphSize();
  const charWidth = glyphSize * 0.62;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(frame.grid[0].length * charWidth);
  canvas.height = Math.ceil(frame.grid.length * glyphSize);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${glyphSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.shadowBlur = state.options.colorMode === "classic" ? 5 : getQualityProfile().glow;

  for (let y = 0; y < frame.grid.length; y += 1) {
    for (let x = 0; x < frame.grid[y].length; x += 1) {
      const cell = frame.grid[y][x];
      if (cell.char === " ") continue;
      ctx.fillStyle = state.options.colorMode === "classic" ? controls.ascii.style.color || "#eafff8" : colorForCell(cell, x, y, frame);
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillText(cell.char, x * charWidth, y * glyphSize);
    }
  }

  return canvas.toDataURL("image/png");
}

function saveFrame() {
  if (!state.running) {
    prepareStateFromControls();
    const capture = getCaptureSize();
    state.currentFrame = buildFrame(state.startedAt + 420, capture.width, capture.height, true);
  }
  if (!state.currentFrame) return;

  const url = state.options.colorMode !== "classic" && !controls.canvas.hidden
    ? controls.canvas.toDataURL("image/png")
    : renderTextFrameToImage(state.currentFrame);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ascii-bpm-${Date.now()}.png`;
  link.click();
  controls.obsReadout.textContent = "Frame saved";
}

function updateSliderReadouts() {
  controls.glyphSizeValue.textContent = controls.glyphSize.value;
  controls.densityValue.textContent = controls.density.value;
  controls.glitchValue.textContent = controls.glitch.value;
  controls.haloSizeValue.textContent = controls.haloSize.value;
  controls.maskScaleValue.textContent = controls.maskScale.value;
}

function applyTooltips() {
  for (const [id, text] of Object.entries(helpText)) {
    const control = controls[id];
    if (!control) continue;
    control.title = text;
    const labelled = control.closest("label");
    if (labelled) labelled.title = text;
  }

  for (const [id, options] of Object.entries(optionHelpText)) {
    const select = controls[id];
    if (!select) continue;
    for (const option of select.options) {
      if (options[option.value]) option.title = options[option.value];
    }
  }

  if (controls.defaultScenePreset) {
    for (const option of controls.defaultScenePreset.options) {
      option.title = presetHelpText[option.value] || "Applies this built-in look to the current scene.";
    }
  }

  const maskSummary = document.querySelector(".mask-panel summary");
  if (maskSummary) maskSummary.title = "Open this panel to paste ASCII art and use it as a live visual mask.";

  for (const summary of document.querySelectorAll(".control-section > summary")) {
    if (!summary.title) summary.title = "Click to expand or collapse this group of controls.";
  }

  const shortcutStrip = document.querySelector(".shortcut-strip");
  if (shortcutStrip) shortcutStrip.title = "Useful controls while performing: Escape exits, Space pauses, arrows change BPM, B toggles background-only, H toggles halo, I toggles invert, S toggles scanlines, 0 applies panic, and 1-8 recall scenes.";
}

function loadPresetFromUrl() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.startsWith("#preset=") ? location.hash.slice(8) : "";
  if (hash) {
    try {
      applyPreset(decodePresetFromUrl(hash));
      updateSliderReadouts();
    } catch (error) {
      controls.obsReadout.textContent = "Preset URL failed";
    }
  }

  if (params.get("obs") === "1") {
    controls.fullscreenOnStart.checked = false;
    controls.stageBeatIndicator.checked = false;
    requestAnimationFrame(() => start());
  }
}

function randomizeSelect(control, random) {
  control.selectedIndex = Math.floor(random() * control.options.length);
}

function applyNamedPreset(name) {
  const preset = presetBank[name];
  if (!preset) return;
  const nextPreset = { ...getPreset(), ...preset };
  if (name === "galaxyMask" && !controls.maskArt.value.trim()) {
    nextPreset.maskArt = [
      "        .***.        ",
      "     .*********.     ",
      "   .****  *  ****.   ",
      "  ****   ***   ****  ",
      " .****  *****  ****. ",
      "  ****   ***   ****  ",
      "   .****  *  ****.   ",
      "     .*********.     ",
      "        .***.        "
    ].join("\n");
  }
  if (name === "midiStrobe" && !navigator.requestMIDIAccess) {
    nextPreset.midiSync = false;
    setMidiStatus("not supported");
  }
  requestPresetChange(nextPreset, name);
  updateSliderReadouts();
  schedulePreview();
}

function applyPresetNow(preset, fade = false) {
  applyPreset(preset);
  updateSliderReadouts();
  schedulePreview();
  if (state.running) restartPlayback(fade);
}

function requestPresetChange(preset, label = "preset") {
  if (!state.running || controls.transitionMode.value === "cut") {
    applyPresetNow(preset, false);
    return;
  }
  const mode = controls.transitionMode.value;
  const beatMs = 60000 / state.options.bpm;
  const timelineNow = state.paused ? state.pausedAt : performance.now();
  const currentBeat = Math.max(0, Math.floor((timelineNow - state.startedAt) / beatMs));
  const targetBeat = mode === "bar"
    ? (Math.floor(currentBeat / state.options.barLength) + 1) * state.options.barLength
    : currentBeat + 1;
  state.pendingPreset = { preset, label, mode, targetBeat };
  controls.sceneReadout.textContent = mode === "bar" ? `Queued ${label} for next bar` : `Queued ${label} for next beat`;
}

function maybeApplyQueuedPreset(frame) {
  if (!state.pendingPreset) return false;
  const queued = state.pendingPreset;
  const shouldApply = frame.beatIndex >= queued.targetBeat;
  if (!shouldApply) return false;
  state.pendingPreset = null;
  applyPresetNow(queued.preset, queued.mode === "fade");
  controls.sceneReadout.textContent = `Applied ${queued.label}`;
  return true;
}

function loadSceneSlots() {
  try {
    const scenes = JSON.parse(localStorage.getItem("asciiBpmScenes") || "[]");
    state.scenes = Array.isArray(scenes)
      ? Array.from({ length: sceneSlotCount }, (_, index) => scenes[index] ? normalizePreset(scenes[index]) : null)
      : [];
  } catch (error) {
    state.scenes = [];
    controls.sceneReadout.textContent = "Saved scenes could not be loaded";
  }
  refreshSceneButtons();
}

function saveSceneSlots() {
  try {
    localStorage.setItem("asciiBpmScenes", JSON.stringify(state.scenes));
    refreshSceneButtons();
    return true;
  } catch (error) {
    controls.sceneReadout.textContent = "Scene storage is full";
    return false;
  }
}

function refreshSceneButtons() {
  if (!controls.sceneSlots) return;
  for (const button of controls.sceneSlots.querySelectorAll("[data-slot]")) {
    const slot = Number(button.dataset.slot);
    const hasScene = Boolean(state.scenes[slot - 1]);
    button.classList.toggle("empty", !hasScene);
    button.classList.toggle("selected", slot === state.selectedSceneSlot);
    button.textContent = hasScene ? `Scene ${slot}` : `Slot ${slot}`;
    button.title = hasScene
      ? "Click to recall this scene. Shift-click stores over it."
      : "Click to select this empty slot, then press Store scene.";
  }
}

function selectSceneSlot(slot) {
  state.selectedSceneSlot = clamp(slot, 1, 8);
  refreshSceneButtons();
  controls.sceneReadout.textContent = `Selected slot ${state.selectedSceneSlot}`;
}

function storeScene(slot = state.selectedSceneSlot) {
  state.scenes[slot - 1] = normalizePreset(getPreset());
  const stored = saveSceneSlots();
  if (stored) controls.sceneReadout.textContent = `Stored scene ${slot}`;
  return stored;
}

function recallScene(slot = state.selectedSceneSlot) {
  selectSceneSlot(slot);
  const preset = state.scenes[slot - 1];
  if (!preset) return;
  requestPresetChange(preset, `scene ${slot}`);
}

function clearScenes() {
  state.scenes = [];
  if (saveSceneSlots()) controls.sceneReadout.textContent = "Cleared scenes";
}

function randomizeVisual() {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|visual`));
  randomizeSelect(controls.backgroundMode, random);
  randomizeSelect(controls.charsetPreset, random);
  randomizeSelect(controls.quality, random);
  controls.glyphSize.value = Math.round(randomBetween(random, 9, 18));
  controls.glitch.value = Math.round(randomBetween(random, 4, 76));
  if (controls.charsetPreset.value === "custom") {
    controls.customCharset.value = pick(["@%#*+=-:. ", "01 ", ".oO80Q@ ", "/\\|xX ", "~-=+*#@ "], random);
  }
  updateSliderReadouts();
  schedulePreview();
  controls.sceneReadout.textContent = `Randomized current scene ${state.selectedSceneSlot} only`;
}

function randomizeMotion() {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|motion`));
  randomizeSelect(controls.wordMotion, random);
  randomizeSelect(controls.maskLayer, random);
  randomizeSelect(controls.legibilityMode, random);
  controls.density.value = Math.round(randomBetween(random, 1, 8));
  controls.wordHalo.checked = random() > 0.45;
  controls.haloSize.value = Math.round(randomBetween(random, 0, 24));
  controls.maskScale.value = Math.round(randomBetween(random, 1, 8));
  updateSliderReadouts();
  schedulePreview();
}

function randomizeColour() {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|colour`));
  randomizeSelect(controls.colorMode, random);
  randomizeSelect(controls.palette, random);
  controls.invert.checked = random() > 0.82;
  controls.scanlines.checked = random() > 0.25;
  schedulePreview();
}

function randomizeTiming() {
  const random = mulberry32(Date.now() ^ hashString(`${controls.seed.value}|timing`));
  controls.bpm.value = Math.round(randomBetween(random, 70, 178));
  randomizeSelect(controls.beatRate, random);
  randomizeSelect(controls.barLength, random);
  randomizeSelect(controls.transitionMode, random);
  randomizeSelect(controls.fpsCap, random);
  controls.sectionBars.value = Math.round(randomBetween(random, 2, 16));
  controls.autoSections.checked = random() > 0.62;
  controls.beatFlash.checked = random() > 0.15;
  controls.downbeatFlash.checked = random() > 0.68;
  controls.stageBeatIndicator.checked = random() > 0.35;
  schedulePreview();
}

function randomizeAll() {
  const random = mulberry32(Date.now() ^ hashString(controls.lyrics.value));
  if (!controls.lockSeed.checked) randomizeSeed();
  controls.bpm.value = Math.round(randomBetween(random, 72, 178));
  controls.glyphSize.value = Math.round(randomBetween(random, 9, 18));
  controls.density.value = Math.round(randomBetween(random, 2, 8));
  controls.glitch.value = Math.round(randomBetween(random, 8, 82));
  controls.haloSize.value = Math.round(randomBetween(random, 0, 24));
  randomizeSelect(controls.colorMode, random);
  randomizeSelect(controls.backgroundMode, random);
  randomizeSelect(controls.charsetPreset, random);
  randomizeSelect(controls.beatRate, random);
  randomizeSelect(controls.wordMotion, random);
  randomizeSelect(controls.palette, random);
  randomizeSelect(controls.barLength, random);
  randomizeSelect(controls.transitionMode, random);
  randomizeSelect(controls.quality, random);
  randomizeSelect(controls.fpsCap, random);
  randomizeSelect(controls.lyricMode, random);
  randomizeSelect(controls.captureSize, random);
  randomizeSelect(controls.legibilityMode, random);
  controls.sectionBars.value = Math.round(randomBetween(random, 2, 16));
  controls.beatFlash.checked = random() > 0.12;
  controls.downbeatFlash.checked = random() > 0.72;
  controls.stageBeatIndicator.checked = random() > 0.48;
  controls.fullscreenOnStart.checked = false;
  controls.midiSync.checked = false;
  controls.autoSections.checked = random() > 0.58;
  controls.recordingMode.checked = false;
  controls.invert.checked = random() > 0.82;
  controls.scanlines.checked = random() > 0.24;
  controls.wordHalo.checked = random() > 0.18;
  controls.backgroundOnly.checked = random() > 0.82;
  controls.maskMode.value = random() > 0.75 && controls.maskArt.value.trim() ? pick(["stencil", "reveal", "texture"], random) : "off";
  randomizeSelect(controls.maskLayer, random);
  controls.maskScale.value = Math.round(randomBetween(random, 1, 8));
  if (controls.charsetPreset.value === "custom") {
    controls.customCharset.value = pick([
      "@%#*+=-:. ",
      "01 ",
      ".oO80Q@ ",
      "/\\|xX ",
      "~-=+*#@ "
    ], random);
  }
  updateSliderReadouts();
  schedulePreview();
}

function restartPlayback(fade = false) {
  if (!state.running) return;
  cancelAnimationFrame(state.raf);
  state.pendingPreset = null;
  prepareStateFromControls();
  state.lastBeat = -1;
  state.lastRenderAt = 0;
  state.lastFrameAt = 0;
  state.fpsSamples = [];
  state.currentFps = 0;
  state.paused = false;
  applyStagePalette();
  applyPresentationClasses(controls.stage, state.options);
  controls.stageHud.hidden = !state.options.stageBeatIndicator;
  if (fade) {
    controls.stage.classList.remove("fade-cut");
    void controls.stage.offsetWidth;
    controls.stage.classList.add("fade-cut");
  }
  state.raf = requestAnimationFrame(loop);
}

function togglePause() {
  if (!state.running) return;
  const now = performance.now();
  if (state.paused) {
    state.startedAt += now - state.pausedAt;
    state.paused = false;
    state.lastRenderAt = 0;
    state.raf = requestAnimationFrame(loop);
  } else {
    state.paused = true;
    state.pausedAt = now;
  }
  controls.stageInfo.textContent = state.paused ? `Paused / ${state.currentFps || 0} FPS` : getStatusText(state.options, state.currentFps);
}

function nudgeBpm(delta) {
  const bpm = clamp((Number(controls.bpm.value) || 120) + delta, 20, 360);
  controls.bpm.value = bpm;
  if (state.running) {
    const now = performance.now();
    const oldBeatMs = 60000 / state.options.bpm;
    const elapsedBeats = Math.max(0, (now - state.startedAt) / oldBeatMs);
    state.options.bpm = bpm;
    state.startedAt = now - elapsedBeats * (60000 / bpm);
    controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
  } else {
    schedulePreview();
  }
}

function toggleRunningCheckbox(control) {
  control.checked = !control.checked;
  if (!state.running) {
    schedulePreview();
    return;
  }
  state.options[control.id] = control.checked;
  applyPresentationClasses(controls.stage, state.options);
  if (!state.running) applyPresentationClasses(controls.previewPanel, collectOptions());
}

function cycleSelect(control) {
  control.selectedIndex = (control.selectedIndex + 1) % control.options.length;
  if (state.running) restartPlayback();
  else schedulePreview();
}

function applyPanicLook() {
  const preset = {
    ...getPreset(),
    colorMode: "spotlight",
    backgroundMode: "ray",
    charsetPreset: "minimal",
    beatRate: "1",
    wordMotion: "pulse",
    quality: "medium",
    fpsCap: "45",
    legibilityMode: "readable",
    glyphSize: "14",
    density: "1",
    glitch: "8",
    wordHalo: true,
    haloSize: "8",
    backgroundOnly: false,
    beatFlash: false,
    downbeatFlash: false,
    scanlines: true,
    invert: false
  };
  state.pendingPreset = null;
  applyPresetNow(preset, true);
  controls.sceneReadout.textContent = "Panic look applied";
}

function applyStagePalette() {
  const palette = palettePresets[state.options.palette] || palettePresets.cyber;
  const foreground = `hsl(${palette.leadHue} ${palette.saturation}% ${palette.light}%)`;
  const glowA = `hsla(${palette.bgHue} ${palette.bgSat}% 58% / 0.46)`;
  const glowB = `hsla(${palette.leadHue} ${palette.saturation}% 58% / 0.28)`;
  const glowC = `hsla(${palette.secondaryHue} ${palette.saturation}% 58% / 0.2)`;
  controls.ascii.style.color = foreground;
  controls.ascii.style.textShadow = `0 0 6px ${glowA}, 2px 0 0 ${glowB}, -2px 0 0 ${glowC}`;
}

function loop(now) {
  if (!state.running) return;
  if (state.paused) {
    state.raf = requestAnimationFrame(loop);
    return;
  }
  const frameInterval = getFrameInterval();
  if (frameInterval && now - state.lastRenderAt < frameInterval) {
    state.raf = requestAnimationFrame(loop);
    return;
  }

  try {
    state.lastRenderAt = now;
    const capture = getCaptureSize();
    const frame = buildFrame(now, capture.width, capture.height);
    renderFrame(frame);
    trackFps(now);
    if (state.options.stageBeatIndicator) controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
    if (maybeApplyQueuedPreset(frame)) return;
    state.raf = requestAnimationFrame(loop);
  } catch (error) {
    showRenderError(error);
  }
}

function showRenderError(error) {
  state.running = false;
  cancelAnimationFrame(state.raf);
  const message = error && error.message ? error.message : String(error);
  controls.canvas.hidden = true;
  controls.ascii.hidden = false;
  controls.ascii.classList.remove("colorized");
  controls.ascii.textContent = [
    "ASCII RENDER ERROR",
    "",
    message,
    "",
    "Press Escape to return to the menu."
  ].join("\n");
}

function start() {
  stopPreviewLoop();
  prepareStateFromControls();
  state.lastBeat = -1;
  state.lastRenderAt = 0;
  state.running = true;
  state.paused = false;
  state.pausedAt = 0;

  controls.ascii.textContent = "";
  controls.ascii.style.fontSize = `${getEffectiveGlyphSize()}px`;
  controls.ascii.style.lineHeight = `${getEffectiveGlyphSize()}px`;
  applyStagePalette();
  applyPresentationClasses(controls.stage, state.options);
  controls.stageHud.hidden = !state.options.stageBeatIndicator;
  controls.stageInfo.textContent = getStatusText(state.options, state.currentFps);
  controls.menu.hidden = true;
  controls.stage.hidden = false;
  document.body.style.overflow = "hidden";
  document.body.classList.add("playing");
  if (state.options.fullscreenOnStart) requestFullscreen();
  loop(state.startedAt);
}

function stop() {
  if (!state.running && controls.stage.hidden && !document.body.classList.contains("playing")) return;
  state.running = false;
  state.paused = false;
  cancelAnimationFrame(state.raf);
  controls.canvas.hidden = true;
  controls.ascii.hidden = false;
  controls.stageHud.hidden = true;
  controls.stage.hidden = true;
  controls.menu.hidden = false;
  document.body.style.overflow = "";
  document.body.classList.remove("playing");
  exitFullscreen();
  schedulePreview();
}

controls.start.addEventListener("click", start);
controls.randomizeSeed.addEventListener("click", randomizeSeed);
controls.copyPreset.addEventListener("click", copyPreset);
controls.loadPreset.addEventListener("click", loadPreset);
controls.copySceneBank.addEventListener("click", copySceneBank);
controls.loadSceneBank.addEventListener("click", loadSceneBank);
controls.randomizeAll.addEventListener("click", randomizeAll);
controls.tapTempo.addEventListener("click", tapTempo);
controls.fullscreenButton.addEventListener("click", requestFullscreen);
controls.copyShareUrl.addEventListener("click", copyShareUrl);
controls.copyObsUrl.addEventListener("click", copyObsUrl);
controls.saveFrame.addEventListener("click", saveFrame);
controls.panicButton.addEventListener("click", applyPanicLook);
controls.connectMidi.addEventListener("click", connectMidi);
controls.midiInput.addEventListener("change", attachMidiInput);
controls.refreshPreview.addEventListener("click", () => renderPreview());
controls.storeScene.addEventListener("click", () => storeScene());
controls.clearScenes.addEventListener("click", clearScenes);
controls.sceneSlots.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("[data-slot]") : null;
  if (!button) return;
  const slot = Number(button.dataset.slot);
  selectSceneSlot(slot);
  if (event.shiftKey) storeScene(slot);
  else recallScene(slot);
});
controls.applyDefaultScene.addEventListener("click", () => applyNamedPreset(controls.defaultScenePreset.value));
controls.randomizeVisual.addEventListener("click", () => {
  randomizeVisual();
  if (state.running) restartPlayback();
});
controls.randomizeMotion.addEventListener("click", () => {
  randomizeMotion();
  if (state.running) restartPlayback();
});
controls.randomizeColour.addEventListener("click", () => {
  randomizeColour();
  if (state.running) restartPlayback();
});
controls.randomizeTiming.addEventListener("click", () => {
  randomizeTiming();
  if (state.running) restartPlayback();
});
controls.midiSync.addEventListener("change", () => {
  if (controls.midiSync.checked && !state.midiAccess) connectMidi();
  if (!controls.midiSync.checked) setMidiStatus("off");
});
controls.livePreview.addEventListener("change", () => {
  state.previewStartedAt = performance.now();
  state.lastPreviewFrameAt = 0;
  state.previewFpsSamples = [];
  state.currentPreviewFps = 0;
  if (controls.livePreview.checked) startPreviewLoop();
  else {
    stopPreviewLoop();
    renderPreview();
  }
});
window.addEventListener("resize", schedulePreview);

for (const control of [controls.glyphSize, controls.density, controls.glitch, controls.haloSize, controls.maskScale]) {
  control.addEventListener("input", updateSliderReadouts);
}

for (const id of presetFields) {
  const control = controls[id];
  if (!control) continue;
  control.addEventListener(control.type === "checkbox" ? "change" : "input", schedulePreview);
  if (control.tagName === "SELECT") control.addEventListener("change", schedulePreview);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    stop();
    exitFullscreen();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !state.running) {
    start();
    return;
  }
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLButtonElement
  ) return;
  if ((event.key === "t" || event.key === "T") && !state.running) tapTempo();
  if (event.key === " " && !state.running) {
    event.preventDefault();
    controls.livePreview.checked = true;
    state.previewStartedAt = performance.now();
    startPreviewLoop();
  }
  if (event.key === " " && state.running) {
    event.preventDefault();
    togglePause();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    nudgeBpm(event.shiftKey ? 5 : 1);
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    nudgeBpm(event.shiftKey ? -5 : -1);
  }
  if (event.key === "0") applyPanicLook();
  if (event.key === "b" || event.key === "B") toggleRunningCheckbox(controls.backgroundOnly);
  if (event.key === "h" || event.key === "H") toggleRunningCheckbox(controls.wordHalo);
  if (event.key === "i" || event.key === "I") toggleRunningCheckbox(controls.invert);
  if (event.key === "s" || event.key === "S") toggleRunningCheckbox(controls.scanlines);
  if (event.key === "m" || event.key === "M") cycleSelect(controls.wordMotion);
  if (/^[1-8]$/.test(event.key)) {
    recallScene(Number(event.key));
  }
});

loadPresetFromUrl();
loadSceneSlots();
updateSliderReadouts();
applyTooltips();
schedulePreview();
