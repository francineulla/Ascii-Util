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
}

function disconnectAudio(message = "Audio off") {
  audioState.generation += 1;
  clearInterval(audioState.timer);
  if (audioState.source) audioState.source.disconnect();
  for (const node of [audioState.analyser, audioState.stereo, audioState.splitter, ...audioState.analysers, audioState.sink]) {
    if (node) node.disconnect();
  }
  if (audioState.stream) audioState.stream.getTracks().forEach(track => track.stop());
  if (audioState.context) audioState.context.close().catch(() => {});
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
    for (const sample of samples) {
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
  updateAudioMeters();
}
async function connectAudio() {
  disconnectAudio();
  const generation = audioState.generation;
  const button = document.getElementById("connectAudio");
  const sourceControl = document.getElementById("audioSource");
  const screen = sourceControl.value === "screen";
  button.disabled = true;
  sourceControl.disabled = true;
  document.getElementById("disconnectAudio").disabled = false;
  document.getElementById("audioReadout").textContent = "Waiting for audio permission…";
  let stream;
  try {
    const media = navigator.mediaDevices;
    if (!media || !(screen ? media.getDisplayMedia : media.getUserMedia)) throw new Error("Audio capture is unavailable in this browser or page context.");
    stream = screen
      ? await media.getDisplayMedia({ video: true, audio: true })
      : await media.getUserMedia({ audio: { channelCount: { ideal: 2 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    if (generation !== audioState.generation) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    if (!stream.getAudioTracks().length) throw new Error("No audio was shared. Choose a source with audio and enable Share audio.");
    audioState.stream = stream;
    const context = new AudioContext();
    audioState.context = context;
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
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (audioState.stream === stream) disconnectAudio("Audio source disconnected");
      });
    }
    audioState.timer = setInterval(sampleAudio, 16);
    document.getElementById("audioReadout").textContent = screen ? "Shared audio connected" : "Microphone connected";
    updateAtariControls();
    schedulePreview();
  } catch (error) {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (generation === audioState.generation) disconnectAudio(`Audio unavailable: ${error.message}`);
  }
}
