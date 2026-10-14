(async () => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const el = id => document.getElementById(id);
  const near = (first, second, tolerance = 0.00001) => Math.abs(first - second) < tolerance;
  const stopWork = () => { clearTimeout(state.previewTimer); stopPreviewLoop(); };
  const originalContext = window.AudioContext;
  const originalMedia = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  let installed = false;
  try {
    stopWork();
    if (sessionStorage.getItem("audioControlsReload")) {
      assert(el("audioAttack").value === "75" && el("audioRelease").value === "650" && el("audioGate").value === "-36", "global audio calibration survives reload");
      assert(controls.audioResponse.value === "treble", "scene audio response survives reload");
      assert(!audioState.stream && !audioState.context && audioState.level === 0 && el("audioLevelLeft").value === 0, "reload never requests capture and starts with empty meters");
      document.body.innerHTML = "<p>PASS: stereo audio bands and routing, elapsed-time envelopes, noise gate, input clipping, mono upmix, lifecycle races, scene response, and calibration reload</p>";
      return;
    }
    assert(typeof getSynthAudioSignal === "function" && !audioState.stream, "audio remains disconnected until an explicit connect");
    for (const [id, min, max] of [["audioAttack", 1, 250], ["audioRelease", 20, 2000], ["audioGate", -70, -10]]) {
      assert(Number(el(id).min) === min && Number(el(id).max) === max && setupControls.includes(id), `${id} is bounded and stored as global calibration`);
      assert(!(id in getPreset()), `${id} is independent of scene presets`);
    }
    assert(normalizePreset({ audioResponse: "unsupported" }).audioResponse === undefined, "unsupported response values cannot enter scenes");
    const channels = [{ amplitude: 0.2, hz: 100, polarity: 1 }, { amplitude: 0.1, hz: 4000, polarity: 1 }];
    let requested = 0, stopped = 0, closed = 0, resumePending = null, delayResume = false;
    const connections = [], tracks = [];
    const makeStream = () => {
      const track = { ended: null, stop() { stopped++; }, addEventListener(event, callback) { if (event === "ended") this.ended = callback; } };
      tracks.push(track);
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    };
    const node = kind => ({ kind, connect(target, output = 0) { connections.push({ source: this, target, output }); if (kind === "splitter") target.channel = output; }, disconnect() {} });
    const waveform = (buffer, channel) => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = Math.sin(2 * Math.PI * channel.hz * i / 48000) * channel.amplitude * channel.polarity;
    };
    const media = { getUserMedia: async () => { requested++; return makeStream(); }, getDisplayMedia: async () => { requested++; return makeStream(); } };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: media });
    window.AudioContext = class {
      sampleRate = 48000;
      destination = node("destination");
      resume() { return delayResume ? new Promise(resolve => { resumePending = resolve; }) : Promise.resolve(); }
      close() { closed++; return Promise.resolve(); }
      createMediaStreamSource() { return node("source"); }
      createGain() { return { ...node("gain"), gain: { value: 1 } }; }
      createChannelSplitter() { return node("splitter"); }
      createAnalyser() {
        return { ...node("analyser"), fftSize: 1024, get frequencyBinCount() { return this.fftSize / 2; },
          getFloatTimeDomainData(buffer) {
            if (this.channel === undefined) {
              waveform(buffer, channels[0]);
              const right = new Float32Array(buffer.length); waveform(right, channels[1]);
              buffer.forEach((value, index) => { buffer[index] = (value + right[index]) / 2; });
            } else waveform(buffer, channels[this.channel]);
          },
          getFloatFrequencyData(buffer) {
            buffer.fill(-Infinity);
            const channel = channels[this.channel ?? 0];
            if (channel.amplitude > 0) buffer[Math.round(channel.hz * this.fftSize / 48000)] = 20 * Math.log10(channel.amplitude / Math.SQRT2);
          }
        };
      }
    };
    installed = true;
    el("audioSource").value = "microphone";
    assert(requested === 0, "opening audio controls does not request permission");
    await connectAudio(); clearInterval(audioState.timer);
    assert(requested === 1 && audioState.context && audioState.analysers.length === 2, "explicit connect creates independent stereo analysers");
    const split = connections.find(edge => edge.target.kind === "splitter");
    assert(split.source.channelCount === 2 && split.source.channelCountMode === "explicit" && split.source.channelInterpretation === "speakers", "mono sources duplicate into left and right before analysis");
    assert(audioState.analysers.every(analyser => analyser.smoothingTimeConstant === 0), "FFT smoothing does not compete with configured envelope timing");
    let now = 0;
    const reset = () => {
      audioState.left = emptyAudioChannel(); audioState.right = emptyAudioChannel(); audioState.features = emptyAudioFeatures();
      audioState.level = 0; audioState.previousTarget = 0; audioState.lastSampleAt = 0; now = 0;
    };
    const advance = milliseconds => sampleAudio(now += milliseconds);
    el("audioSensitivity").value = "4"; el("audioAttack").value = "20"; el("audioRelease").value = "120"; el("audioGate").value = "-42";
    reset(); advance(200);
    const full = getSynthAudioSignal(), bass = getSynthAudioSignal("bass"), treble = getSynthAudioSignal("treble");
    assert(bass.left.level > 0.5 && bass.right.level === 0 && treble.right.level > 0.3 && treble.left.level === 0, "bass and treble select the correct channel's measured spectrum");
    assert(full.left === audioState.left && getSynthAudioSignal("invalid").left === full.left, "default and invalid responses preserve full-range channel semantics");
    assert(bass.left.samples === full.left.samples && treble.right.samples === full.right.samples && bass.left.crossings === full.left.crossings, "response selection preserves raw stereo waveforms and crossing frequencies");
    assert(audioState.left.level === full.left.level && bass.left !== full.left, "selecting a band never changes the raw full-range envelope");
    assert(el("audioLevelLeft").value > el("audioLevelRight").value && el("audioMeter").value > 0, "stereo meters retain different input levels alongside the aggregate meter");
    for (const [hz, band] of [[100, "bass"], [1000, "mid"], [8000, "treble"]]) {
      channels[0] = { amplitude: 0.15, hz, polarity: 1 }; channels[1] = { amplitude: 0.15, hz, polarity: -1 };
      reset(); advance(200);
      assert(audioState.samples.every(value => Math.abs(value) < 0.000001), "antiphase test cancels in a mono waveform");
      assert(audioState.features[band] > 0.5 && getSynthAudioSignal(band).left.level > 0.5 && getSynthAudioSignal(band).right.level > 0.5, `${hz} Hz antiphase stereo remains present in both independent spectra`);
      assert(["bass", "mid", "treble"].filter(key => key !== band).every(key => audioState.features[key] === 0), `${hz} Hz does not leak into unrelated response bands`);
    }
    channels[0] = { amplitude: 0.08, hz: 1000, polarity: 1 }; channels[1] = { ...channels[0] };
    el("audioAttack").value = "100"; el("audioRelease").value = "400"; el("audioGate").value = "-70";
    reset(); advance(100); const singleStep = audioState.left.level;
    reset(); for (let step = 0; step < 10; step++) advance(10);
    assert(near(singleStep, audioState.left.level), "attack depends on elapsed time rather than timer callback count");
    const unchanged = audioState.left.level; sampleAudio(now);
    assert(audioState.left.level === unchanged, "repeated sampling at one timestamp cannot advance envelopes");
    const beforeRelease = audioState.left.level;
    channels[0].amplitude = channels[1].amplitude = 0;
    advance(400);
    assert(near(audioState.left.level, beforeRelease / Math.E), "release uses the configured millisecond time constant");
    channels[0].amplitude = channels[1].amplitude = 0.1;
    el("audioAttack").value = "1"; reset(); advance(20); const fast = audioState.left.level;
    el("audioAttack").value = "250"; reset(); advance(20);
    assert(fast > audioState.left.level * 5, "attack control visibly changes response speed");
    el("audioAttack").value = "20"; el("audioRelease").value = "120"; el("audioGate").value = "-30";
    channels[0].amplitude = channels[1].amplitude = 0.02;
    reset(); advance(500);
    assert(audioState.level === 0 && audioState.left.level === 0 && audioState.left.crossings === 0 && Object.values(audioState.features).every(value => value === 0), "signals below the dBFS noise gate cannot trigger envelopes, colors, or bands");
    assert(audioState.left.samples.some(value => value !== 0), "gating leaves the captured waveform intact");
    channels[0].amplitude = channels[1].amplitude = 0.2; advance(100);
    assert(audioState.left.level > 0 && getSynthAudioSignal("transient").left.level > 0.5, "a signal above the gate creates an onset response");
    const onset = getSynthAudioSignal("transient").left.level; advance(500);
    assert(getSynthAudioSignal("transient").left.level < onset / 20, "transient response decays on a sustained tone");
    el("audioSensitivity").value = "10"; advance(500);
    assert(audioState.left.level > 0.99 && !audioState.left.clipped, "sensitivity saturation is not mistaken for input clipping");
    channels[0].amplitude = 1.05; channels[1].amplitude = 0.2; advance(16);
    assert(audioState.left.clipped && !audioState.right.clipped && el("audioClipLeft").classList.contains("clipping") && !el("audioClipRight").classList.contains("clipping"), "raw clipping identifies the affected stereo input independently");
    channels[0].amplitude = 0; advance(500);
    assert(audioState.left.clipped, "clipping indicator remains visible briefly after a peak");
    advance(600); assert(!audioState.left.clipped && el("audioClipLeft").textContent === "Clear", "clipping hold clears after the input recovers");
    for (const id of Object.keys(lockGroups)) el(id).checked = false;
    channels[0] = { amplitude: 0.15, hz: 100, polarity: 1 }; channels[1] = { amplitude: 0.15, hz: 4000, polarity: 1 };
    el("audioSensitivity").value = "4"; el("audioGate").value = "-42"; reset(); advance(200);
    for (const mode of ["atari", "vm2", "pixelmusic"]) {
      applyPreset({ ...getPreset(), visualizerMode: mode, audioResponse: "bass", atariInput: "audio", vm2Input: "audio", pmInput: "audio" }); stopWork();
      assert(controls.audioResponse.value === "bass" && decodePresetFromUrl(encodePresetForUrl(getPreset())).audioResponse === "bass", `${mode} retains response in scenes and share links`);
      const levels = () => {
        prepareStateFromControls();
        const frame = buildFrame(state.startedAt + 500, 320, 240, true);
        return mode === "pixelmusic" ? [frame.pixelmusic.scalarLeft, frame.pixelmusic.scalarRight]
          : mode === "vm2" ? [frame.vm2.source.left.level, frame.vm2.source.right.level] : [frame.atari.left.level, frame.atari.right.level];
      };
      const bassLevels = levels();
      assert(bassLevels[0] > 0 && bassLevels[1] === 0, `${mode} builds its picture from the selected bass envelopes`);
      applyPreset({ ...getPreset(), audioResponse: "treble" }); stopWork();
      const trebleLevels = levels();
      assert(trebleLevels[0] === 0 && trebleLevels[1] > 0, `${mode} switches its picture to the selected treble envelopes`);
    }
    const old = { ...getPreset() }; delete old.audioResponse; applyPreset(old); stopWork();
    assert(controls.audioResponse.value === "full", "legacy scenes default to full-range audio instead of inheriting a selected band");
    const oldTrack = tracks[tracks.length - 1];
    await connectAudio(); clearInterval(audioState.timer);
    const activeStream = audioState.stream; oldTrack.ended();
    assert(audioState.stream === activeStream, "an ended event from an old source cannot disconnect a replacement");
    disconnectAudio(); stopWork();
    assert(!audioState.context && audioState.level === 0 && audioState.frequencyBuffers.length === 0 && audioState.lastSampleAt === null && !audioState.left.clipped && el("audioLevelRight").value === 0, "disconnect clears spectrum, envelope timing, clipping and meters");
    delayResume = true;
    const pending = connectAudio(); await Promise.resolve(); await Promise.resolve();
    assert(resumePending && audioState.context, "deferred context resume reaches the cancellation test");
    disconnectAudio(); resumePending(); await pending; stopWork();
    assert(!audioState.stream && !audioState.context && !audioState.timer && stopped > 0 && closed > 0, "cancelling while AudioContext resumes cannot resurrect capture");
    el("audioAttack").value = "75"; el("audioRelease").value = "650"; el("audioGate").value = "-36";
    applyPreset({ ...getPreset(), audioResponse: "treble" }); stopWork(); selectSceneSlot(1); storeScene(1); saveSetup();
    sessionStorage.setItem("audioControlsReload", "1"); location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  } finally {
    if (installed) {
      disconnectAudio(); stopWork(); window.AudioContext = originalContext;
      if (originalMedia) Object.defineProperty(navigator, "mediaDevices", originalMedia); else delete navigator.mediaDevices;
    }
  }
})();
