"use strict";

// Audio capture, analysis, signal routing, and connection lifecycle.
// Classic scripts share app-state.js bindings so index.html also works over file://.

const emptyAudioFeatures = () => ({ bass: 0, mid: 0, treble: 0, transient: 0, pan: 0 });
const emptyAudioChannel = () => ({ level: 0, crossings: 0, samples: null, features: emptyAudioFeatures(),
  rawRms: 0, peak: 0, clipped: false, clipUntil: 0, previousTarget: 0 });
const audioState = {
  stream: null, context: null, source: null, analyser: null, samples: null, level: 0, timer: 0, generation: 0,
  stereo: null, splitter: null, analysers: [], sampleBuffers: [], sink: null,
  frequencies: null, frequencyBuffers: [], features: emptyAudioFeatures(), previousTarget: 0, lastSampleAt: null,
  left: emptyAudioChannel(), right: emptyAudioChannel()
};
const audioSetupState = {
  initialized: false, media: null, devices: [], deviceId: "", enumeration: 0, enumerating: false,
  enumerationError: "", connecting: false, connectedSource: "", requestedDeviceId: "", connectedDeviceId: "",
  calibration: null, calibrationMessage: ""
};

function audioDecibels(level) {
  return Math.max(-70, Math.min(0, 20 * Math.log10(Math.max(0.0000001, level))));
}

function updateAudioDeviceControls() {
  const picker = document.getElementById("audioDevice"), refresh = document.getElementById("refreshAudioDevices");
  const screen = document.getElementById("audioSource")?.value === "screen";
  if (picker) picker.disabled = screen || audioSetupState.connecting;
  if (refresh) refresh.disabled = screen || audioSetupState.connecting || audioSetupState.enumerating;
  const source = document.getElementById("audioSource");
  if (source) source.disabled = audioSetupState.connecting;
  const connect = document.getElementById("connectAudio");
  if (connect) {
    connect.disabled = audioSetupState.connecting;
    connect.textContent = audioSetupState.connecting ? "Connecting…" : audioState.stream ? "Reconnect audio" : "Connect audio";
  }
  const help = document.getElementById("audioDeviceHelp");
  if (!help) return;
  const changed = audioState.stream && (audioSetupState.connectedSource !== (screen ? "screen" : "microphone")
    || (!screen && audioSetupState.requestedDeviceId !== audioSetupState.deviceId));
  const unavailable = audioSetupState.deviceId && !audioSetupState.devices.some(device => device.deviceId === audioSetupState.deviceId);
  help.textContent = audioSetupState.connecting ? "Waiting for the selected source. Disconnect cancels the request."
    : changed ? "Selection changed. The current input stays connected until you click Reconnect audio."
      : screen ? "Choose shared tab or system audio in the browser picker when you connect."
        : audioSetupState.enumerationError || (audioSetupState.enumerating ? "Refreshing inputs…"
          : unavailable ? "The saved input is not listed. Refresh inputs or choose another input before connecting."
            : audioSetupState.devices.some(device => !device.label) ? "Connect audio once to reveal input names, then refresh. Refresh inputs never requests access."
              : "Choose an input, then Connect audio. Device changes are applied only when you reconnect.");
}

