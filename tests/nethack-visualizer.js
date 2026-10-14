(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const canvasFor = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    return canvas;
  };
  const pixelsOf = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  const equalPixels = (first, second) => first.length === second.length && first.every((value, index) => value === second[index]);
  const litPixels = pixels => {
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 12) count++;
    return count;
  };
  const pngCanvas = async url => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  };
  const pictureOf = frame => {
    const canvas = canvasFor(480, 270);
    NetHackVisualizer.draw(canvas.getContext("2d"), frame, canvas.width, canvas.height);
    return pixelsOf(canvas);
  };
  const cellValue = control => control.type === "checkbox" ? control.checked : control.value;
  const gridText = grid => grid.map(row => row.map(cell => cell.char).join("")).join("\n");

  try {
    clearTimeout(state.previewTimer); stopPreviewLoop();
    if (sessionStorage.getItem("nethackReload")) {
      assert(controls.visualizerMode.value === "nethack" && el("toolMode").value === "video", "saved NetHack native scene restores the correct tool");
      assert(controls.nhLayout.value === "cavern" && controls.nhDepth.value === "12" && controls.nhPalette.value === "ice", "NetHack appearance controls survive reload");
      assert(controls.nhFog.checked && controls.nhInput.value === "audio", "fog and input selection survive reload");
      assert(!audioState.stream, "restoring an audio-driven scene never requests a device automatically");
      assert(controls.nhDynamics.value === "83", "audio dynamics strength survives reload");
      document.body.innerHTML = "<p>PASS: NetHack source dimensions/glyphs/doors/speeds, deterministic beat motion, pet following, fog, audio bands, synth-only migration, previews/PNG, paused scenes, and reload</p>";
      return;
    }
    assert(typeof NetHackVisualizer === "object", "NetHack engine loads before application startup");
    const defaults = NetHackVisualizer.defaults;
    const fields = Object.keys(defaults);
    for (const id of fields) {
      const control = controls[id];
      assert(control && control === el(id), `${id} is a real connected control`);
      if (control.type === "number" || control.type === "range") {
        assert(Number(normalizePreset({ [id]: -1000 })[id]) === Number(control.min) && Number(normalizePreset({ [id]: 1000 })[id]) === Number(control.max), `${id} bounds imported values`);
      }
      if (control.tagName === "SELECT") assert(!(id in normalizePreset({ [id]: "unsupported" })), `${id} rejects invalid choices`);
    }
    assert(normalizePreset({ nhFog: "false" }).nhFog === false && normalizePreset({ nhFog: "true" }).nhFog === true, "fog imports as a boolean");
    const options = { ...defaults, bpm: 120, nhSpeed: 1, nhFog: false, nhGlow: 0, nhPopulation: 60, nhDepth: 4 };
    const build = (extra = {}, elapsed = 0, seed = "dungeon-seed", audio = 0) => NetHackVisualizer.buildFrame({ ...options, ...extra }, elapsed, seed, audio);
    const terrain = world => world.tiles.join("\n");
    const layouts = [];
    for (const layout of ["rooms", "maze", "cavern"]) {
      const frame = build({ nhLayout: layout });
      const world = frame.world;
      assert(world.width === 80 && world.height === 21 && world.tiles.length === 21 && world.tiles.every(row => row.length === 80), `${layout} uses NetHack's canonical 80 by 21 map`);
      const walkable = new Set(world.passages);
      assert(walkable.size === world.passages.length && walkable.size > 30 && walkable.size < world.width * world.height, `${layout} has distinct floor and wall regions`);
      for (const cell of walkable) {
        assert(Number.isInteger(cell) && cell >= 0 && cell < world.width * world.height && ".#+<>".includes(world.tiles[Math.floor(cell / world.width)][cell % world.width]), `${layout} traversable cells use dungeon floor symbols`);
      }
      const visited = new Set([world.passages[0]]), queue = [world.passages[0]];
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index], x = cell % world.width, y = Math.floor(cell / world.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
          const neighbor = ny * world.width + nx;
          if (walkable.has(neighbor) && !visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      assert(visited.size === walkable.size, `${layout} has no unreachable floor islands`);
      assert(world.route.length > 1 && world.route.every((cell, index) => {
        const next = world.route[(index + 1) % world.route.length];
        return walkable.has(cell) && Math.abs(cell % world.width - next % world.width) + Math.abs(Math.floor(cell / world.width) - Math.floor(next / world.width)) === 1;
      }), `${layout} animation follows legal neighboring cells, including its loop boundary`);
      for (const entity of [world.up, world.down, frame.hero, frame.pet, ...frame.monsters]) assert(new Set(world.walkable).has(entity.y * world.width + entity.x), `${layout} places stairs and characters on initially open cells`);
      assert(terrain(world) === terrain(build({ nhLayout: layout }).world), `${layout} is deterministic for a seed`);
      assert(terrain(world) !== terrain(build({ nhLayout: layout }, 0, "different-seed").world), `${layout} responds to the seed`);
      layouts.push(terrain(world));
    }
    assert(new Set(layouts).size === 3, "rooms, maze, and cavern create distinct environments");
    const initial = build({ nhLayout: "rooms" });
    assert(terrain(initial.world) !== terrain(build({ nhLayout: "rooms", nhDepth: 12 }).world), "changing dungeon depth generates another level");
    for (let turn = 1; turn <= 12; turn++) {
      const previous = build({}, (turn - 1) * 500), next = build({}, turn * 500);
      const distance = Math.abs(previous.hero.x - next.hero.x) + Math.abs(previous.hero.y - next.hero.y);
      assert(next.turn === turn && (distance === 1 || (distance === 0 && next.action === "open")), "one beat advances a legal move or door-opening action");
      assert(terrain(previous.world) === terrain(next.world), "animation preserves dungeon terrain between turns");
    }
    assert(build({ nhSpeed: 2 }, 1000).turn === 4 && build({ bpm: 60 }, 1000).turn === 1, "tempo and turns-per-beat control movement speed");
    const withinTurnA = build({ bpm: 120, nhSpeed: 1 }, 120), withinTurnB = build({ bpm: 120, nhSpeed: 1 }, 220);
    assert(withinTurnA.hero.x === withinTurnB.hero.x && withinTurnA.hero.y === withinTurnB.hero.y && terrain(withinTurnA.world) === terrain(withinTurnB.world), "adventurer and terrain remain fixed between beat-driven turns");
    assert(equalPixels(pictureOf(withinTurnA), pictureOf(withinTurnB)), "ASCII dungeon drawing stays pixel-identical within a turn");
    assert(!equalPixels(pictureOf(withinTurnB), pictureOf(build({ bpm: 120, nhSpeed: 1 }, 520))), "ASCII dungeon visibly advances on the next beat-driven turn");
    assert(build({}, -1000).turn === 0, "negative preview timestamps cannot create negative turns");
    const door = initial.world.doors[0];
    assert(door && Object.isFrozen(door) && !initial.world.walkable.includes(door.index), "closed doors are frozen metadata and initially block walking");
    const beforeDoor = build({ nhPopulation: 0 }, (door.openTurn - 1) * 500);
    const openingDoor = build({ nhPopulation: 0 }, door.openTurn * 500);
    const enteringDoor = build({ nhPopulation: 0 }, (door.openTurn + 1) * 500);
    assert(beforeDoor.hero.x === openingDoor.hero.x && beforeDoor.hero.y === openingDoor.hero.y && openingDoor.action === "open", "opening a closed door consumes a whole turn without movement");
    assert(!beforeDoor.openDoors.includes(door.index) && openingDoor.openDoors.includes(door.index) && enteringDoor.hero.y * 80 + enteringDoor.hero.x === door.index, "the hero enters only on the turn after opening");
    const doorGrid = NetHackVisualizer.toGrid(openingDoor, 80, 22);
    assert(doorGrid[Math.floor(door.index / 80)][door.index % 80].char === door.openGlyph && "-|".includes(door.openGlyph), "opened doors use NetHack's orientation-specific glyphs");
    const sightDoor = initial.world.doors.find(candidate => {
      const previous = initial.world.heroPath[candidate.openTurn - 1];
      const beyond = candidate.index + candidate.index - previous;
      return initial.world.lit.includes(beyond) && initial.world.passages.includes(beyond);
    });
    assert(sightDoor, "room dungeon includes a door into a lit area for visibility checks");
    const beyondDoor = sightDoor.index * 2 - initial.world.heroPath[sightDoor.openTurn - 1];
    assert(!build({ nhFog: true }, (sightDoor.openTurn - 1) * 500).visible.includes(beyondDoor)
      && build({ nhFog: true }, sightDoor.openTurn * 500).visible.includes(beyondDoor), "a closed door blocks sight into a lit room until it opens");
    const fullPopulation = build({ nhPopulation: 100, nhDepth: 20 });
    assert(fullPopulation.monsters.some(monster => monster.kind === "gnome" && monster.char === "G" && monster.color === "#aa5500"), "gnomes use uppercase G and their canonical brown color");
    assert(new Set(fullPopulation.monsters.map(monster => monster.speed)).size === 3 && fullPopulation.pet.speed === 18 && fullPopulation.pet.color === "#ffffff", "species retain 6/9/12 movement rates and the white little dog's rate of 18");
    const startTurn = fullPopulation.world.heroPath.length + 20;
    const movements = Array(fullPopulation.monsters.length).fill(0);
    let previousActors = build({ nhPopulation: 100, nhDepth: 20 }, startTurn * 500);
    for (let step = 1; step <= 12; step++) {
      const next = build({ nhPopulation: 100, nhDepth: 20 }, (startTurn + step) * 500);
      next.monsters.forEach((monster, index) => {
        const old = previousActors.monsters[index], distance = Math.abs(old.x - monster.x) + Math.abs(old.y - monster.y);
        assert(distance <= 1, "monsters never interpolate or jump across cells"); movements[index] += distance;
      });
      previousActors = next;
    }
    assert(movements.every((steps, index) => steps === fullPopulation.monsters[index].speed), "twelve hero turns give each species its source movement budget once doors are open");
    let dogLoitered = false, dogFollowed = false;
    let oldDogFrame = build();
    for (let turn = 1; turn <= 100; turn++) {
      const current = build({}, turn * 500), dogIndex = current.pet.y * 80 + current.pet.x;
      const distance = Math.abs(current.pet.x - oldDogFrame.pet.x) + Math.abs(current.pet.y - oldDogFrame.pet.y);
      assert(distance <= 2 && current.world.passages.includes(dogIndex) && (!current.world.doors.some(entry => entry.index === dogIndex) || current.openDoors.includes(dogIndex)), "the dog follows with its movement budget and never crosses a closed door");
      dogLoitered ||= distance === 0; dogFollowed ||= distance > 0;
      oldDogFrame = current;
    }
    assert(dogLoitered && dogFollowed, "the companion can loiter nearby and follow instead of marching in a fixed trailing slot");
    for (const layout of ["rooms", "maze", "cavern"]) {
      const early = build({ nhLayout: layout, nhFog: true }, 1500);
      const late = build({ nhLayout: layout, nhFog: true }, 1e12);
      const earlyAgain = build({ nhLayout: layout, nhFog: true }, 1500);
      assert(Number.isFinite(late.pet.x) && late.world.passages.includes(late.pet.y * 80 + late.pet.x), `${layout} resolves huge elapsed timestamps with a bounded repeating simulation`);
      assert(equalPixels(pictureOf(early), pictureOf(earlyAgain)), `${layout} reverse-time reads retain deterministic actors and explored terrain`);
    }
    assert(build({ nhPopulation: 0 }).monsters.length === 0 && build({ nhPopulation: 0 }).items.length === 0 && build({ nhPopulation: 100 }).monsters.length > 0, "population can remove or restore monsters and loot");
    const fog = build({ nhFog: true }, 4000);
    const explored = new Set(fog.explored);
    assert(fog.visible.length > 0 && fog.visible.length < fog.world.width * fog.world.height && fog.visible.every(cell => explored.has(cell)), "fog exposes only a local area and remembers discovered tiles");
    const visibleGrid = NetHackVisualizer.toGrid(build({ nhFog: false }, 4000), 80, 22);
    const fogGrid = NetHackVisualizer.toGrid(fog, 80, 22);
    const drawn = grid => grid.flat().filter(cell => cell.char !== " ").length;
    assert(drawn(fogGrid) < drawn(visibleGrid), "fog hides unexplored dungeon cells");
    const compact = NetHackVisualizer.toGrid(build({ nhView: "follow" }, 1500), 9, 5);
    assert(compact.length === 5 && compact.every(row => row.length === 9) && gridText(compact).includes("@"), "small follow view keeps the adventurer visible");
    assert(NetHackVisualizer.toGrid(build({ nhView: "follow" }), 1, 1)[0][0].char === "@", "even the smallest follow view stays centered on the adventurer");
    const safe = build({ nhLayout: "invalid", nhDepth: 999, nhPopulation: -99, nhSpeed: 999, nhGlow: 999, nhFog: "false", nhPalette: "invalid" });
    assert(safe.options.nhDepth <= 30 && safe.options.nhPopulation === 0 && safe.options.nhSpeed <= 4 && safe.options.nhGlow <= 100 && safe.options.nhFog === false, "engine bounds malformed options independently of the interface");
    assert(["rooms", "maze", "cavern"].includes(safe.options.nhLayout) && ["dungeon", "phosphor", "amber", "ice"].includes(safe.options.nhPalette), "invalid enum values fall back to supported settings");
    const quiet = build({ nhInput: "audio" }, 1000, "dungeon-seed", 0), loud = build({ nhInput: "audio" }, 1000, "dungeon-seed", 1);
    assert(quiet.turn === loud.turn && quiet.hero.x === loud.hero.x && quiet.hero.y === loud.hero.y && loud.pulse > quiet.pulse, "audio affects light while movement stays locked to tempo");
    assert(!equalPixels(pictureOf(quiet), pictureOf(loud)), "audio lighting is visibly responsive even with symbol glow disabled");
    const signal = { level: 0, bass: 0, mid: 0, treble: 0, transient: 0, pan: 0 };
    const audioFrame = extra => build({ nhInput: "audio", nhDynamics: 100, nhPopulation: 100 }, 1000, "dungeon-seed", { ...signal, ...extra });
    const silenceGrid = NetHackVisualizer.toGrid(audioFrame({}), 80, 22);
    const bassGrid = NetHackVisualizer.toGrid(audioFrame({ bass: 1 }), 80, 22);
    const midGrid = NetHackVisualizer.toGrid(audioFrame({ mid: 1 }), 80, 22);
    const trebleGrid = NetHackVisualizer.toGrid(audioFrame({ treble: 1 }), 80, 22);
    const silenceCells = silenceGrid.flat();
    const changes = (grid, chars) => grid.flat().filter((cell, index) => chars.includes(cell.char) && cell.color !== silenceCells[index].color).length;
    assert(changes(bassGrid, ".#-|") > 10 && changes(midGrid, ".#-|") === 0, "bass drives dungeon terrain independently of mids");
    assert(changes(midGrid, "okGsrhZTdD") > 0 && changes(trebleGrid, "okGsrhZTdD") === 0, "midrange drives creature glyphs independently of treble");
    assert(changes(trebleGrid, "$!?*)[%") > 0 && changes(bassGrid, "$!?*)[%") === 0, "treble drives treasure and equipment independently of bass");
    assert(!equalPixels(pictureOf(audioFrame({ bass: 1, pan: -1 })), pictureOf(audioFrame({ bass: 1, pan: 1 }))), "stereo balance visibly weights opposite dungeon sides");
    assert(equalPixels(pictureOf(build({ nhInput: "audio", nhDynamics: 0 }, 1000, "dungeon-seed", 0)), pictureOf(build({ nhInput: "audio", nhDynamics: 0 }, 1000, "dungeon-seed", 1))), "zero dynamics fully disables audio coloration and brightness changes");
    const inputObject = { level: 0.7, bass: 0.9, mid: 0.2, treble: 0.5, transient: 1, pan: -0.4 };
    const ownedAudio = build({ nhInput: "audio" }, 1000, "dungeon-seed", inputObject), ownedPicture = pictureOf(ownedAudio);
    inputObject.bass = 0; inputObject.level = 0;
    assert(Object.isFrozen(ownedAudio.audio) && equalPixels(ownedPicture, pictureOf(ownedAudio)), "each immutable frame owns its audio features");
    const malformedAudio = build({ nhInput: "audio" }, 1000, "dungeon-seed", { level: "bad", bass: Infinity, mid: -5, treble: 900, pan: NaN });
    assert(Object.values(malformedAudio.audio).every(Number.isFinite) && malformedAudio.audio.mid === 0 && malformedAudio.audio.treble === 1, "malformed sound features remain finite and bounded");
    assert(new Set(initial.world.loot.map(item => item.color)).size >= 4 && initial.world.loot.find(item => item.char === "%").color === "#aa5500" && initial.world.loot.find(item => item.char === ")").color === "#00aaaa", "objects use source material colors instead of one treasure color");
    const frozenPixels = pictureOf(initial);
    build({}, 10000);
    assert(Object.isFrozen(initial) && Object.isFrozen(initial.world) && equalPixels(frozenPixels, pictureOf(initial)), "later animation cannot mutate an earlier frame or its exported picture");
    assert(litPixels(frozenPixels) > 0 && !equalPixels(frozenPixels, pictureOf(build({ nhPalette: "ice" }))), "native renderer draws the dungeon and responds to its own palette");

    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    intervalMode.checked = false; controls.livePreview.checked = false;
    const common = { ...getPreset(), ...defaults, bpm: "120", nhSpeed: "1", nhFog: false, nhInput: "demo", seed: "shared-dungeon", fullscreenOnStart: false, recordingMode: false, scanlines: false, invert: false, transitionMode: "cut", quality: "low", glyphSize: "16", colorMode: "classic", glitch: "0", density: "1", maskMode: "off", backgroundOnly: false, wordHalo: false };
    assert(!el("textEngine") && !Array.from(controls.backgroundMode.options).some(option => option.value === "nethack"), "NetHack is available only in the video synthesizer");
    assert(!Array.from(el("defaultScenePreset").options).some(option => option.value === "nethackText"), "obsolete text NetHack preset is removed");
    applyPreset({ ...common, visualizerMode: "ascii", backgroundMode: "nethack", lyrics: "DUNGEON" });
    assert(controls.visualizerMode.value === "nethack" && controls.backgroundMode.value === "ray" && el("toolMode").value === "video", "legacy text NetHack scenes migrate to the synth renderer");
    const withoutMode = { backgroundMode: "nethack", nhDepth: "9" };
    assert(normalizePreset(withoutMode).visualizerMode === "nethack" && normalizePreset(withoutMode).backgroundMode === "ray", "legacy dungeon backgrounds without mode metadata migrate too");
    assert(normalizePreset({ visualizerMode: "vm2", backgroundMode: "nethack" }).visualizerMode === "vm2", "stale hidden dungeon backgrounds cannot override an explicit native engine");
    applyPreset({ ...common, visualizerMode: "nethack", nhLayout: "cavern", nhDepth: "12", nhPalette: "ice" });
    assert(el("toolMode").value === "video" && !el("nethackPanel").hidden && el("atariPanel").hidden && el("vm2Panel").hidden, "native NetHack is a separate video renderer with its own panel");
    prepareStateFromControls();
    const nativeFrame = buildFrame(state.startedAt + 900, 640, 480, true);
    assert(nativeFrame.nethack && nativeFrame.grid.length === 0, "native mode creates a dungeon payload without an ASCII grid");
    const nativeSeed = state.seedValue, nativePicture = pictureOf(nativeFrame.nethack);
    controls.lyrics.value = "IGNORED HIDDEN TEXT"; controls.maskArt.value = "########"; controls.palette.value = "amber"; controls.colorMode.value = "thermal";
    prepareStateFromControls();
    assert(nativeSeed === state.seedValue && equalPixels(nativePicture, pictureOf(buildFrame(state.startedAt + 900, 640, 480, true).nethack)), "native dungeon ignores hidden lyrics, masks, and ASCII colors");
    renderFrame(nativeFrame);
    assert(!controls.canvas.hidden && controls.ascii.hidden && litPixels(pixelsOf(controls.canvas)) > 0, "native dungeon draws through the canvas renderer");
    schedulePreview(); clearTimeout(state.previewTimer); renderPreview();
    assert(litPixels(pixelsOf(controls.previewCanvas)) > 0 && litPixels(pixelsOf(el("nethackMonitor"))) > 0, "menu and NetHack panel previews both render the dungeon");
    const preset = getPreset();
    const shared = decodePresetFromUrl(encodePresetForUrl(preset));
    assert(shared.visualizerMode === "nethack" && fields.every(id => shared[id] === preset[id]), "all NetHack settings round-trip through share URLs");
    start(); cancelAnimationFrame(state.raf);
    for (let i = 1; i <= 8; i++) {
      loop(state.startedAt + i * 500); cancelAnimationFrame(state.raf);
      assert(state.running && state.currentFrame.nethack, "successive dungeon playback frames stay valid");
    }
    togglePause();
    const paused = state.currentFrame;
    let download;
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { download = this.href; };
    try {
      saveFrame();
      assert(download?.startsWith("data:image/png") && litPixels(pixelsOf(await pngCanvas(download))) > 0 && state.currentFrame === paused, "paused dungeon exports without advancing the saved frame");
      stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
      controls.recordingMode.checked = true; controls.captureSize.value = "1280x720";
      schedulePreview(); clearTimeout(state.previewTimer); saveFrame();
      const exported = await pngCanvas(download);
      assert(exported.width === 1280 && exported.height === 720 && litPixels(pixelsOf(exported)) > 0, "native PNG honors exact fixed capture dimensions");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    controls.recordingMode.checked = false; controls.captureSize.value = "window";
    const nativeScene = { ...getPreset(), visualizerMode: "nethack", nhLayout: "cavern", nhDepth: "12", nhPalette: "ice", nhFog: true };
    const textScene = { ...common, visualizerMode: "ascii", backgroundMode: "nethack", lyrics: "DUNGEON" };
    const ordinaryBackground = Array.from(controls.backgroundMode.options).find(option => option.value !== "nethack").value;
    const legacy = { ...common, backgroundMode: ordinaryBackground };
    delete legacy.visualizerMode;
    for (const id of fields) delete legacy[id];
    state.scenes = [nativeScene, textScene, legacy, { ...common, visualizerMode: "atari" }, { ...common, visualizerMode: "vm2" }];
    applyPreset(nativeScene); start(); cancelAnimationFrame(state.raf); togglePause();
    recallScene(2); cancelAnimationFrame(state.raf);
    assert(state.paused && controls.visualizerMode.value === "nethack" && controls.backgroundMode.value === "ray" && state.currentFrame.nethack && !el("nethackPanel").hidden, "paused recall migrates an old text dungeon scene into the synth renderer");
    recallScene(3); cancelAnimationFrame(state.raf);
    assert(controls.visualizerMode.value === "ascii" && el("nethackPanel").hidden && el("sceneDirty").textContent.includes("no changes"), "older text scenes remain compatible and clean");
    assert(fields.every(id => cellValue(controls[id]) === (controls[id].type === "checkbox" ? defaults[id] : String(defaults[id]))), "legacy scenes receive NetHack defaults without inheriting another scene's controls");
    recallScene(4); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.atari && !state.currentFrame.nethack, "original Atari scenes still use their original renderer");
    recallScene(5); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.vm2 && !state.currentFrame.nethack, "Video Music 2 scenes remain independent of the dungeon renderer");
    recallScene(1); cancelAnimationFrame(state.raf);
    assert(state.paused && state.currentFrame.nethack && controls.nhDepth.value === "12", "paused recall restores native dungeon settings immediately");
    stop(); clearTimeout(state.previewTimer); stopPreviewLoop();
    applyNamedPreset("nethackVideo"); clearTimeout(state.previewTimer);
    assert(controls.visualizerMode.value === "nethack" && el("toolMode").value === "video", "native dungeon built-in selects the video renderer");
    applyPreset({ ...nativeScene, nhInput: "audio", nhDynamics: "83" }); selectSceneSlot(1); storeScene(1); saveSceneSlots(); saveSetup();
    sessionStorage.setItem("nethackReload", "1");
    location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  }
})();
