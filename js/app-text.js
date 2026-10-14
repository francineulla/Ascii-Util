"use strict";

// ASCII grid textures, masks, lettering, colors, and word motion.

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
  const words = state.activeWords.length ? state.activeWords : state.words;
  if (!words.length) return;

  for (let i = 0; i < count; i += 1) {
    const word = tokenText(pick(words, random));
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
    return `hsl(${palette.bgHue} ${Math.min(18, palette.bgSat)}% ${18 + Math.round(cell.shade * 24)}%)`;
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