async function refreshAudioDevices() {
  const picker = document.getElementById("audioDevice");
  if (!picker) return;
  const request = ++audioSetupState.enumeration, media = navigator.mediaDevices;
  audioSetupState.enumerating = true;
  audioSetupState.enumerationError = "";
  updateAudioDeviceControls();
  try {
    if (!media?.enumerateDevices) throw new Error("Input names are unavailable in this browser. System default still works.");
    const devices = await media.enumerateDevices();
    if (request !== audioSetupState.enumeration || media !== navigator.mediaDevices) return;
    audioSetupState.devices = devices.filter(device => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default");
    const options = [new Option("System default", "")];
    for (const [index, device] of audioSetupState.devices.entries()) options.push(new Option(device.label || `Audio input ${index + 1} · connect to reveal name`, device.deviceId));
    if (audioSetupState.deviceId && !audioSetupState.devices.some(device => device.deviceId === audioSetupState.deviceId)) {
      options.push(new Option("Saved input · unavailable", audioSetupState.deviceId));
    }
    picker.replaceChildren(...options);
    picker.value = audioSetupState.deviceId;
    if (audioState.stream && audioSetupState.connectedSource === "microphone" && audioSetupState.requestedDeviceId
      && !audioSetupState.devices.some(device => device.deviceId === audioSetupState.connectedDeviceId)) {
      disconnectAudio("Audio input disconnected. Choose an available input and reconnect.");
    }
  } catch (error) {
    if (request !== audioSetupState.enumeration) return;
    audioSetupState.enumerationError = error.message || "Could not list inputs. Refresh and try again.";
    if (audioSetupState.deviceId && !Array.from(picker.options).some(option => option.value === audioSetupState.deviceId)) {
      picker.add(new Option("Saved input · connect to check availability", audioSetupState.deviceId));
      picker.value = audioSetupState.deviceId;
    }
  } finally {
    if (request === audioSetupState.enumeration) {
      audioSetupState.enumerating = false;
      updateAudioDeviceControls();
    }
  }
}

function initAudioSetup() {
  if (!audioSetupState.initialized) {
    audioSetupState.initialized = true;
    try { audioSetupState.deviceId = localStorage.getItem("asciiBpmAudioDevice") || ""; } catch (error) { /* Capture works without browser storage. */ }
    document.getElementById("audioDevice")?.addEventListener("change", event => {
      audioSetupState.deviceId = event.target.value;
      try { localStorage.setItem("asciiBpmAudioDevice", audioSetupState.deviceId); } catch (error) { /* Keep the session selection. */ }
      updateAudioDeviceControls();
    });
    document.getElementById("refreshAudioDevices")?.addEventListener("click", refreshAudioDevices);
    document.getElementById("audioSource")?.addEventListener("change", updateAudioDeviceControls);
    document.getElementById("calibrateAudio")?.addEventListener("click", calibrateAudioNoiseGate);
    document.getElementById("resumeAudio")?.addEventListener("click", resumeConnectedAudio);
    for (const id of ["audioGate", "audioSensitivity"]) document.getElementById(id)?.addEventListener("input", () => {
      audioSetupState.calibrationMessage = "";
      updateAudioCalibration();
    });
  }
  const media = navigator.mediaDevices;
  if (media !== audioSetupState.media) {
    audioSetupState.media?.removeEventListener?.("devicechange", refreshAudioDevices);
    audioSetupState.media = media;
    media?.addEventListener?.("devicechange", refreshAudioDevices);
  }
  updateAudioCalibration();
  return refreshAudioDevices();
}

function updateAudioCalibration() {
  for (const [name, channel] of [["Left", audioState.left], ["Right", audioState.right]]) {
    const decibels = audioDecibels(channel.rawRms), meter = document.getElementById(`audioRaw${name}`);
    if (meter) meter.value = decibels;
    const output = document.getElementById(`audioRaw${name}Value`);
    if (output) output.textContent = channel.rawRms > 0 ? `${decibels.toFixed(1)} dBFS` : "−∞ dBFS";
  }
  const button = document.getElementById("calibrateAudio");
  if (button) {
    button.disabled = !audioState.analyser || Boolean(audioSetupState.calibration);
    button.textContent = audioSetupState.calibration ? "Measuring noise…" : "Measure noise floor";
  }
  const readout = document.getElementById("audioCalibrationReadout");
  if (!readout) return;
  const gateDb = Number(document.getElementById("audioGate")?.value || -42), gate = Math.pow(10, gateDb / 20);
  const gateState = `Left gate ${audioState.left.rawRms >= gate ? "open" : "closed"} · Right gate ${audioState.right.rawRms >= gate ? "open" : "closed"}.`;
  let guidance = "Aim for a strong response without keeping the response meters pinned at full.";
  if (audioState.left.clipped || audioState.right.clipped) guidance = "Input is clipping. Lower the source or interface gain; sensitivity cannot repair input clipping.";
  else if (Math.max(audioState.left.level, audioState.right.level) > 0.98) guidance = "Response is at its limit. Lower sensitivity to retain changes in loudness.";
  else if (Math.max(audioState.left.rawRms, audioState.right.rawRms) < gate) guidance = "The gate is blocking this signal. Lower the gate for quiet music, or stop the source and Measure noise floor.";
  else if (Math.max(audioState.left.level, audioState.right.level) < 0.1) guidance = "Raise sensitivity if the picture barely responds while music is playing.";
  const message = audioSetupState.calibration ? "Measuring input noise for 2 seconds. Keep the music or source silent."
    : !audioState.analyser ? "Connect audio to see raw input levels before the gate and sensitivity. Stop the source before using Measure noise floor."
      : `${audioSetupState.calibrationMessage ? `${audioSetupState.calibrationMessage} ` : ""}${gateState} ${guidance}`;
  if (readout.textContent !== message) readout.textContent = message;
}

function calibrateAudioNoiseGate() {
  if (!audioState.analyser || audioSetupState.calibration) return;
  const calibration = { generation: audioState.generation, startedAt: performance.now(), samples: [], firstAt: null, lastAt: null, timer: 0 };
  audioSetupState.calibration = calibration;
  audioSetupState.calibrationMessage = "";
  calibration.timer = setTimeout(finishAudioNoiseCalibration, 2300);
  updateAudioCalibration();
}

function finishAudioNoiseCalibration() {
  const calibration = audioSetupState.calibration;
  if (!calibration) return;
  clearTimeout(calibration.timer);
  audioSetupState.calibration = null;
  if (calibration.generation !== audioState.generation || !audioState.analyser) return;
  const samples = calibration.samples.sort((first, second) => first - second);
  if (samples.length < 20 || calibration.lastAt - calibration.firstAt < 1500) {
    audioSetupState.calibrationMessage = "Not enough audio samples. Keep this tab visible and try again; the gate is unchanged.";
  } else {
    const floor = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))];
    if (floor > -24) audioSetupState.calibrationMessage = "Input is too loud to measure its noise floor. Stop the source or lower input gain and try again; the gate is unchanged.";
    else {
      const value = Math.round(clamp(floor + 6, -70, -10)), control = document.getElementById("audioGate");
      if (control) {
        control.value = String(value);
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
      }
      audioSetupState.calibrationMessage = `Gate set to ${value} dBFS, 6 dB above measured noise (${floor.toFixed(1)} dBFS).`;
    }
  }
  updateAudioCalibration();
}

