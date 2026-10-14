/* Video Music 2 is a separate creative instrument. It borrows Atari Video
   Music's stereo envelope analysis without changing the hardware-style mode. */
const VideoMusic2 = (() => {
  "use strict";

  const defaults = Object.freeze({
    vm2Input: "demo", vm2Aspect: "viewport", vm2AspectWidth: "16", vm2AspectHeight: "9",
    vm2Geometry: "diamond", vm2Shape: "solid", vm2Columns: "3", vm2Rows: "2",
    vm2GainLeft: "100", vm2GainRight: "85", vm2ContourLeft: "65", vm2ContourRight: "65",
    vm2Color: "65", vm2Palette: "neon", vm2Hue: "0", vm2Saturation: "90",
    vm2Symmetry: "none", vm2Rotation: "0", vm2Spin: "0", vm2Zoom: "100",
    vm2Glow: "35", vm2Trails: "0", vm2Detail: "fine", vm2AutoRate: "2", vm2AutoShape: "all"
  });
  const choices = {
    vm2Input: ["demo", "audio"], vm2Aspect: ["viewport", "16:9", "21:9", "4:3", "1:1", "9:16", "custom"],
    vm2Geometry: ["diamond", "circle", "square", "hexagon", "star", "triangle", "pentagon", "octagon", "cross", "clover", "starburst"],
    vm2Shape: ["solid", "hole", "ring", "auto"], vm2Palette: ["spectral", "neon", "sunset", "ice", "phosphor", "mono"],
    vm2Symmetry: ["none", "horizontal", "vertical", "quad"], vm2Detail: ["chunky", "fine", "smooth"],
    vm2AutoRate: ["1", "2", "4", "8"], vm2AutoShape: ["all", "solid", "hole", "ring"]
  };
  const ranges = {
    vm2AspectWidth: [1, 32], vm2AspectHeight: [1, 32], vm2Columns: [1, 8], vm2Rows: [1, 8],
    vm2GainLeft: [0, 200], vm2GainRight: [0, 200], vm2ContourLeft: [0, 100], vm2ContourRight: [0, 100],
    vm2Color: [0, 100], vm2Hue: [0, 360], vm2Saturation: [0, 100], vm2Rotation: [-180, 180],
    vm2Spin: [-60, 60], vm2Zoom: [50, 200], vm2Glow: [0, 100], vm2Trails: [0, 100]
  };
  const TAU = Math.PI * 2;
  const HEX_COSINE = Math.sqrt(3) / 2;
  const OCTAGON_COSINE = Math.cos(Math.PI / 8);
  const PENTAGON_EDGES = Array.from({ length: 5 }, (_, index) => {
    const normal = -Math.PI / 2 + (index + 0.5) * TAU / 5;
    const radius = Math.cos(Math.PI / 5);
    return [Math.cos(normal) / radius, Math.sin(normal) / radius];
  });
  const BURST_SLOPE = Math.tan(Math.PI / 8);
  const BURST_INNER_X = Math.cos(Math.PI / 8) * 0.42;
  const BURST_INNER_Y = Math.sin(Math.PI / 8) * 0.42;
  const BURST_DETERMINANT = Math.SQRT1_2 * (BURST_INNER_X - BURST_INNER_Y);
  const BURST_EDGES = [
    [1, (1 - BURST_INNER_X) / BURST_INNER_Y],
    [(Math.SQRT1_2 - BURST_INNER_Y) / BURST_DETERMINANT, (BURST_INNER_X - Math.SQRT1_2) / BURST_DETERMINANT]
  ];
  const STAR_COT_36 = 1 / Math.tan(Math.PI / 5);
  const STAR_COT_72 = 1 / Math.tan(Math.PI * 2 / 5);
  const STAR_EDGES = Array.from({ length: 10 }, (_, index) => {
    const firstAngle = -Math.PI / 2 + index * Math.PI / 5;
    const secondAngle = firstAngle + Math.PI / 5;
    const firstRadius = index % 2 ? 0.47 : 1;
    const secondRadius = index % 2 ? 1 : 0.47;
    const ax = Math.cos(firstAngle) * firstRadius;
    const ay = Math.sin(firstAngle) * firstRadius;
    const bx = Math.cos(secondAngle) * secondRadius;
    const by = Math.sin(secondAngle) * secondRadius;
    const determinant = ax * by - ay * bx;
    return [(by - ay) / determinant, (ax - bx) / determinant];
  });
  const MAX_HISTORY = 8;
  const pixelCache = new WeakMap();
  let surface;
  let surfaceContext;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fraction = value => value - Math.floor(value);

  function seedNumber(value) {
    if (typeof value === "number") return value >>> 0;
    let result = 2166136261;
    for (const character of String(value ?? "video-music-2")) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  }

  function randomAt(seed, step, salt) {
    let value = (seed ^ Math.imul(step + 1, 0x9e3779b9) ^ salt) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
  }

  function normalized(options) {
    const result = {};
    for (const key of Object.keys(defaults)) {
      const value = options[key] ?? defaults[key];
      if (ranges[key]) {
        const bounded = clamp(number(value, Number(defaults[key])), ...ranges[key]);
        result[key] = key === "vm2AspectWidth" || key === "vm2AspectHeight" ? bounded : Math.round(bounded);
      } else {
        result[key] = choices[key].includes(String(value)) ? String(value) : defaults[key];
      }
    }
    return Object.freeze(result);
  }

  function rgb(hue, saturation, brightness) {
    const h = fraction(hue / 360) * 6;
    const c = brightness * saturation;
    const x = c * (1 - Math.abs(h % 2 - 1));
    const minimum = brightness - c;
    const parts = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h)];
    return Object.freeze(parts.map(part => Math.round(clamp(part + minimum, 0, 1) * 255)));
  }

  function paletteFor(settings) {
    const palette = settings.vm2Palette;
    const saturation = settings.vm2Saturation / 100;
    const spectralSaturation = 0.34 + 0.58 * Math.min(1, settings.vm2Color / 25);
    return Object.freeze(Array.from({ length: 16 }, (_, index) => {
      const position = index / 15;
      let hue = index / 16 * 360 + 12.6;
      let brightness = 0.94;
      let sat = saturation;
      if (palette === "spectral") sat *= spectralSaturation;
      if (palette === "neon") hue = index % 2 ? 172 + position * 74 : 276 + position * 68;
      if (palette === "sunset") hue = 322 + position * 105;
      if (palette === "ice") { hue = 170 + position * 70; sat *= 0.75; }
      if (palette === "phosphor") { hue = 112 + position * 32; brightness = 0.62 + position * 0.37; }
      if (palette === "mono") { sat = 0; brightness = 0.6 + position * 0.38; }
      return rgb(hue + settings.vm2Hue, sat, brightness);
    }));
  }

  function buildFrame(options = {}, elapsedMs = 0, signal = {}, seed = 1, previousFrame = null) {
    const settings = normalized(options);
    const elapsed = Math.max(0, number(elapsedMs, 0));
    const seedValue = seedNumber(seed);
    const signature = JSON.stringify([settings, seedValue, options.bpm ?? null]);
    const automatic = settings.vm2Shape === "auto";
    const step = Math.floor(elapsed / (Number(settings.vm2AutoRate) * 1000));
    const shape = automatic
      ? (settings.vm2AutoShape === "all" ? ["solid", "hole", "ring"][Math.floor(randomAt(seedValue, step, 157) * 3)] : settings.vm2AutoShape)
      : settings.vm2Shape;
    const columns = automatic ? 1 + Math.floor(randomAt(seedValue, step, 281) * 8) : settings.vm2Columns;
    const rows = automatic ? 1 + Math.floor(randomAt(seedValue, step, 419) * 8) : settings.vm2Rows;
    let aspect = null;
    if (settings.vm2Aspect === "custom") aspect = settings.vm2AspectWidth / settings.vm2AspectHeight;
    else if (settings.vm2Aspect !== "viewport") {
      const [width, height] = settings.vm2Aspect.split(":").map(Number);
      aspect = width / height;
    }
    const source = AtariVideoMusic.buildFrame({
      atariShape: "solid", atariHorizontal: 1, atariVertical: 1,
      atariGainLeft: settings.vm2GainLeft, atariGainRight: settings.vm2GainRight,
      atariContourLeft: settings.vm2ContourLeft, atariContourRight: settings.vm2ContourRight,
      atariColor: settings.vm2Color
    }, elapsed, signal, seedValue);
    const snapshot = Object.freeze({
      elapsedMs: elapsed, settings, aspect, geometry: settings.vm2Geometry, shape, columns, rows,
      angle: (settings.vm2Rotation + elapsed / 1000 * settings.vm2Spin) % 360,
      source, palette: paletteFor(settings)
    });
    const trailDuration = settings.vm2Trails ? 120 + settings.vm2Trails * 4.8 : 0;
    let history = [];
    if (trailDuration && previousFrame?.signature === signature && elapsed >= previousFrame.elapsedMs) {
      history = previousFrame.history.filter(item => elapsed - item.elapsedMs < trailDuration);
      // Fixed spacing preserves the full selected decay window at high frame
      // rates. Each entry is a flat snapshot, never another history chain.
      const spacing = trailDuration / MAX_HISTORY;
      if (elapsed > previousFrame.elapsedMs && (!history.length || previousFrame.elapsedMs - history[0].elapsedMs >= spacing)) {
        history.unshift(previousFrame.snapshot);
      }
      history = history.filter(item => elapsed - item.elapsedMs < trailDuration).slice(0, MAX_HISTORY);
    }
    return Object.freeze({ ...snapshot, snapshot, signature, trailDuration, history: Object.freeze(history) });
  }

  function viewport(frame, width, height) {
    let pictureWidth = width;
    let pictureHeight = height;
    if (frame.aspect) {
      pictureWidth = Math.min(width, height * frame.aspect);
      pictureHeight = pictureWidth / frame.aspect;
    }
    return { width: pictureWidth, height: pictureHeight, left: (width - pictureWidth) / 2, top: (height - pictureHeight) / 2 };
  }

  function distanceFor(x, y, geometry) {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (geometry === "diamond") return ax + ay;
    if (geometry === "circle") return Math.sqrt(x * x + y * y);
    if (geometry === "square") return Math.max(ax, ay);
    if (geometry === "hexagon") return Math.max(ay, ax * HEX_COSINE + ay * 0.5) / HEX_COSINE;
    // Homogeneous contour distances keep nested stereo masks aligned, so all
    // geometries share the same Hole/Ring, rotation, tiling, and zoom logic.
    if (geometry === "triangle") return Math.max(y * 2, ax * Math.sqrt(3) - y);
    if (geometry === "pentagon") {
      let distance = 0;
      for (const edge of PENTAGON_EDGES) distance = Math.max(distance, x * edge[0] + y * edge[1]);
      return distance;
    }
    if (geometry === "octagon") return Math.max(ax, ay, (ax + ay) * Math.SQRT1_2) / OCTAGON_COSINE;
    if (geometry === "cross") return Math.min(Math.max(ax / 0.34, ay), Math.max(ax, ay / 0.34));
    if (geometry === "clover") {
      const axis = Math.max(ax, ay);
      // Union of four half-radius circles centered on the cardinal axes.
      return axis ? (x * x + y * y) / axis : 0;
    }
    if (geometry === "starburst") {
      const major = Math.max(ax, ay), minor = Math.min(ax, ay);
      const edge = BURST_EDGES[minor < major * BURST_SLOPE ? 0 : 1];
      return major * edge[0] + minor * edge[1];
    }
    // Mirror into the five right-hand sectors and select their straight edge
    // using slopes. No per-pixel trigonometry is needed for the star contour.
    const index = y < -ax * STAR_COT_36 ? 0 : y < -ax * STAR_COT_72 ? 1
      : y < ax * STAR_COT_72 ? 2 : y < ax * STAR_COT_36 ? 3 : 4;
    const edge = STAR_EDGES[index];
    return ax * edge[0] + y * edge[1];
  }

  function snapshotPixels(snapshot, width, height) {
    const key = `${width}x${height}`;
    const cached = pixelCache.get(snapshot);
    if (cached?.has(key)) return cached.get(key);
    const output = new Uint8ClampedArray(width * height * 4);
    for (let index = 3; index < output.length; index += 4) output[index] = 255;
    const settings = snapshot.settings;
    const box = viewport(snapshot, width, height);
    const cellWidth = box.width / snapshot.columns;
    const cellHeight = box.height / snapshot.rows;
    // A single pixel scale for both axes keeps circles circular at any aspect.
    const unit = Math.min(cellWidth, cellHeight) / 2;
    const cosine = Math.cos(snapshot.angle * Math.PI / 180);
    const sine = Math.sin(snapshot.angle * Math.PI / 180);
    const zoom = settings.vm2Zoom / 100;
    const steps = settings.vm2Detail === "chunky" ? 15 : settings.vm2Detail === "fine" ? 48 : 0;
    const mirrorX = settings.vm2Symmetry === "horizontal" || settings.vm2Symmetry === "quad";
    const mirrorY = settings.vm2Symmetry === "vertical" || settings.vm2Symmetry === "quad";
    const colorSpread = Math.sin(settings.vm2Color / 100 * Math.PI);
    const outline = Math.max(1.2 / unit, settings.vm2Detail === "chunky" ? 0.14 : 0.075);
    const startX = Math.max(0, Math.ceil(box.left - 0.5));
    const endX = Math.min(width, Math.ceil(box.left + box.width - 0.5));
    const startY = Math.max(0, Math.ceil(box.top - 0.5));
    const endY = Math.min(height, Math.ceil(box.top + box.height - 0.5));
    const rotatedX = new Float64Array(width);
    const rotatedY = new Float64Array(width);
    const columnAt = new Uint8Array(width);
    for (let x = startX; x < endX; x++) {
      let px = x + 0.5 - box.left;
      if (mirrorX) px = Math.min(px, box.width - px);
      const column = Math.min(snapshot.columns - 1, Math.floor(px / cellWidth));
      const dx = (px - (column + 0.5) * cellWidth) / unit;
      columnAt[x] = column;
      rotatedX[x] = dx * cosine;
      rotatedY[x] = -dx * sine;
    }
    const leftColors = new Array(snapshot.columns);
    const rightColors = new Array(snapshot.columns);
    for (let y = startY; y < endY; y++) {
      let py = y + 0.5 - box.top;
      if (mirrorY) py = Math.min(py, box.height - py);
      const row = Math.min(snapshot.rows - 1, Math.floor(py / cellHeight));
      const dy = (py - (row + 0.5) * cellHeight) / unit;
      const scanRow = Math.min(239, Math.floor(py / box.height * 239));
      const leftRadius = snapshot.source.left.thresholds[scanRow] * zoom;
      const rightRadius = snapshot.source.right.thresholds[scanRow] * zoom;
      if (!(leftRadius > 0 || rightRadius > 0)) continue;
      if (snapshot.shape !== "solid" && leftRadius === rightRadius) continue;
      const ySine = dy * sine;
      const yCosine = dy * cosine;
      for (let column = 0; column < snapshot.columns; column++) {
        const colorRow = (scanRow + column * 17) % 240;
        const tileShift = Math.round((column * 3 + row * 5) * colorSpread);
        leftColors[column] = snapshot.palette[(snapshot.source.left.colors[colorRow] + tileShift) % 16];
        rightColors[column] = snapshot.palette[(snapshot.source.right.colors[colorRow] + tileShift) % 16];
      }
      for (let x = startX; x < endX; x++) {
        let rx = rotatedX[x] + ySine;
        let ry = rotatedY[x] + yCosine;
        if (steps) { rx = Math.round(rx * steps) / steps; ry = Math.round(ry * steps) / steps; }
        const distance = distanceFor(rx, ry, snapshot.geometry);
        const left = leftRadius > 0 && distance < leftRadius;
        const right = rightRadius > 0 && distance < rightRadius;
        let visible = snapshot.shape === "solid" ? left || right : left !== right;
        let selectLeft = left && (!right || leftRadius <= rightRadius);
        if (snapshot.shape === "ring") {
          // Creative geometry outlines retain stereo XOR cancellation, while
          // following the chosen contour instead of horizontal hardware pulses.
          visible = Math.abs(leftRadius - rightRadius) > 0.00001
            && ((leftRadius > 0 && Math.abs(distance - leftRadius) <= outline)
              || (rightRadius > 0 && Math.abs(distance - rightRadius) <= outline));
          selectLeft = Math.abs(distance - leftRadius) <= Math.abs(distance - rightRadius);
        }
        if (!visible) continue;
        const color = selectLeft ? leftColors[columnAt[x]] : rightColors[columnAt[x]];
        const offset = (y * width + x) * 4;
        output[offset] = color[0]; output[offset + 1] = color[1]; output[offset + 2] = color[2];
      }
    }
    // Reuse prior trail rasters without making export-sized caches permanent.
    if (width * height <= 200000) {
      const entries = cached || new Map();
      if (entries.size >= 2) entries.delete(entries.keys().next().value);
      entries.set(key, output);
      pixelCache.set(snapshot, entries);
    }
    return output;
  }

  function rasterize(frame, width = 480, height = 270) {
    const w = Math.max(1, Math.round(number(width, 480)));
    const h = Math.max(1, Math.round(number(height, 270)));
    const pixels = snapshotPixels(frame.snapshot || frame, w, h).slice();
    for (const prior of frame.history || []) {
      const age = frame.elapsedMs - prior.elapsedMs;
      const strength = frame.settings.vm2Trails / 100;
      const fade = 0.72 * strength * Math.pow(Math.max(0, 1 - age / frame.trailDuration), 1.65);
      if (fade <= 0.005) continue;
      const previous = snapshotPixels(prior, w, h);
      for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = Math.max(pixels[index], previous[index] * fade);
        pixels[index + 1] = Math.max(pixels[index + 1], previous[index + 1] * fade);
        pixels[index + 2] = Math.max(pixels[index + 2], previous[index + 2] * fade);
      }
    }
    return pixels;
  }

  function draw(context, frame, width, height) {
    if (!context || !frame || width <= 0 || height <= 0) return;
    const scale = Math.min(1, 480 / Math.max(width, height), Math.sqrt(160000 / (width * height)));
    const rasterWidth = Math.max(1, Math.round(width * scale));
    const rasterHeight = Math.max(1, Math.round(height * scale));
    if (!surface) {
      surface = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(rasterWidth, rasterHeight) : document.createElement("canvas");
      surfaceContext = surface.getContext("2d");
    }
    if (surface.width !== rasterWidth) surface.width = rasterWidth;
    if (surface.height !== rasterHeight) surface.height = rasterHeight;
    const data = surfaceContext.createImageData(rasterWidth, rasterHeight);
    data.data.set(rasterize(frame, rasterWidth, rasterHeight));
    surfaceContext.putImageData(data, 0, 0);
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.shadowBlur = 0;
    context.filter = "none";
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    const box = viewport(frame, width, height);
    context.beginPath(); context.rect(box.left, box.top, box.width, box.height); context.clip();
    context.imageSmoothingEnabled = frame.settings.vm2Detail === "smooth";
    context.drawImage(surface, 0, 0, width, height);
    const glow = frame.settings.vm2Glow / 100;
    if (glow > 0) {
      context.globalCompositeOperation = "screen";
      context.globalAlpha = glow * 0.65;
      context.filter = `blur(${(1 + glow * 5) * Math.max(1, Math.min(width, height) / 360)}px)`;
      context.drawImage(surface, 0, 0, width, height);
    }
    context.restore();
  }

  return Object.freeze({ defaults, buildFrame, draw, rasterize });
})();
