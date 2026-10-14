/* Atari Video Music behavioral emulation: stereo envelope comparators, 4-bit
   raster ramps, XOR shapes, and zero-crossing color. This does not simulate the
   original composite video circuitry or claim electrical accuracy. */
const AtariVideoMusic = (() => {
  "use strict";

  const WIDTH = 320;
  const HEIGHT = 240;
  const HORIZONTAL = [1, 2, 3, 5];
  const VERTICAL = [1, 2, 4, 8];
  const SHAPES = ["solid", "hole", "ring"];
  const COLOR_BANDS = [120, 240, 360, 480, 600, 720, 840, 960, 1200, 1440, 1680, 1920, 2400, 2880, 3360, 3840];
  const TAU = Math.PI * 2;
  let surface = null;
  let surfaceContext = null;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fraction = value => value - Math.floor(value);

  function hash(value) {
    if (typeof value === "number") return value >>> 0;
    const text = String(value ?? "atari");
    let result = 2166136261;
    for (let index = 0; index < text.length; index++) {
      result = Math.imul(result ^ text.charCodeAt(index), 16777619);
    }
    return result >>> 0;
  }

  function randomAt(seed, step, salt = 0) {
    let value = (seed ^ Math.imul(step + 1, 0x9e3779b9) ^ salt) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
  }

  function paletteFor(color) {
    // Approximate phosphor colors; COLOR's useful rainbow range sits between
    // its less-color and solid-color ends, as on the original front panel.
    const saturation = 0.34 + 0.58 * Math.min(1, color * 4);
    return Object.freeze(Array.from({ length: 16 }, (_, index) => {
      const hue = fraction(index / 16 + 0.035);
      const chroma = 0.92 * saturation;
      const x = chroma * (1 - Math.abs((hue * 6) % 2 - 1));
      const floor = 0.92 - chroma;
      const section = Math.floor(hue * 6);
      const channels = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][section];
      return Object.freeze(channels.map(component => Math.round((component + floor) * 255)));
    }));
  }

  function colorIndex(frequency, amount) {
    const spread = Math.sin(amount * Math.PI);
    const sensitiveFrequency = Math.max(0, frequency) * spread * 1.75;
    let band = COLOR_BANDS.findIndex(limit => sensitiveFrequency < limit);
    if (band < 0) band = Math.floor(sensitiveFrequency / 240) % 16;
    return (band + Math.round(amount * 11)) % 16;
  }

  function channelFrame(channel, gain, contour, color, sampleRate) {
    const level = clamp(numeric(channel?.level, 0), 0, 1);
    const frequency = Math.max(0, numeric(channel?.crossings, 0));
    const samples = channel?.samples;
    const count = samples && samples.length ? samples.length : 0;
    const thresholds = new Array(HEIGHT);
    const colors = new Array(HEIGHT);
    let average = 0;
    for (let index = 0; index < count; index++) average += Math.abs(numeric(samples[index], 0));
    average = count ? average / count : 0;

    // CONTOUR changes the rectifier's integration time. A clockwise setting
    // smooths audio ripple into geometric diamonds, rather than rounding them.
    const integrationSeconds = 0.00035 + Math.pow(contour, 2.5) * 0.042;
    const integration = 1 - Math.exp(-1 / (sampleRate * integrationSeconds));
    let envelope = average;
    let crossingFrequency = frequency;
    let priorCrossing = -1;
    let previousSample = count ? numeric(samples[0], 0) : 0;
    const envelopes = count ? new Float32Array(count) : null;
    const frequencies = count ? new Float32Array(count) : null;
    for (let index = 0; index < count; index++) {
      const sample = numeric(samples[index], 0);
      envelope += (Math.abs(sample) - envelope) * integration;
      if (sample >= 0 && previousSample < 0) {
        if (priorCrossing >= 0) {
          // Positive crossings count complete periods, not both half cycles.
          const measured = sampleRate / Math.max(1, index - priorCrossing);
          crossingFrequency += (measured - crossingFrequency) * 0.72;
        }
        priorCrossing = index;
      }
      envelopes[index] = envelope;
      frequencies[index] = crossingFrequency;
      previousSample = sample;
    }

    // Sample one field's worth of recent audio along the raster. The frame
    // owns derived arrays, so live analyser buffers cannot alter a paused PNG.
    const fieldSamples = Math.min(count, Math.round(sampleRate / 60));
    const start = Math.max(0, count - fieldSamples);
    for (let row = 0; row < HEIGHT; row++) {
      const index = Math.min(count - 1, start + Math.floor(row / HEIGHT * fieldSamples));
      const ripple = count && average > 0.000001 ? clamp(envelopes[index] / average, 0, 2.8) : 1;
      thresholds[row] = level < 0.00001 ? 0 : clamp(level * gain * 2.15 * ripple, 0, 2.1);
      colors[row] = colorIndex(count ? frequencies[index] : frequency, color);
    }
    return Object.freeze({ level, thresholds: Object.freeze(thresholds), colors: Object.freeze(colors) });
  }

  function buildFrame(options = {}, elapsedMs = 0, signal = {}, seed = 1) {
    const elapsed = Math.max(0, numeric(elapsedMs, 0));
    const auto = options.atariShape === "auto";
    const autoRate = clamp(numeric(options.atariAutoRate, 2), 1, 8);
    const step = Math.floor(elapsed / (autoRate * 1000));
    const seedValue = hash(seed);
    let horizontal = numeric(options.atariHorizontal, 1);
    let vertical = numeric(options.atariVertical, 1);
    let shape = SHAPES.includes(options.atariShape) ? options.atariShape : "solid";
    if (auto) {
      horizontal = HORIZONTAL[Math.floor(randomAt(seedValue, step, 13) * HORIZONTAL.length)];
      vertical = VERTICAL[Math.floor(randomAt(seedValue, step, 71) * VERTICAL.length)];
      shape = SHAPES.includes(options.atariAutoShape)
        ? options.atariAutoShape
        : SHAPES[Math.floor(randomAt(seedValue, step, 137) * SHAPES.length)];
    }
    if (!HORIZONTAL.includes(horizontal)) horizontal = 1;
    if (!VERTICAL.includes(vertical)) vertical = 1;
    const color = clamp(numeric(options.atariColor, 65), 0, 100) / 100;
    const sampleRate = Math.max(8000, numeric(signal?.sampleRate, 48000));
    const channel = side => channelFrame(
      signal?.[side.toLowerCase()],
      clamp(numeric(options[`atariGain${side}`], 100), 0, 200) / 100,
      clamp(numeric(options[`atariContour${side}`], 65), 0, 100) / 100,
      color,
      sampleRate
    );
    return Object.freeze({
      width: WIDTH,
      height: HEIGHT,
      elapsedMs: elapsed,
      stretch: options.atariStretch === true || options.atariStretch === "true",
      horizontal,
      vertical,
      shape,
      left: channel("Left"),
      right: channel("Right"),
      palette: paletteFor(color)
    });
  }

  function rasterizeDifferenceRow(frame, y, rampY, pixels, pulseWidth) {
    // Resolve the two comparator edges before sampling them onto pixels. A
    // shared rounded horizontal ramp can erase a narrow XOR interval entirely
    // and drop whole scanlines from Hole/Ring. Fractional edges retain that
    // interval; the vertical ramp and the Solid raster keep their stepped look.
    const events = [];
    const cellWidth = WIDTH / frame.horizontal;
    for (const [channel, bit] of [[frame.left, 1], [frame.right, 2]]) {
      const extent = clamp(channel.thresholds[y] - rampY, 0, 1);
      if (!extent) continue;
      const inset = cellWidth * (1 - extent) / 2;
      for (let column = 0; column < frame.horizontal; column++) {
        events.push({ x: column * cellWidth + inset, bit });
        events.push({ x: (column + 1) * cellWidth - inset, bit });
      }
    }
    events.sort((a, b) => a.x - b.x);
    const coverage = new Float32Array(WIDTH * 3);
    const paint = (start, end, colorIndex) => {
      start = Math.max(0, start); end = Math.min(WIDTH, end);
      if (end <= start) return;
      const color = frame.palette[colorIndex];
      for (let x = Math.floor(start); x < Math.ceil(end); x++) {
        const amount = Math.min(x + 1, end) - Math.max(x, start);
        for (let component = 0; component < 3; component++) coverage[x * 3 + component] += color[component] * amount;
      }
    };
    let mask = 0, previousX = 0;
    let pulseStart = 0, pulseEnd = 0, pulseColor = 0;
    for (let index = 0; index < events.length;) {
      const x = events[index].x;
      const wasExclusive = mask === 1 || mask === 2;
      if (frame.shape === "hole" && wasExclusive) {
        paint(previousX, x, mask === 1 ? frame.left.colors[y] : frame.right.colors[y]);
      }
      let changed = 0;
      // Coincident channel edges must still cancel. Adjacent full-width tiles
      // also join here without introducing an artificial ring at their seam.
      while (index < events.length && Math.abs(events[index].x - x) < 1e-7) changed ^= events[index++].bit;
      mask ^= changed;
      const exclusive = mask === 1 || mask === 2;
      if (frame.shape === "ring" && exclusive !== wasExclusive) {
        paint(pulseStart, Math.min(x, pulseEnd), pulseColor);
        pulseStart = x;
        pulseEnd = x + pulseWidth;
        pulseColor = changed & 1 ? frame.left.colors[y] : frame.right.colors[y];
      }
      previousX = x;
    }
    if (frame.shape === "ring") paint(pulseStart, pulseEnd, pulseColor);
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 4;
      for (let component = 0; component < 3; component++) pixels[offset + component] = coverage[x * 3 + component];
      pixels[offset + 3] = 255;
    }
  }

  function rasterize(frame) {
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    const rampX = new Float32Array(WIDTH);
    for (let x = 0; x < WIDTH; x++) {
      rampX[x] = Math.round(Math.abs(fraction((x + 0.5) / WIDTH * frame.horizontal) * 2 - 1) * 15) / 15;
    }
    // Patent one-shots last seven of 228 horizontal clock periods. They fire
    // on both XOR transitions, so RING has fixed horizontal pulse thickness.
    const pulseWidth = Math.round(WIDTH * 7 / 228);
    for (let y = 0; y < HEIGHT; y++) {
      const rampY = Math.round(Math.abs(fraction((y + 0.5) / HEIGHT * frame.vertical) * 2 - 1) * 15) / 15;
      if (frame.shape === "hole" || frame.shape === "ring") {
        rasterizeDifferenceRow(frame, y, rampY, pixels, pulseWidth);
        continue;
      }
      const leftRadius = frame.left.thresholds[y];
      const rightRadius = frame.right.thresholds[y];
      for (let x = 0; x < WIDTH; x++) {
        const ramp = rampX[x] + rampY;
        const left = leftRadius > 0 && ramp < leftRadius;
        const right = rightRadius > 0 && ramp < rightRadius;
        // The last comparator to switch on owns an overlap: for concentric
        // diamonds this is the smaller shape, not an additive color blend.
        const selected = left && (!right || leftRadius <= rightRadius) ? frame.left.colors[y] : frame.right.colors[y];
        const offset = (y * WIDTH + x) * 4;
        if (left || right) {
          const color = frame.palette[selected];
          pixels[offset] = color[0];
          pixels[offset + 1] = color[1];
          pixels[offset + 2] = color[2];
        }
        pixels[offset + 3] = 255;
      }
    }
    return pixels;
  }

  function draw(context, frame, width, height) {
    if (!context || !frame || width <= 0 || height <= 0) return;
    if (!surface) {
      surface = typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(WIDTH, HEIGHT)
        : document.createElement("canvas");
      surface.width = WIDTH;
      surface.height = HEIGHT;
      surfaceContext = surface.getContext("2d");
    }
    const data = surfaceContext.createImageData(WIDTH, HEIGHT);
    data.data.set(rasterize(frame));
    surfaceContext.putImageData(data, 0, 0);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    // Stretch changes only the monitor presentation; the native comparator
    // raster and the default 4:3 rendering remain unchanged.
    const displayWidth = frame.stretch ? width : WIDTH * scale;
    const displayHeight = frame.stretch ? height : HEIGHT * scale;
    const left = (width - displayWidth) / 2;
    const top = (height - displayHeight) / 2;
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.shadowBlur = 0;
    context.filter = "none";
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.beginPath();
    context.rect(left, top, displayWidth, displayHeight);
    context.clip();
    context.imageSmoothingEnabled = false;
    context.drawImage(surface, left, top, displayWidth, displayHeight);
    context.globalCompositeOperation = "screen";
    context.globalAlpha = 0.2;
    context.filter = `blur(${Math.max(0.65, scale * 1.1)}px)`;
    context.drawImage(surface, left, top, displayWidth, displayHeight);
    context.filter = "none";
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    const glassInner = frame.stretch ? Math.min(displayWidth, displayHeight) * 0.24 : displayHeight * 0.24;
    const glassOuter = frame.stretch ? Math.hypot(displayWidth, displayHeight) * 0.55 : displayWidth * 0.66;
    const glass = context.createRadialGradient(
      width / 2, height / 2, glassInner,
      width / 2, height / 2, glassOuter
    );
    glass.addColorStop(0, "rgba(0,0,0,0)");
    glass.addColorStop(1, "rgba(0,0,0,0.24)");
    context.fillStyle = glass;
    context.fillRect(left, top, displayWidth, displayHeight);
    context.restore();
  }

  function demoSignal(elapsedMs = 0, bpm = 108, seed = 1) {
    const seconds = Math.max(0, numeric(elapsedMs, 0)) / 1000;
    const tempo = clamp(numeric(bpm, 108), 20, 400) / 60;
    const sampleRate = 48000;
    const seedValue = hash(seed);
    const notes = [0, 7, 3, 10, 5, 12, 7, 3];
    const makeChannel = side => {
      const samples = new Float32Array(2048);
      const phase = randomAt(seedValue, 0, side ? 211 : 53);
      let power = 0;
      let crossings = 0;
      for (let index = 0; index < samples.length; index++) {
        const time = seconds - (samples.length - 1 - index) / sampleRate;
        const beat = time * tempo;
        const beatIndex = Math.floor(beat + (side ? 0.5 : 0));
        const pulse = Math.exp(-fraction(beat + (side ? 0.5 : 0)) * (side ? 5.2 : 7.5));
        const note = notes[((beatIndex + Math.floor(phase * 8)) % notes.length + notes.length) % notes.length];
        const fundamental = (side ? 164.81 : 110) * Math.pow(2, note / 12);
        const modulation = 0.8 * Math.sin(TAU * time * tempo * (side ? 2 : 3) + phase * TAU);
        const carrier = Math.sin(TAU * time * fundamental + modulation);
        const overtone = Math.sin(TAU * time * fundamental * (side ? 3.01 : 2.003) + phase * TAU);
        const brightness = 0.3 + 0.18 * Math.sin(time * 3.1 + phase * TAU);
        const sample = (carrier * 0.72 + overtone * brightness) * (0.22 + pulse * 0.71);
        samples[index] = sample;
        power += sample * sample;
        if (index && sample >= 0 && samples[index - 1] < 0) crossings++;
      }
      return {
        level: clamp(Math.sqrt(power / samples.length) * 1.45, 0, 1),
        crossings: crossings * sampleRate / samples.length,
        samples
      };
    };
    // This is an inaudible test signal, not an AudioContext or sound source.
    return { left: makeChannel(0), right: makeChannel(1), sampleRate };
  }

  return Object.freeze({ buildFrame, draw, rasterize, demoSignal });
})();