function updateAudioMeters() {
  document.getElementById("audioMeter").value = audioState.level;
  for (const [name, channel] of [["Left", audioState.left], ["Right", audioState.right]]) {
    const meter = document.getElementById(`audioLevel${name}`);
    if (meter) meter.value = channel.level;
    const indicator = document.getElementById(`audioClip${name}`);
    if (indicator) {
      indicator.textContent = channel.clipped ? "Clipping" : "Clear";
      indicator.classList.toggle("clipping", channel.clipped);
    }
  }
  updateAudioCalibration();
}

function clearAudioSignal() {
  Object.assign(audioState, { level: 0, features: emptyAudioFeatures(), previousTarget: 0, lastSampleAt: null,
    left: emptyAudioChannel(), right: emptyAudioChannel() });
}

function stopAudioStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch (error) { /* Release other tracks even if this device is already gone. */ }
  }
}

function updateAudioContextState(context, generation) {
  if (audioState.context !== context || generation !== audioState.generation) return;
  const button = document.getElementById("resumeAudio");
  const suspended = context.state === "suspended" || context.state === "interrupted";
  if (button) { button.hidden = !suspended; button.disabled = false; }
  if (context.state === "closed") {
    disconnectAudio("Audio context closed. Reconnect your input.");
  } else if (suspended) {
    clearAudioSignal();
    updateAudioMeters();
    document.getElementById("audioReadout").textContent = "Audio suspended. Use Resume audio to continue with this input.";
    schedulePreview();
  } else if (context.state === "running") {
    document.getElementById("audioReadout").textContent = audioSetupState.connectedSource === "screen" ? "Shared audio connected" : "Audio input connected";
  }
}

