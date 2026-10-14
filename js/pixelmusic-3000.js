/* Browser adaptation of the supplied pixelmusic950.spin, Pixelmusic 3000,
   created by Tarikh Korula for Uncommon Projects, January 2008.
   Preserves its eight draw routines, active sprite silhouettes, palette order,
   and Propeller Graphics pixel-width semantics. Browser audio envelopes, RGB
   palette approximations, and a 30 Hz virtual draw clock replace ADC/TV timing.
   Pixel weight, gain, speed, stretch, holds, and musical automation are browser
   controls. Original timing with all favourites keeps the source RNG sequence. */
const Pixelmusic3000 = (() => {
  "use strict";
  const defaults = Object.freeze({ pmInput: "demo", pmRoutine: "auto", pmPalette: "auto", pmGainLeft: "100",
    pmGainRight: "100", pmSpeed: "1", pmStretch: false, pmThickness: "2",
    pmAutomation: "original", pmChangeEvery: "4", pmPatternHold: false, pmPaletteHold: false,
    ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`pmFavorite${index}`, true])) });
  const WIDTH = 256, HEIGHT = 192;
  const FAMILIES = ["brown", "blue", "pink", "aqua", "orange"];
  const pixelsCache = new WeakMap();
  let surface, surfaceContext;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const boolean = (value, fallback = false) => value === true || value === "true" ? true
    : value === false || value === "false" ? false : fallback;

  function hash(value) {
    let result = 2166136261;
    for (const letter of String(value ?? "pixelmusic")) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
    return result >>> 0;
  }
  function normalize(options) {
    const speed = number(options.pmSpeed, 1);
    const favourites = Array.from({ length: 8 }, (_, index) => boolean(options[`pmFavorite${index}`], true));
    if (!favourites.some(Boolean)) favourites.fill(true);
    return Object.freeze({
      pmInput: options.pmInput === "audio" ? "audio" : "demo",
      pmRoutine: /^[0-7]$/.test(String(options.pmRoutine)) ? String(options.pmRoutine) : "auto",
      pmPalette: FAMILIES.includes(options.pmPalette) ? options.pmPalette : "auto",
      pmGainLeft: clamp(number(options.pmGainLeft, 100), 0, 200),
      pmGainRight: clamp(number(options.pmGainRight, 100), 0, 200),
      pmSpeed: [0.25, 0.5, 1, 2, 4].includes(speed) ? speed : 1,
      pmStretch: boolean(options.pmStretch),
      pmThickness: Math.round(clamp(number(options.pmThickness, 2), 1, 6)),
      pmAutomation: ["beats", "bars"].includes(options.pmAutomation) ? options.pmAutomation : "original",
      pmChangeEvery: [1, 2, 4, 8].includes(Number(options.pmChangeEvery)) ? Number(options.pmChangeEvery) : 4,
      pmPatternHold: boolean(options.pmPatternHold), pmPaletteHold: boolean(options.pmPaletteHold),
      ...Object.fromEntries(favourites.map((enabled, index) => [`pmFavorite${index}`, enabled]))
    });
  }
  function signalScalar(channel, gain) {
    let level = Number(channel?.level);
    if (!Number.isFinite(level)) {
      const samples = channel?.samples;
      const length = Math.min(samples?.length || 0, 4096);
      level = 0;
      for (let index = 0; index < length; index++) level += Math.abs(number(samples[index], 0));
      if (length) level /= length;
    }
    return Math.min(15, Math.floor(clamp(level * gain / 100, 0, 1) * 16));
  }
  function randomValue(auto, size) {
    let value = auto.randomState += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    auto.randomState >>>= 0;
    return 1 + Math.floor(((value ^ value >>> 14) >>> 0) / 4294967296 * size);
  }
  function sourceRandom(auto, size) {
    let value = randomValue(auto, size);
    if (value === auto.lastRandom) value = randomValue(auto, size);
    auto.lastRandom = value;
    return value;
  }

  const SOURCE_COLORS = {
    "02": [0, 0, 0], "9d": [190, 148, 68], "9e": [231, 192, 105], "9b": [118, 79, 36],
    "3c": [81, 139, 193], "b8": [101, 62, 149], "eb": [186, 92, 155],
    "dd": [191, 107, 216], "ed": [240, 143, 214], "3e": [213, 234, 250],
    "4e": [159, 226, 243], "6e": [177, 232, 164], "5c": [77, 176, 139], "8e": [238, 187, 115], "ad": [171, 186, 83]
  };
  const PALETTES = Object.freeze([
    ["9d", "9e", "9b"], ["9e", "9d", "9b"], ["9d", "9e", "9b"], ["9d", "9e", "9b"], ["9b", "9b", "9e"], ["9b", "9e", "9b"],
    ["3c", "b8", "eb"], ["b8", "3c", "eb"], ["3c", "b8", "eb"], ["3c", "b8", "eb"], ["eb", "eb", "b8"], ["eb", "b8", "eb"],
    ["dd", "ed", "3e"], ["ed", "dd", "3e"], ["dd", "ed", "3e"], ["dd", "ed", "3e"], ["3e", "dd", "ed"], ["3e", "ed", "dd"],
    ["4e", "3e", "6e"], ["3e", "4e", "6e"], ["4e", "3e", "6e"], ["4e", "3e", "6e"], ["6e", "3e", "4e"], ["6e", "4e", "3e"],
    ["5c", "8e", "ad"], ["8e", "5c", "ad"], ["5c", "8e", "ad"], ["5c", "8e", "ad"], ["ad", "5c", "8e"], ["ad", "8e", "5c"]
  ].map(colors => Object.freeze(["02", ...colors].map(key => Object.freeze(SOURCE_COLORS[key].slice())))));

  function residueCount(tick, residue) {
    return tick < residue ? 0 : Math.floor((tick - residue) / 17) + 1;
  }
  function evenTicks(tick) {
    let result = 0;
    for (let residue = 0; residue <= 16; residue += 2) result += residueCount(tick, residue);
    return result;
  }

  function patternOrder(pool, seed) {
    const order = pool.slice();
    const random = { randomState: hash(`${seed}|pixelmusic-patterns|${pool.join(",")}`) };
    for (let index = order.length - 1; index > 0; index--) {
      const other = randomValue(random, index + 1) - 1;
      [order[index], order[other]] = [order[other], order[index]];
    }
    return order;
  }

  function advancePattern(current, count, pool, seed) {
    const order = patternOrder(pool, seed);
    const position = order.indexOf(current);
    return order[(position + count) % order.length];
  }

  function buildFrame(options = {}, elapsedMs = 0, signal = {}, seed = 1, previousFrame = null, actions = {}) {
    const settings = normalize(options);
    const elapsed = clamp(number(elapsedMs, 0), 0, 1e12);
    const bpm = clamp(number(options.bpm, 120), 20, 360);
    const barLength = Math.round(clamp(number(options.barLength, 4), 1, 32));
    const signature = JSON.stringify([hash(seed), settings.pmInput]);
    // Knob and palette edits retain the automatic selection. A new signal source,
    // seed, or transport rewind starts a new session; BPM edits may rebase elapsed.
    const previous = previousFrame?.signature === signature && (previousFrame.elapsedMs <= elapsed || previousFrame.bpm !== bpm)
      ? previousFrame : null;
    const time = previous ? previous.time + Math.max(0, elapsed - previous.elapsedMs) * settings.pmSpeed : elapsed * settings.pmSpeed;
    const pool = Array.from({ length: 8 }, (_, index) => index).filter(index => settings[`pmFavorite${index}`]);
    const scalarLeft = signalScalar(signal?.left, settings.pmGainLeft);
    const scalarRight = signalScalar(signal?.right, settings.pmGainRight);
    const total = Math.floor((scalarLeft + scalarRight) / 2);
    const auto = previous ? { ...previous.auto } : { routine: pool.includes(0) ? 0 : pool[0], paletteIndex: 15,
      counter: 0, nextChangeAt: 1000, randomState: hash(seed), lastRandom: 0 };
    const automationSignature = JSON.stringify([settings.pmAutomation, settings.pmChangeEvery, barLength]);
    const intervalBeats = settings.pmChangeEvery * (settings.pmAutomation === "bars" ? barLength : 1);
    const automationStep = Math.floor((elapsed * bpm / 60000 + 1e-9) / intervalBeats);
    const elapsedSteps = previous && previous.automationSignature !== automationSignature ? 0
      : Math.max(0, automationStep - (previous?.automationStep || 0));
    // Like the source, an expired delay remains ready during quiet input.
    // The next audible draw advances once and starts a fresh random delay.
    if (settings.pmAutomation === "original") {
      if (previous && previous.options.pmAutomation !== "original") auto.nextChangeAt = time + 1000;
      if (total > 4 && time >= auto.nextChangeAt) {
        if (!settings.pmPaletteHold) { auto.counter = (auto.counter + 1) % 30; auto.paletteIndex = auto.counter; }
        let candidate = sourceRandom(auto, 8) - 1;
        // The unrestricted Original mode deliberately keeps natural source repeats.
        if (pool.length < 8 && (!pool.includes(candidate) || candidate === auto.routine)) {
          const eligible = pool.filter(pattern => pattern !== auto.routine);
          candidate = eligible.length ? eligible[candidate % eligible.length] : pool[0];
        }
        if (!settings.pmPatternHold) auto.routine = candidate;
        auto.nextChangeAt = time + sourceRandom(auto, 32) * 125;
      }
    } else if (elapsedSteps) {
      // A seeded cycle permits exact, bounded catch-up even after a suspended tab.
      // Held events are consumed without later jumping through the missed choices.
      if (!settings.pmPatternHold) auto.routine = advancePattern(auto.routine, elapsedSteps, pool, seed);
      if (!settings.pmPaletteHold) {
        auto.paletteIndex = (auto.paletteIndex + elapsedSteps) % 30;
        auto.counter = auto.paletteIndex;
      }
    }
    const actionState = Object.freeze(Object.fromEntries(["patternNext", "paletteNext"].map(key =>
      [key, Math.floor(clamp(number(actions?.[key], previous?.actions?.[key] || 0), 0, 1e9))])));
    const patternNext = Math.max(0, actionState.patternNext - (previous?.actions?.patternNext || 0));
    const paletteNext = Math.max(0, actionState.paletteNext - (previous?.actions?.paletteNext || 0));
    if (patternNext && settings.pmRoutine === "auto") auto.routine = advancePattern(auto.routine, patternNext, pool, seed);
    if (paletteNext) { auto.paletteIndex = (auto.paletteIndex + paletteNext) % 30; auto.counter = auto.paletteIndex; }
    const activeRoutine = settings.pmRoutine === "auto" ? auto.routine : Number(settings.pmRoutine);
    const paletteIndex = settings.pmPalette === "auto" ? auto.paletteIndex
      : FAMILIES.indexOf(settings.pmPalette) * 6 + auto.paletteIndex % 6;
    const tick = Math.floor(time * 30 / 1000);
    const j = tick % 17;
    const rotate = (residueCount(tick, 0) + residueCount(tick, 9)) % 2 === 1;
    let change = previous?.change || false;
    if (settings.pmAutomation !== "original") {
      // Musical automation also keeps stripe phase independent of skipped draws.
      change = evenTicks(tick) % 2 === 1;
    } else if (activeRoutine <= 2 && (evenTicks(tick) - evenTicks(previous?.tick ?? -1)) % 2) change = !change;
    const stamps = [];
    const stamp = (sprite, width, x = 0, y = 0, rotation = 0) => stamps.push(Object.freeze({ sprite, width, x, y, rotation }));
    const stripe = change ? "stripeB" : "stripeA";
    const sides = Math.floor(total / 2) + 16;
    const centralPair = () => { stamp("diamond2", scalarRight + 16); stamp("diamond1", scalarLeft + 16); };
    switch (activeRoutine) {
      case 0:
        stamp(stripe, scalarRight + 16); stamp("small1", scalarLeft + 16);
        if (total) { stamp("diamond3", sides, -90); stamp("diamond3", sides, 90); }
        break;
      case 1:
        if (j % 2 === 0) stamp("small2", scalarLeft + 16, 0, 0, 1);
        stamp(stripe, scalarRight + 16); stamp("small1", scalarLeft + 16);
        break;
      case 2:
        if (j % 2 === 0) stamp("small1", scalarLeft, 0, 0, 1);
        stamp(stripe, scalarRight); stamp("small1", scalarLeft);
        break;
      case 3:
        stamp("diamond1", scalarLeft + 16);
        stamp(rotate ? "stripeA" : "stripeB", scalarRight + 16, 0, 0, rotate ? 0 : 1);
        break;
      case 4:
        centralPair();
        if (total) for (const [x, y] of [[-90, 0], [90, 0], [0, 90], [0, -90]]) stamp("diamond3", sides, x, y);
        break;
      case 5:
        centralPair();
        if (total) for (const [x, y, sprite] of [[-90, -90, "diamond2"], [-90, 0, "diamond3"], [90, 90, "diamond2"], [90, 0, "diamond3"],
          [-90, 90, "diamond2"], [0, 90, "diamond3"], [90, -90, "diamond2"], [0, -90, "diamond3"]]) stamp(sprite, sides, x, y);
        break;
      case 6:
        centralPair();
        if (total) { stamp("diamond3", Math.floor(total / 2), 0, 90); stamp("diamond3", Math.floor(total / 2), 0, -90); }
        break;
      case 7:
        stamp("diamond1", scalarLeft); stamp("diamond2", scalarRight + 16);
        if (total) {
          stamp("diamond2", sides, -90); stamp("diamond2", sides, 90);
          stamp("diamond3", Math.floor(total / 8), 0, 90); stamp("diamond3", Math.floor(total / 8), 0, -90);
        }
        break;
    }
    return Object.freeze({ width: WIDTH, height: HEIGHT, elapsedMs: elapsed, time, bpm, options: settings, signature,
      automationSignature, automationStep, actions: actionState,
      scalarLeft, scalarRight, total, activeRoutine, paletteIndex, paletteFamily: FAMILIES[Math.floor(paletteIndex / 6)],
      palette: PALETTES[paletteIndex], stamps: Object.freeze(stamps), auto: Object.freeze(auto),
      stretch: settings.pmStretch, tick, j, rotate, change });
  }

  function spriteRow(sprite, row) {
    if (sprite.startsWith("small")) return row >= 3 && row <= 11 ? [2, 4, 6, 10, 16, 10, 6, 4, 2][row - 3] : 0;
    if (row === 15 || (sprite === "stripeA" && row % 2 === 0) || (sprite === "stripeB" && row % 2 === 1)) return 0;
    return 16 - Math.abs(row - 7) * 2;
  }

  function nativePixels(frame) {
    if (pixelsCache.has(frame)) return pixelsCache.get(frame);
    const indices = new Uint8Array(WIDTH * HEIGHT);
    for (const stamp of frame.stamps) {
      const step = (stamp.width & 15) + 1;
      const square = Boolean(stamp.width & 16);
      const diameter = Math.max(1, Math.round(step * frame.options.pmThickness / 2));
      const xMinimum = -Math.floor((diameter - 1) / 2), xMaximum = Math.ceil((diameter - 1) / 2);
      const yMinimum = -Math.ceil((diameter - 1) / 2), yMaximum = Math.floor((diameter - 1) / 2);
      const radius = diameter / 2;
      const penCenterX = (xMinimum + xMaximum) / 2, penCenterY = (yMinimum + yMaximum) / 2;
      const color = stamp.sprite.endsWith("1") ? 1 : stamp.sprite.endsWith("3") ? 3 : 2;
      for (let row = 0; row < 16; row++) {
        const count = spriteRow(stamp.sprite, row);
        const first = (16 - count) / 2;
        for (let column = first; column < first + count; column++) {
          // Graphics.spin setup/pix use yorigin95 and sprite yanchor7.
          const centerX = 128 + stamp.x + (stamp.rotation ? row - 7 : column - 8) * step;
          const centerY = 95 - stamp.y + (stamp.rotation ? 8 - column : row - 7) * step;
          const minX = Math.max(0, centerX + xMinimum), maxX = Math.min(WIDTH - 1, centerX + xMaximum);
          const minY = Math.max(0, centerY + yMinimum), maxY = Math.min(HEIGHT - 1, centerY + yMaximum);
          for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            if (!square && (x - centerX - penCenterX) ** 2 + (y - centerY - penCenterY) ** 2 > radius * radius) continue;
            // Sprite zero is transparent; nonzero pixels replace prior color.
            indices[y * WIDTH + x] = color;
          }
        }
      }
    }
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let index = 0; index < indices.length; index++) {
      const color = frame.palette[indices[index]], offset = index * 4;
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
    }
    pixelsCache.set(frame, pixels);
    return pixels;
  }
  function rasterize(frame) { return nativePixels(frame).slice(); }
  function draw(context, frame, width, height) {
    if (!context || !frame || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    if (!surface) {
      surface = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(WIDTH, HEIGHT) : document.createElement("canvas");
      surface.width = WIDTH; surface.height = HEIGHT; surfaceContext = surface.getContext("2d");
    }
    const data = surfaceContext.createImageData(WIDTH, HEIGHT);
    data.data.set(nativePixels(frame)); surfaceContext.putImageData(data, 0, 0);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    const displayWidth = frame.stretch ? width : WIDTH * scale;
    const displayHeight = frame.stretch ? height : HEIGHT * scale;
    context.save(); context.globalAlpha = 1; context.globalCompositeOperation = "source-over";
    context.filter = "none"; context.shadowBlur = 0; context.imageSmoothingEnabled = false;
    context.fillStyle = "#000"; context.fillRect(0, 0, width, height);
    context.drawImage(surface, (width - displayWidth) / 2, (height - displayHeight) / 2, displayWidth, displayHeight);
    context.restore();
  }
  return Object.freeze({ defaults, buildFrame, draw, rasterize });
})();
