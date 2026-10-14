/* Procedural ASCII visualizer using NetHack's map dimensions, symbols, colors,
   door actions and movement rates. This is a bounded simulation, not the game. */
const NetHackVisualizer = (() => {
  "use strict";

  const defaults = Object.freeze({ nhLayout: "rooms", nhDepth: "8", nhPopulation: "55", nhSpeed: "1", nhFog: false,
    nhPalette: "dungeon", nhGlow: "35", nhDynamics: "70", nhView: "map", nhInput: "demo" });
  const WIDTH = 80;
  const HEIGHT = 21;
  const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const PASSAGES = new Set([".", "#", "+", "<", ">"]);
  const worlds = new Map();
  const fogCache = new WeakMap();
  const simulationCache = new WeakMap();
  const EMPTY = Object.freeze({ char: " ", role: "dungeon", shade: 0, color: "#000000" });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const mod = (value, size) => ((value % size) + size) % size;

  function hash(value) {
    let result = 2166136261;
    for (const letter of String(value ?? "dungeon")) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
    return result >>> 0;
  }
  function randomGenerator(seed) {
    return () => {
      let value = seed += 0x6d2b79f5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function normalized(options = {}) {
    const choice = (key, values) => values.includes(options[key]) ? options[key] : defaults[key];
    return Object.freeze({
      nhLayout: choice("nhLayout", ["rooms", "maze", "cavern"]),
      nhDepth: Math.round(clamp(finite(options.nhDepth, 8), 1, 30)),
      nhPopulation: Math.round(clamp(finite(options.nhPopulation, 55), 0, 100)),
      nhSpeed: clamp(finite(options.nhSpeed, 1), 0.25, 4),
      nhFog: options.nhFog === true || options.nhFog === "true",
      nhPalette: choice("nhPalette", ["dungeon", "phosphor", "amber", "ice"]),
      nhGlow: clamp(finite(options.nhGlow, 35), 0, 100),
      nhDynamics: clamp(finite(options.nhDynamics, 70), 0, 100),
      nhView: choice("nhView", ["map", "follow"]),
      nhInput: choice("nhInput", ["demo", "audio"]),
      bpm: clamp(finite(options.bpm, 128), 20, 360)
    });
  }
  const point = index => Object.freeze({ x: index % WIDTH, y: Math.floor(index / WIDTH) });

  function generateWorld(options = {}, seed = 1) {
    const settings = normalized(options);
    const key = `${hash(seed)}|${settings.nhLayout}|${settings.nhDepth}`;
    if (worlds.has(key)) {
      const existing = worlds.get(key);
      worlds.delete(key); worlds.set(key, existing);
      return existing;
    }
    const random = randomGenerator(hash(key));
    const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
    const tiles = Array(WIDTH * HEIGHT).fill(" ");
    const rooms = [];
    const set = (x, y, char) => { if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) tiles[y * WIDTH + x] = char; };
    const carveRoom = room => {
      rooms.push(Object.freeze(room));
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) set(x, y, ".");
      }
    };
    const connect = (first, second) => {
      let x = first.x, y = first.y;
      const horizontalFirst = random() > 0.5;
      while (x !== second.x || y !== second.y) {
        if (tiles[y * WIDTH + x] === " ") set(x, y, "#");
        if ((horizontalFirst && x !== second.x) || y === second.y) x += Math.sign(second.x - x);
        else y += Math.sign(second.y - y);
      }
      if (tiles[y * WIDTH + x] === " ") set(x, y, "#");
    };

    if (settings.nhLayout === "rooms") {
      const target = 8 + Math.floor(settings.nhDepth / 6);
      for (let attempt = 0; attempt < 240 && rooms.length < target; attempt++) {
        const room = { x: integer(2, WIDTH - 14), y: integer(2, HEIGHT - 7), width: integer(5, 12), height: integer(3, 5), lit: rooms.length === 0 || random() > settings.nhDepth / 45 };
        if (rooms.some(other => room.x - 2 < other.x + other.width && room.x + room.width + 2 > other.x
          && room.y - 2 < other.y + other.height && room.y + room.height + 2 > other.y)) continue;
        carveRoom(room);
      }
      const centers = rooms.map(room => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) }));
      for (let index = 1; index < centers.length; index++) connect(centers[index - 1], centers[index]);
      for (let index = 0; index < 3 && centers.length > 2; index++) connect(centers[integer(0, centers.length - 1)], centers[integer(0, centers.length - 1)]);
      for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
        const index = y * WIDTH + x;
        if (tiles[index] !== "#") continue;
        if ((tiles[index - 1] === "." && tiles[index + 1] === "#") || (tiles[index + 1] === "." && tiles[index - 1] === "#")
          || (tiles[index - WIDTH] === "." && tiles[index + WIDTH] === "#") || (tiles[index + WIDTH] === "." && tiles[index - WIDTH] === "#")) tiles[index] = "+";
      }
    } else if (settings.nhLayout === "maze") {
      const stack = [{ x: 1, y: 1 }];
      set(1, 1, "#");
      while (stack.length) {
        const current = stack[stack.length - 1];
        const neighbors = DIRECTIONS.map(([dx, dy]) => ({ x: current.x + dx * 2, y: current.y + dy * 2, dx, dy }))
          .filter(next => next.x > 0 && next.y > 0 && next.x < WIDTH - 1 && next.y < HEIGHT - 1 && tiles[next.y * WIDTH + next.x] === " ");
        if (!neighbors.length) { stack.pop(); continue; }
        const next = neighbors[integer(0, neighbors.length - 1)];
        set(current.x + next.dx, current.y + next.dy, "#"); set(next.x, next.y, "#"); stack.push(next);
      }
      for (let index = 0; index < 4; index++) carveRoom({ x: integer(2, Math.floor((WIDTH - 7) / 2)) * 2 - 1, y: integer(2, Math.floor((HEIGHT - 5) / 2)) * 2 - 1, width: 5, height: 3, lit: random() > 0.35 });
    } else {
      let x = Math.floor(WIDTH / 2), y = Math.floor(HEIGHT / 2);
      for (let step = 0; step < 520 + settings.nhDepth * 12; step++) {
        const radius = random() > 0.82 ? 2 : 1;
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius + 1) set(x + dx, y + dy, ".");
        }
        const [dx, dy] = DIRECTIONS[integer(0, 3)];
        x = clamp(x + dx, 3, WIDTH - 4); y = clamp(y + dy, 3, HEIGHT - 4);
      }
    }

    const floors = tiles.slice();
    for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
      const index = y * WIDTH + x;
      if (floors[index] !== " ") continue;
      const boundary = settings.nhLayout === "maze" ? "#" : ".";
      if (floors[index - WIDTH] === boundary || floors[index + WIDTH] === boundary) tiles[index] = "-";
      else if (floors[index - 1] === boundary || floors[index + 1] === boundary) tiles[index] = "|";
      else if ([index - WIDTH - 1, index - WIDTH + 1, index + WIDTH - 1, index + WIDTH + 1].some(next => floors[next] === boundary)) tiles[index] = "-";
    }
    const walkable = [];
    for (let index = 0; index < tiles.length; index++) if (PASSAGES.has(tiles[index])) walkable.push(index);
    const origin = rooms.length ? (rooms[0].y + Math.floor(rooms[0].height / 2)) * WIDTH + rooms[0].x + Math.floor(rooms[0].width / 2) : walkable[0];
    const neighborsOf = index => DIRECTIONS.map(([dx, dy]) => index + dy * WIDTH + dx)
      .filter(next => next >= 0 && next < tiles.length && Math.abs(next % WIDTH - index % WIDTH) <= 1 && PASSAGES.has(tiles[next]));
    const distances = new Int32Array(tiles.length).fill(-1);
    const queue = [origin]; distances[origin] = 0;
    let farthest = origin;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      for (const next of neighborsOf(current)) if (distances[next] < 0) {
        distances[next] = distances[current] + 1; queue.push(next);
        if (distances[next] > distances[farthest]) farthest = next;
      }
    }
    tiles[origin] = "<"; tiles[farthest] = ">";
    const route = [origin];
    const visited = new Set([origin]);
    const traversal = [{ index: origin, neighbors: neighborsOf(origin), cursor: 0 }];
    while (traversal.length) {
      const current = traversal[traversal.length - 1];
      if (current.cursor >= current.neighbors.length) {
        traversal.pop();
        if (traversal.length) route.push(traversal[traversal.length - 1].index);
        continue;
      }
      const next = current.neighbors[current.cursor++];
      if (visited.has(next)) continue;
      visited.add(next); route.push(next); traversal.push({ index: next, neighbors: neighborsOf(next), cursor: 0 });
    }
    if (route.length > 1 && route[route.length - 1] === route[0]) route.pop();
    // The route describes potential connectivity; a closed door is not yet a
    // walkable cell. Opening it consumes a turn before the hero can enter it.
    const doors = new Map();
    for (const index of walkable) if (tiles[index] === "+") doors.set(index, {
      index, openGlyph: PASSAGES.has(tiles[index - 1]) && PASSAGES.has(tiles[index + 1]) ? "-" : "|", openTurn: Infinity
    });
    const heroPath = [origin];
    for (let step = 1; step <= route.length; step++) {
      const next = route[step % route.length], door = doors.get(next);
      if (door && door.openTurn === Infinity) {
        door.openTurn = heroPath.length;
        heroPath.push(heroPath[heroPath.length - 1]);
      }
      heroPath.push(next);
    }
    const lit = new Set();
    for (const room of rooms) if (room.lit) {
      for (let y = room.y - 1; y <= room.y + room.height; y++) for (let x = room.x - 1; x <= room.x + room.width; x++) lit.add(y * WIDTH + x);
    }
    const spots = walkable.filter(index => index !== origin && index !== farthest && !doors.has(index));
    for (let index = spots.length - 1; index > 0; index--) {
      const other = integer(0, index); [spots[index], spots[other]] = [spots[other], spots[index]];
    }
    const itemKinds = [["$", "gold", "#ffff55"], ["!", "potion", "#ff5555"], ["?", "scroll", "#ffffff"], ["*", "gem", "#ffffff"], [")", "weapon", "#00aaaa"], ["[", "armor", "#00aaaa"], ["%", "food", "#aa5500"]];
    const loot = spots.slice(0, 36).map((index, order) => {
      const [char, kind, baseColor] = itemKinds[order % itemKinds.length];
      const color = kind === "potion" || kind === "gem" ? ["#ff5555", "#ff55ff", "#00aaaa", "#ffffff"][integer(0, 3)] : baseColor;
      return Object.freeze({ ...point(index), char, kind, color });
    });
    const actorSpots = route.map((index, offset) => doors.has(index) ? -1 : offset).filter(offset => offset >= 0);
    const world = Object.freeze({ width: WIDTH, height: HEIGHT, seed: hash(key), layout: settings.nhLayout, depth: settings.nhDepth,
      tiles: Object.freeze(Array.from({ length: HEIGHT }, (_, row) => tiles.slice(row * WIDTH, (row + 1) * WIDTH).join(""))),
      rooms: Object.freeze(rooms), passages: Object.freeze(walkable), walkable: Object.freeze(walkable.filter(index => !doors.has(index))), route: Object.freeze(route),
      doors: Object.freeze(Array.from(doors.values(), door => Object.freeze(door))), heroPath: Object.freeze(heroPath), lit: Object.freeze(Array.from(lit)),
      up: point(origin), down: point(farthest), loot: Object.freeze(loot),
      actorOffsets: Object.freeze(Array.from({ length: 28 }, () => actorSpots[integer(0, actorSpots.length - 1)])) });
    worlds.set(key, world);
    while (worlds.size > 4) worlds.delete(worlds.keys().next().value);
    return world;
  }

  const SPECIES = Object.freeze([
    { char: "o", kind: "goblin", speed: 6, color: "#aaaaaa" },
    { char: "k", kind: "kobold", speed: 6, color: "#aa5500" },
    { char: "G", kind: "gnome", speed: 6, color: "#aa5500" },
    { char: "s", kind: "cave spider", speed: 12, color: "#aaaaaa" },
    { char: "r", kind: "sewer rat", speed: 12, color: "#aa5500" },
    { char: "h", kind: "hobbit", speed: 9, color: "#00aa00" },
    { char: "Z", kind: "human zombie", speed: 6, color: "#ffffff" },
    { char: "T", kind: "troll", speed: 12, color: "#aa5500" },
    { char: "D", kind: "red dragon", speed: 9, color: "#aa0000" }
  ].map(Object.freeze));
  function heroIndex(world, turn) {
    const intro = world.heroPath.length - 1;
    return turn <= intro ? world.heroPath[turn] : world.route[(turn - intro) % world.route.length];
  }
  function simulation(world) {
    if (simulationCache.has(world)) return simulationCache.get(world);
    const data = { passages: new Set(world.passages), doors: new Map(world.doors.map(door => [door.index, door])),
      lit: new Set(world.lit), pet: [world.heroPath[0]], petCycles: new Map(), petCycle: null, monsters: new Map(), visibility: new Map() };
    simulationCache.set(world, data);
    return data;
  }
  function passable(world, index, turn) {
    const data = simulation(world), door = data.doors.get(index);
    return data.passages.has(index) && (!door || turn >= door.openTurn);
  }
  function neighbors(world, index, turn) {
    return DIRECTIONS.map(([dx, dy]) => index + dy * WIDTH + dx).filter(next =>
      next >= 0 && next < WIDTH * HEIGHT && Math.abs(next % WIDTH - index % WIDTH) <= 1 && passable(world, next, turn));
  }
  function nextToward(world, start, target, turn) {
    if (start === target) return start;
    const visited = new Set([start]), queue = [{ index: start, first: start }];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      for (const next of neighbors(world, current.index, turn)) {
        if (visited.has(next)) continue;
        const first = head === 0 ? next : current.first;
        if (next === target) return first;
        visited.add(next); queue.push({ index: next, first });
      }
    }
    return start;
  }
  function petIndex(world, turn) {
    const data = simulation(world), intro = world.heroPath.length - 1;
    while (data.pet.length <= turn && !data.petCycle) {
      const step = data.pet.length, hero = heroIndex(world, step);
      let pet = data.pet[step - 1];
      const actions = Math.floor(step * 18 / 12) - Math.floor((step - 1) * 18 / 12);
      for (let action = 0; action < actions; action++) {
        const distance = (pet % WIDTH - hero % WIDTH) ** 2 + (Math.floor(pet / WIDTH) - Math.floor(hero / WIDTH)) ** 2;
        const terrain = world.tiles[Math.floor(hero / WIDTH)][hero % WIDTH];
        if (distance < 9 && !(distance > 1 && "#<>+".includes(terrain))) break;
        pet = nextToward(world, pet, hero, step);
      }
      data.pet.push(pet);
      // Once the door-opening tour ends, the world and hero route repeat. The
      // dog follows/loiters rather than occupying a fixed trailing route slot.
      if (step >= intro && (step - intro) % world.route.length === 0) {
        const key = `${pet}|${step % 2}`;
        if (data.petCycles.has(key)) data.petCycle = { start: data.petCycles.get(key), length: step - data.petCycles.get(key) };
        else data.petCycles.set(key, step);
      }
    }
    const resolved = data.petCycle && turn >= data.petCycle.start ? data.petCycle.start + (turn - data.petCycle.start) % data.petCycle.length : turn;
    return data.pet[resolved];
  }
  function monsterIndex(world, actor, speed, turn) {
    const data = simulation(world), intro = world.heroPath.length - 1;
    let path = data.monsters.get(actor);
    if (!path) { path = [world.actorOffsets[actor]]; data.monsters.set(actor, path); }
    const phase = (actor % 4) / 4;
    const budget = step => Math.floor(step * speed / 12 + phase);
    const needed = Math.min(turn, intro);
    while (path.length <= needed) {
      const step = path.length;
      let offset = path[step - 1];
      for (let action = 0; action < budget(step) - budget(step - 1); action++) {
        const next = (offset + 1) % world.route.length;
        if (passable(world, world.route[next], step)) offset = next;
      }
      path.push(offset);
    }
    const offset = turn <= intro ? path[turn] : (path[intro] + budget(turn) - budget(intro)) % world.route.length;
    return world.route[offset];
  }
  function visibleFrom(world, origin, turn) {
    const data = simulation(world);
    const doorPhase = world.doors.filter(door => door.openTurn <= turn).length;
    const key = `${origin}|${doorPhase}`;
    if (data.visibility.has(key)) return data.visibility.get(key);
    const result = [], ox = origin % WIDTH, oy = Math.floor(origin / WIDTH);
    for (let y = Math.max(0, oy - 16); y <= Math.min(HEIGHT - 1, oy + 16); y++) {
      for (let x = Math.max(0, ox - 16); x <= Math.min(WIDTH - 1, ox + 16); x++) {
        const index = y * WIDTH + x;
        // Unlit corridors and rooms are visible only in the adjacent squares.
        if (Math.max(Math.abs(x - ox), Math.abs(y - oy)) > 1 && !data.lit.has(index)) continue;
        let sx = ox, sy = oy;
        const dx = Math.abs(x - sx), dy = -Math.abs(y - sy);
        const stepX = sx < x ? 1 : -1, stepY = sy < y ? 1 : -1;
        let error = dx + dy, clear = true;
        while (sx !== x || sy !== y) {
          const twice = error * 2;
          if (twice >= dy) { error += dy; sx += stepX; }
          if (twice <= dx) { error += dx; sy += stepY; }
          if ((sx !== x || sy !== y) && !passable(world, sy * WIDTH + sx, turn)) { clear = false; break; }
        }
        if (clear) result.push(index);
      }
    }
    const frozen = Object.freeze(result);
    data.visibility.set(key, frozen);
    return frozen;
  }
  function exploration(world, turn) {
    let data = fogCache.get(world);
    if (!data) { data = { firstSeen: new Int32Array(WIDTH * HEIGHT).fill(-1), through: -1 }; fogCache.set(world, data); }
    const needed = Math.min(turn, world.heroPath.length - 1 + world.route.length);
    while (data.through < needed) {
      const step = ++data.through;
      for (const index of visibleFrom(world, heroIndex(world, step), step)) if (data.firstSeen[index] < 0) data.firstSeen[index] = step;
    }
    return Array.from(data.firstSeen, (seen, index) => seen >= 0 && seen <= turn ? index : -1).filter(index => index >= 0);
  }
  function audioSignal(input, turn, demo) {
    if (demo) {
      const beat = turn % 8;
      return Object.freeze({ level: beat % 2 ? 0.45 : 0.85, bass: beat % 4 === 0 ? 1 : 0.18, mid: beat % 2 ? 0.9 : 0.3,
        treble: beat % 4 === 2 ? 1 : 0.2, transient: beat % 2 ? 0 : 0.9, pan: Math.sin(turn * 0.7) * 0.6 });
    }
    const source = typeof input === "number" ? { level: input, bass: input, mid: input, treble: input, transient: input } : input || {};
    const result = {};
    const fallback = clamp(finite(source.level, 0), 0, 1);
    for (const key of ["level", "bass", "mid", "treble", "transient"]) result[key] = clamp(finite(source[key], fallback), 0, 1);
    result.pan = clamp(finite(source.pan, 0), -1, 1);
    return Object.freeze(result);
  }
  function buildFrame(options = {}, elapsedMs = 0, seed = 1, input = 0) {
    const settings = normalized(options), elapsed = clamp(finite(elapsedMs, 0), 0, 1e12);
    const progress = elapsed / 60000 * settings.bpm * settings.nhSpeed, turn = Math.floor(progress);
    const world = generateWorld(settings, seed);
    const actor = (here, next) => Object.freeze({ ...point(here), nextX: next % WIDTH, nextY: Math.floor(next / WIDTH) });
    const hero = actor(heroIndex(world, turn), heroIndex(world, turn + 1));
    const pet = Object.freeze({ ...actor(petIndex(world, turn), petIndex(world, turn + 1)), char: "d", kind: "little dog", speed: 18, color: "#ffffff" });
    const species = settings.nhDepth > 15 ? SPECIES : SPECIES.slice(0, 7);
    const monsters = Object.freeze(world.actorOffsets.slice(0, Math.round(settings.nhPopulation / 100 * 28)).map((offset, index) => {
      const kind = species[index % species.length];
      return Object.freeze({ ...actor(monsterIndex(world, index, kind.speed, turn), monsterIndex(world, index, kind.speed, turn + 1)), ...kind });
    }));
    const items = Object.freeze(world.loot.slice(0, Math.round(world.loot.length * settings.nhPopulation / 100)));
    const openDoors = Object.freeze(world.doors.filter(door => door.openTurn <= turn).map(door => door.index));
    const visible = settings.nhFog ? visibleFrom(world, hero.y * WIDTH + hero.x, turn) : Object.freeze(Array.from({ length: WIDTH * HEIGHT }, (_, index) => index));
    const explored = settings.nhFog ? Object.freeze(exploration(world, turn)) : visible;
    const audio = audioSignal(input, turn, settings.nhInput === "demo");
    return Object.freeze({ elapsedMs: elapsed, turn, phase: progress % 1, options: settings, world, hero, pet, monsters, items,
      openDoors, action: turn > 0 && heroIndex(world, turn) === heroIndex(world, turn - 1) ? "open" : "move", audio, pulse: audio.level, visible, explored });
  }
  function colors(frame) {
    const options = frame.options;
    const palettes = {
      dungeon: { background: "#000000", hero: "#ffffff", pet: "#ffffff", enemy: "#aaaaaa", loot: "#ffff55", text: "#aaaaaa", door: "#aa5500" },
      phosphor: { background: "#040d0a", stone: "#0c271f", wall: "#235e42", floor: "#123327", path: "#102b22", light: "#98f7ac", hero: "#d8ffe0", pet: "#b8e990", enemy: "#66c99b", loot: "#d3f59d", text: "#87da9c" },
      amber: { background: "#140e07", stone: "#302517", wall: "#695234", floor: "#362a1a", path: "#2d2318", light: "#ffc676", hero: "#fff1bb", pet: "#e3a869", enemy: "#bb8655", loot: "#ffd77a", text: "#e7b56a" },
      ice: { background: "#070e1d", stone: "#192b43", wall: "#3e6481", floor: "#1c3045", path: "#192a3e", light: "#92dfff", hero: "#e0faff", pet: "#98c9ed", enemy: "#a7a1df", loot: "#b8efff", text: "#90c9e5" }
    };
    return palettes[options.nhPalette];
  }
  function tinted(hex, brightness, accent = 0) {
    const value = Number.parseInt(hex.slice(1), 16);
    const channel = shift => Math.round(clamp((((value >> shift) & 255) * (1 - accent) + 255 * accent) * brightness, 0, 255));
    return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
  }

  function toGrid(frame, cols, rows) {
    const width = Math.round(clamp(finite(cols, 80), 1, 400));
    const height = Math.round(clamp(finite(rows, 25), 1, 180));
    const grid = Array.from({ length: height }, () => Array(width).fill(EMPTY));
    const status = height >= 8 && width >= 18 ? 1 : 0;
    const availableHeight = height - status;
    const viewWidth = Math.min(WIDTH, width), viewHeight = Math.min(HEIGHT, availableHeight);
    const follow = frame.options.nhView === "follow";
    const startX = Math.round(clamp((follow ? frame.hero.x : WIDTH / 2) - viewWidth / 2, 0, WIDTH - viewWidth));
    const startY = Math.round(clamp((follow ? frame.hero.y : HEIGHT / 2) - viewHeight / 2, 0, HEIGHT - viewHeight));
    const left = Math.floor((width - viewWidth) / 2), top = Math.floor((availableHeight - viewHeight) / 2);
    const palette = colors(frame);
    const visible = new Set(frame.visible), explored = new Set(frame.explored);
    const openDoors = new Set(frame.openDoors), doorMap = simulation(frame.world).doors;
    const dynamics = frame.options.nhDynamics / 100, audio = frame.audio;
    const cell = (char, color, brightness = 1, category = "terrain", wx = WIDTH / 2) => {
      const band = category === "monster" ? audio.mid : category === "item" ? audio.treble : category === "hero" ? Math.max(audio.transient, audio.level) : audio.bass;
      const stereo = 1 + audio.pan * (wx / (WIDTH - 1) * 2 - 1) * 0.45;
      const energy = clamp((band * 0.8 + audio.level * 0.2) * stereo, 0, 1);
      const shade = brightness * (1 - dynamics * 0.7 + dynamics * energy * 1.35);
      return Object.freeze({ char, role: "dungeon", shade, color: tinted(color, shade, dynamics * energy * 0.16), glow: category !== "terrain" });
    };
    for (let y = 0; y < viewHeight; y++) for (let x = 0; x < viewWidth; x++) {
      const wx = startX + x, wy = startY + y, index = wy * WIDTH + wx;
      if (!explored.has(index)) continue;
      const door = doorMap.get(index);
      const char = door && openDoors.has(index) ? door.openGlyph : frame.world.tiles[wy][wx];
      if (char === " ") continue;
      const color = door ? (palette.door || palette.pet) : palette.text;
      grid[top + y][left + x] = cell(char, color, visible.has(index) ? 0.85 : 0.28, "terrain", wx);
    }
    const stamp = (actor, char, color, category, always = false) => {
      const x = actor.x - startX + left, y = actor.y - startY + top;
      if (x < 0 || y < 0 || x >= width || y >= availableHeight || (!always && !visible.has(actor.y * WIDTH + actor.x))) return;
      grid[y][x] = cell(char, color, 1, category, actor.x);
    };
    const canonical = frame.options.nhPalette === "dungeon";
    frame.items.forEach(item => stamp(item, item.char, canonical ? item.color : palette.loot, "item"));
    frame.monsters.forEach(monster => stamp(monster, monster.char, canonical ? monster.color : palette.enemy, "monster"));
    stamp(frame.pet, "d", palette.pet, "monster");
    stamp(frame.hero, "@", palette.hero, "hero", true);
    if (status) {
      const line = `Dlvl:${frame.options.nhDepth}  T:${frame.turn}  ${frame.options.nhLayout.toUpperCase()}  ${Math.round(frame.options.bpm)} BPM`;
      for (let x = 0; x < Math.min(width, line.length); x++) grid[height - 1][x] = cell(line[x], palette.text, 0.8);
    }
    return grid;
  }

  function draw(context, frame, width, height) {
    if (!context || !frame || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const palette = colors(frame);
    // A terminal display. Camera and actors move only when the
    // BPM-derived turn advances; there is no interpolation between cells.
    const map = frame.options.nhView === "map";
    const fontSize = Math.max(0.1, Math.min(width / ((map ? WIDTH + 1 : 30) * 0.62), height / (map ? HEIGHT + 1 : 22)));
    const charWidth = fontSize * 0.62;
    const cols = Math.max(1, Math.floor(width / charWidth));
    const rows = Math.max(1, Math.floor(height / fontSize));
    const grid = toGrid(frame, cols, rows);
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
    context.shadowBlur = 0;
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    context.beginPath(); context.rect(0, 0, width, height); context.clip();
    context.font = `${fontSize}px "Cascadia Mono", Consolas, "Courier New", monospace`;
    context.textBaseline = "top";
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      if (cell.char === " ") continue;
      context.fillStyle = cell.color;
      context.shadowColor = cell.color;
      context.shadowBlur = cell.glow ? fontSize * frame.options.nhGlow / 100 * Math.min(1.4, cell.shade) : 0;
      context.fillText(cell.char, x * charWidth, y * fontSize);
    }
    context.restore();
  }
  return Object.freeze({ defaults, generateWorld, buildFrame, toGrid, draw });
})();