async function resumeConnectedAudio() {
  const context = audioState.context, generation = audioState.generation;
  if (!context) return;
  const button = document.getElementById("resumeAudio");
  if (button) button.disabled = true;
  try {
    await context.resume();
    updateAudioContextState(context, generation);
  } catch (error) {
    if (context === audioState.context && generation === audioState.generation) {
      if (button) button.disabled = false;
      document.getElementById("audioReadout").textContent = "Audio could not resume. Retry Resume audio or reconnect the input.";
    }
  }
}

function sampleAudioSafely() {
  try { sampleAudio(); }
  catch (error) { disconnectAudio("Audio analysis stopped. Reconnect the input to retry; visual playback continues."); }
}

function disconnectAudio(message = "Audio off") {
  audioState.generation += 1;
  if (audioSetupState.calibration) clearTimeout(audioSetupState.calibration.timer);
  Object.assign(audioSetupState, { connecting: false, connectedSource: "", requestedDeviceId: "", connectedDeviceId: "", calibration: null, calibrationMessage: "" });
  clearInterval(audioState.timer);
  for (const node of [audioState.source, audioState.analyser, audioState.stereo, audioState.splitter, ...audioState.analysers, audioState.sink]) {
    try { node?.disconnect(); } catch (error) { /* Complete cleanup even if one node is already invalid. */ }
  }
  stopAudioStream(audioState.stream);
  if (audioState.context) {
    try { Promise.resolve(audioState.context.close()).catch(() => {}); } catch (error) { /* Already closed. */ }
  }
  Object.assign(audioState, {
    stream: null, context: null, source: null, analyser: null, samples: null, level: 0, timer: 0,
    stereo: null, splitter: null, analysers: [], sampleBuffers: [], sink: null,
    frequencies: null, frequencyBuffers: [], features: emptyAudioFeatures(), previousTarget: 0, lastSampleAt: null,
    left: emptyAudioChannel(), right: emptyAudioChannel()
  });
  updateAudioMeters();
  document.getElementById("audioReadout").textContent = message;
  document.getElementById("connectAudio").disabled = false;
  document.getElementById("disconnectAudio").disabled = true;
  document.getElementById("audioSource").disabled = false;
  const resume = document.getElementById("resumeAudio");
  if (resume) { resume.hidden = true; resume.disabled = false; }
  updateAudioDeviceControls();
  updateAtariControls();
  schedulePreview();
}

function getSynthAudioSignal(response = "full") {
  const selected = ["bass", "mid", "treble", "transient"].includes(response) ? response : "full";
  const channel = source => selected === "full" ? source : { ...source, level: source.features?.[selected] || 0 };
  return { left: channel(audioState.left), right: channel(audioState.right), sampleRate: audioState.context?.sampleRate || 48000 };
}

