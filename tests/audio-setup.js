(async () => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const el = id => document.getElementById(id);
  const stopWork = () => { clearTimeout(state.previewTimer); stopPreviewLoop(); };
  const originalContext = window.AudioContext;
  const originalMedia = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  let installed = false;
  try {
    stopWork();
    if (sessionStorage.getItem("audioSetupReload")) {
      await initAudioSetup(); stopWork();
      assert(audioSetupState.deviceId === "mixer-b" && el("audioDevice").value === "mixer-b", "saved device selection survives reload even before input names are available");
      assert(!audioState.stream && !audioState.context && el("calibrateAudio").disabled, "restoring an input never starts capture or calibration");
      document.body.innerHTML = "<p>PASS: named audio inputs, explicit reconnect, device removal and reappearance, enumeration races, raw levels and gate feedback, noise calibration, capture cancellation, and saved device preference</p>";
      return;
    }
    let requested = 0, stopped = 0, delayResume = false, resumePending = null;
    let devices = [
      { kind: "audioinput", deviceId: "default", label: "Default input" },
      { kind: "audioinput", deviceId: "mic-a", label: "Built-in microphone" },
      { kind: "audioinput", deviceId: "mixer-b", label: "USB mixer" },
      { kind: "audiooutput", deviceId: "speakers", label: "Speakers" }
    ];
    const listeners = new Map(), captures = [], channels = [0.001, 0.001];
    const node = kind => ({ kind, connect(target, output = 0) { if (kind === "splitter") target.channel = output; }, disconnect() {} });
    const makeStream = device => {
      const track = { label: device === "mixer-b" ? "USB mixer" : "Built-in microphone", readyState: "live", stop() { stopped++; this.readyState = "ended"; },
        getSettings: () => ({ deviceId: device || "mic-a" }), addEventListener(type, callback) { if (type === "ended") this.ended = callback; } };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    };
    const media = {
      enumerateDevices: async () => devices,
      addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
      getUserMedia: async constraints => { requested++; captures.push(constraints); return makeStream(constraints.audio.deviceId?.exact || ""); },
      getDisplayMedia: async () => { requested++; return makeStream("shared"); }
    };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: media });
    window.AudioContext = class {
      sampleRate = 48000;
      destination = node("destination");
      resume() { return delayResume ? new Promise(resolve => { resumePending = resolve; }) : Promise.resolve(); }
      close() { return Promise.resolve(); }
      createMediaStreamSource() { return node("source"); }
      createGain() { return { ...node("gain"), gain: { value: 1 } }; }
      createChannelSplitter() { return node("splitter"); }
      createAnalyser() { return { ...node("analyser"), fftSize: 1024, getFloatTimeDomainData(buffer) { buffer.fill(channels[this.channel ?? 0]); } }; }
    };
    installed = true;
    await initAudioSetup(); stopWork();
    assert(requested === 0 && listeners.has("devicechange"), "listing input devices registers hotplug handling without capture");
    assert(el("audioDevice").options.length === 3 && Array.from(el("audioDevice").options).some(option => option.textContent === "USB mixer"), "named hardware inputs appear without output devices or duplicate default entries");
    const choose = device => { el("audioDevice").value = device; el("audioDevice").dispatchEvent(new Event("change", { bubbles: true })); };
    choose("mixer-b");
    assert(localStorage.getItem("asciiBpmAudioDevice") === "mixer-b" && !("audioDevice" in getPreset()), "input preference persists separately from portable scene settings");
    el("audioSource").value = "microphone";
    await connectAudio(); clearInterval(audioState.timer); stopWork();
    assert(requested === 1 && captures[0].audio.deviceId.exact === "mixer-b" && el("audioReadout").textContent.includes("USB mixer"), "explicit capture requests the chosen hardware and reports its name");
    const mixerStream = audioState.stream;
    choose("mic-a");
    assert(audioState.stream === mixerStream && requested === 1 && el("audioDeviceHelp").textContent.includes("Reconnect audio"), "choosing another input keeps the current stream until explicit reconnection");
    assert(el("connectAudio").textContent === "Reconnect audio" && !el("connectAudio").disabled, "connected input has an available reconnect action");
    el("audioSource").value = "screen"; el("audioSource").dispatchEvent(new Event("change", { bubbles: true }));
    assert(el("audioDevice").disabled && audioState.stream === mixerStream && requested === 1, "shared-source selection disables hardware controls without changing capture");
    el("audioSource").value = "microphone"; el("audioSource").dispatchEvent(new Event("change", { bubbles: true }));
    await connectAudio(); clearInterval(audioState.timer); stopWork();
    assert(requested === 2 && captures[1].audio.deviceId.exact === "mic-a" && stopped > 0 && audioState.stream !== mixerStream, "reconnect releases the old stream and uses the new hardware");
    devices = devices.filter(device => device.deviceId !== "mic-a");
    await listeners.get("devicechange")(); stopWork();
    assert(!audioState.stream && el("audioReadout").textContent.includes("reconnect") && el("audioDevice").value === "mic-a", "removing an active named input releases capture and preserves its preference");
    devices.push({ kind: "audioinput", deviceId: "mic-a", label: "Built-in microphone" });
    await listeners.get("devicechange")();
    assert(requested === 2 && !audioState.stream && !el("audioDevice").selectedOptions[0].textContent.includes("unavailable"), "reappearing hardware becomes available without automatic capture");
    let resolveOld;
    media.enumerateDevices = () => new Promise(resolve => { resolveOld = resolve; });
    const oldEnumeration = refreshAudioDevices();
    media.enumerateDevices = async () => devices;
    await refreshAudioDevices(); resolveOld([{ kind: "audioinput", deviceId: "stale", label: "Stale input" }]); await oldEnumeration;
    assert(!Array.from(el("audioDevice").options).some(option => option.value === "stale") && el("audioDevice").value === "mic-a", "late enumeration cannot replace the latest input list or selection");
    choose("mixer-b"); await connectAudio(); clearInterval(audioState.timer); stopWork();
    el("audioGate").value = "-30"; el("audioSensitivity").value = "10";
    sampleAudio(performance.now());
    assert(Math.abs(el("audioRawLeft").value + 60) < 0.01 && el("audioLevelLeft").value === 0 && el("audioRawLeftValue").textContent.includes("-60.0"), "raw dBFS meter remains visible below the gate and ignores sensitivity");
    assert(el("audioCalibrationReadout").textContent.includes("Left gate closed"), "calibration explains when the gate blocks raw input");
    const measure = () => {
      calibrateAudioNoiseGate();
      const start = audioSetupState.calibration.startedAt;
      for (let step = 0; step <= 80; step++) sampleAudio(start + step * 25);
      stopWork();
    };
    measure();
    assert(el("audioGate").value === "-54" && !audioSetupState.calibration && el("audioCalibrationReadout").textContent.includes("6 dB above measured noise"), "noise calibration sets the gate above measured raw noise despite an initially closed gate");
    const calibratedGate = el("audioGate").value;
    channels[0] = channels[1] = 0.2; measure();
    assert(el("audioGate").value === calibratedGate && el("audioCalibrationReadout").textContent.includes("too loud"), "calibration refuses loud source material without replacing the gate");
    calibrateAudioNoiseGate(); sampleAudio(audioSetupState.calibration.startedAt + 2100);
    assert(el("audioGate").value === calibratedGate && el("audioCalibrationReadout").textContent.includes("Not enough audio samples"), "throttled or insufficient samples leave the gate unchanged");
    el("audioGate").value = "-45"; channels[0] = 0.01; channels[1] = 0.0001; sampleAudio(performance.now());
    assert(el("audioCalibrationReadout").textContent.includes("Left gate open · Right gate closed"), "gate feedback follows the raw channels independently");
    channels[0] = 1.05; sampleAudio(performance.now() + 16);
    assert(el("audioCalibrationReadout").textContent.includes("Lower the source or interface gain"), "clipping guidance distinguishes source gain from visual sensitivity");
    calibrateAudioNoiseGate(); disconnectAudio(); stopWork();
    assert(!audioSetupState.calibration && el("calibrateAudio").disabled && el("audioRawLeft").value === -70, "disconnect cancels calibration and clears raw meters");
    const capture = media.getUserMedia;
    media.getUserMedia = async () => { const error = new Error("Missing input"); error.name = "OverconstrainedError"; throw error; };
    await connectAudio(); stopWork();
    assert(!audioState.stream && el("audioReadout").textContent.includes("Refresh inputs") && !el("connectAudio").disabled, "a missing chosen input gives a recoverable selection error instead of using another device");
    let resolveCapture;
    media.getUserMedia = () => new Promise(resolve => { resolveCapture = resolve; });
    const pending = connectAudio(); disconnectAudio(); resolveCapture(makeStream("mixer-b")); await pending; stopWork();
    assert(!audioState.stream && !audioSetupState.connecting && !el("audioDevice").disabled, "cancelling permission cannot revive capture or leave the picker disabled");
    media.getUserMedia = capture;
    choose(""); delayResume = true;
    const resuming = connectAudio(); await Promise.resolve(); await Promise.resolve();
    assert(resumePending && audioState.stream, "default input reaches a pending AudioContext resume");
    const endedTrack = audioState.stream.getTracks()[0];
    endedTrack.readyState = "ended"; endedTrack.ended(); resumePending(); await resuming; stopWork();
    assert(!audioState.stream && !audioState.context && !audioState.timer && el("audioReadout").textContent.includes("reconnect"), "an input ending during context resume cancels initialization without relying on named-device enumeration");
    delayResume = false;
    media.getUserMedia = async () => { const ended = makeStream(""); ended.getTracks()[0].readyState = "ended"; return ended; };
    await connectAudio(); stopWork();
    assert(!audioState.stream && !audioState.context && el("audioReadout").textContent.includes("ended before connection completed"), "a track already ended when capture resolves never starts analysis");
    media.getUserMedia = capture; choose("mixer-b");
    assert(localStorage.getItem("asciiBpmAudioDevice") === "mixer-b", "device removal and failures never discard the saved preference");
    sessionStorage.setItem("audioSetupReload", "1"); location.reload();
  } catch (error) {
    document.body.textContent = `FAIL: ${error.stack}`;
  } finally {
    if (installed) {
      if (document.getElementById("audioMeter")) { disconnectAudio(); stopWork(); }
      window.AudioContext = originalContext;
      if (originalMedia) Object.defineProperty(navigator, "mediaDevices", originalMedia); else delete navigator.mediaDevices;
    }
  }
})();