function sampleAudio(now = performance.now()) {
  if (!audioState.analyser) return;
  if (["suspended", "interrupted", "closed"].includes(audioState.context?.state)) return;
  const timestamp = Number.isFinite(now) ? now : performance.now();
  // The first sample gets one nominal analysis interval; subsequent envelopes
  // depend on elapsed time, so timer throttling cannot alter their time constants.
  const elapsed = audioState.lastSampleAt === null ? 16 : Math.max(0, timestamp - audioState.lastSampleAt);
  audioState.lastSampleAt = timestamp;
  const setting = (id, fallback, min, max) => {
    const value = Number(document.getElementById(id)?.value ?? fallback);
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  };
  const sensitivity = setting("audioSensitivity", 4, 1, 10);
  const attack = setting("audioAttack", 20, 1, 250), release = setting("audioRelease", 120, 20, 2000);
  const gate = Math.pow(10, setting("audioGate", -42, -70, -10) / 20);
  const sampleRate = audioState.context?.sampleRate || 48000;
  const smooth = (current, target) => {
    const value = current + (target - current) * -Math.expm1(-elapsed / (target > current ? attack : release));
    return value < 0.0001 ? 0 : value;
  };
  audioState.analyser.getFloatTimeDomainData(audioState.samples);
  const channels = [audioState.left, audioState.right];
  for (let index = 0; index < channels.length; index++) {
    const channel = channels[index], analyser = audioState.analysers[index] || audioState.analyser;
    const samples = audioState.sampleBuffers[index] || audioState.samples;
    if (analyser !== audioState.analyser) analyser.getFloatTimeDomainData(samples);
    let squareSum = 0, crossings = 0, lastSign = 0, peak = 0;
    for (const incoming of samples) {
      const sample = Number.isFinite(incoming) ? clamp(incoming, -1, 1) : 0;
      squareSum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      const sign = sample > 0.001 ? 1 : sample < -0.001 ? -1 : 0;
      if (sign && lastSign && sign !== lastSign) crossings += 1;
      if (sign) lastSign = sign;
    }
    const rms = Math.sqrt(squareSum / samples.length), open = rms >= gate;
    const target = open ? clamp((rms - gate) * sensitivity * 1.5, 0, 1) : 0;
    channel.level = smooth(channel.level, target);
    channel.rawRms = rms; channel.peak = peak;
    if (peak >= 0.985) channel.clipUntil = timestamp + 1000;
    channel.clipped = channel.clipUntil > timestamp;
    channel.crossings = open ? crossings * sampleRate / (2 * samples.length) : 0;
    channel.samples = samples;
    const features = channel.features;
    features.transient = Math.max(features.transient * Math.exp(-elapsed / release), clamp((target - channel.previousTarget) * 4, 0, 1));
    if (features.transient < 0.0001) features.transient = 0;
    channel.previousTarget = target;
    const energy = { bass: 0, mid: 0, treble: 0 };
    if (typeof analyser.getFloatFrequencyData === "function") {
      const count = analyser.frequencyBinCount;
      if (audioState.frequencyBuffers[index]?.length !== count) audioState.frequencyBuffers[index] = new Float32Array(count);
      const frequencies = audioState.frequencyBuffers[index];
      analyser.getFloatFrequencyData(frequencies);
      const binHz = sampleRate / analyser.fftSize;
      for (let bin = 1; bin < count; bin++) {
        const hz = bin * binHz, db = frequencies[bin];
        if (hz < 30 || hz > 16000 || !Number.isFinite(db)) continue;
        energy[hz < 250 ? "bass" : hz < 2500 ? "mid" : "treble"] += Math.pow(10, db / 10);
      }
      for (const band of ["bass", "mid", "treble"]) {
        const amount = open ? clamp((Math.sqrt(energy[band]) - gate) * sensitivity * 2, 0, 1) : 0;
        features[band] = smooth(features[band], amount);
      }
    } else {
      // Time-domain-only analysers retain a full-range fallback per channel;
      // a shared mono signal never replaces independent stereo measurements.
      features.bass = features.mid = features.treble = channel.level;
    }
  }
  // Combine channel energies, not waveforms: antiphase stereo remains audible.
  const rms = Math.hypot(channels[0].rawRms, channels[1].rawRms) / Math.SQRT2;
  const target = clamp(Math.max(0, rms - gate) * sensitivity * 3, 0, 1);
  audioState.level = smooth(audioState.level, target);
  audioState.previousTarget = target;
  for (const band of ["bass", "mid", "treble"]) audioState.features[band] = Math.hypot(channels[0].features[band], channels[1].features[band]) / Math.SQRT2;
  audioState.features.transient = Math.max(channels[0].features.transient, channels[1].features.transient);
  const stereoLevel = channels[0].level + channels[1].level;
  audioState.features.pan = stereoLevel > 0.005 ? (channels[1].level - channels[0].level) / stereoLevel : 0;
  const calibration = audioSetupState.calibration;
  if (calibration && calibration.generation === audioState.generation) {
    calibration.firstAt ??= timestamp;
    if (calibration.lastAt !== timestamp) {
      calibration.samples.push(audioDecibels(Math.max(channels[0].rawRms, channels[1].rawRms)));
      calibration.lastAt = timestamp;
    }
    if (timestamp - calibration.startedAt >= 2000) finishAudioNoiseCalibration();
  }
  if (!state.running && !document.hidden) updateAudioMeters();
}
async function connectAudio() {
  disconnectAudio();
  const generation = audioState.generation;
  const button = document.getElementById("connectAudio");
  const sourceControl = document.getElementById("audioSource");
  const screen = sourceControl.value === "screen";
  const selectedDevice = document.getElementById("audioDevice")?.value || audioSetupState.deviceId;
  audioSetupState.connecting = true;
  button.disabled = true;
  sourceControl.disabled = true;
  document.getElementById("disconnectAudio").disabled = false;
  document.getElementById("audioReadout").textContent = "Waiting for audio permission…";
  updateAudioDeviceControls();
  let stream;
  try {
    const media = navigator.mediaDevices;
    if (!media || !(screen ? media.getDisplayMedia : media.getUserMedia)) throw new Error("Audio capture is unavailable in this browser or page context.");
    stream = screen
      ? await media.getDisplayMedia({ video: true, audio: true })
      : await media.getUserMedia({ audio: { ...(selectedDevice ? { deviceId: { exact: selectedDevice } } : {}), channelCount: { ideal: 2 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (generation !== audioState.generation) {
      stopAudioStream(stream);
      return;
    }
    if (!stream.getAudioTracks().length) throw new Error("No audio was shared. Choose a source with audio and enable Share audio.");
    audioState.stream = stream;
    // A source may disappear while AudioContext.resume() is pending. Observe
    // it before that await so the generation guard can cancel initialization.
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (audioState.stream === stream) disconnectAudio("Audio source disconnected. Choose an input and reconnect.");
      });
    }
    if (stream.getTracks().some(track => track.readyState === "ended")) throw new Error("Audio source ended before connection completed. Choose an input and reconnect.");
    const context = new AudioContext();
    audioState.context = context;
    context.addEventListener?.("statechange", () => updateAudioContextState(context, generation));
    await context.resume();
    if (generation !== audioState.generation) return;
    audioState.source = context.createMediaStreamSource(stream);
    audioState.analyser = context.createAnalyser();
    audioState.analyser.fftSize = 1024;
    audioState.analyser.smoothingTimeConstant = 0;
    audioState.samples = new Float32Array(audioState.analyser.fftSize);
    audioState.source.connect(audioState.analyser);
    // Speaker upmix duplicates mono to both channels while retaining true stereo separation.
    audioState.stereo = context.createGain();
    audioState.stereo.channelCount = 2;
    audioState.stereo.channelCountMode = "explicit";
    audioState.stereo.channelInterpretation = "speakers";
    audioState.splitter = context.createChannelSplitter(2);
    audioState.source.connect(audioState.stereo);
    audioState.stereo.connect(audioState.splitter);
    audioState.sink = context.createGain();
    audioState.sink.gain.value = 0;
    audioState.sink.connect(context.destination);
    for (let channel = 0; channel < 2; channel += 1) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      audioState.analysers.push(analyser);
      audioState.sampleBuffers.push(new Float32Array(analyser.fftSize));
      audioState.splitter.connect(analyser, channel);
      analyser.connect(audioState.sink);
    }
    const inputTrack = stream.getAudioTracks()[0];
    Object.assign(audioSetupState, { connecting: false, connectedSource: screen ? "screen" : "microphone", requestedDeviceId: screen ? "" : selectedDevice,
      connectedDeviceId: screen ? "" : inputTrack.getSettings?.().deviceId || selectedDevice });
    audioState.timer = setInterval(sampleAudioSafely, 16);
    document.getElementById("audioReadout").textContent = screen ? "Shared audio connected" : inputTrack.label ? `Input connected · ${inputTrack.label}` : "Microphone connected";
    updateAudioDeviceControls();
    refreshAudioDevices();
    updateAtariControls();
    schedulePreview();
  } catch (error) {
    if (generation === audioState.generation) {
      if (stream !== audioState.stream) stopAudioStream(stream);
      disconnectAudio(`Audio unavailable: ${error.name === "OverconstrainedError" || error.name === "NotFoundError" ? "The selected input is unavailable. Refresh inputs, choose an available input, and reconnect." : error.message}`);
    } else stopAudioStream(stream);
  }
}
