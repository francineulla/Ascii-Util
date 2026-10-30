(async () => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const el = id => document.getElementById(id);
  const originalMedia = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  const originalContext = window.AudioContext;
  const quiet = () => { cancelPlaybackFrame(); stopPreviewLoop(); clearTimeout(state.previewTimer); clearInterval(audioState.timer); };
  let requests = 0, stops = 0, closes = 0, readsFail = false, invalidSamples = false, rejectResume = false, badCleanup = false, badStop = false;
  const nodes = [];
  let report;
  const node = () => {
    const result = { connect() {}, disconnect() { if (badCleanup) throw new Error("Node already gone"); } };
    nodes.push(result); return result;
  };
  class FakeContext extends EventTarget {
    state = "running";
    sampleRate = 48000;
    destination = node();
    resume() {
      if (rejectResume) return Promise.reject(new Error("Interrupted"));
      this.state = "running"; this.dispatchEvent(new Event("statechange")); return Promise.resolve();
    }
    close() { closes++; this.state = "closed"; return Promise.resolve(); }
    createMediaStreamSource() { return node(); }
    createGain() { return { ...node(), gain: { value: 1 } }; }
    createChannelSplitter() { return node(); }
    createAnalyser() {
      return { ...node(), fftSize: 1024, get frequencyBinCount() { return this.fftSize / 2; },
        getFloatTimeDomainData(buffer) {
          if (readsFail) throw new Error("Audio device read failed");
          buffer.fill(invalidSamples ? NaN : 0.1);
          if (invalidSamples) buffer[0] = Infinity;
        }, getFloatFrequencyData(buffer) { buffer.fill(-Infinity); } };
    }
  }
  try {
    quiet(); disconnectAudio();
    el("keepAwake").checked = false;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      enumerateDevices: async () => [],
      getUserMedia: async () => {
        requests++;
        const track = new EventTarget(); track.readyState = "live";
        track.stop = () => { stops++; track.readyState = "ended"; if (badStop) throw new Error("Track already gone"); };
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      }
    } });
    window.AudioContext = FakeContext;
    audioSetupState.deviceId = ""; el("audioDevice").value = ""; el("audioSource").value = "microphone";
    await connectAudio(); quiet();
    const stream = audioState.stream, context = audioState.context;
    sampleAudio(100);
    assert(audioState.level > 0, "connected audio produces a measurable response");
    context.state = "suspended"; context.dispatchEvent(new Event("statechange"));
    assert(audioState.level === 0 && !el("resumeAudio").hidden && audioState.stream === stream, "suspended context clears stale envelopes and exposes Resume without releasing capture");
    rejectResume = true; await resumeConnectedAudio();
    assert(!el("resumeAudio").disabled && el("audioReadout").textContent.includes("could not resume"), "a failed resume remains retryable");
    rejectResume = false; await resumeConnectedAudio();
    assert(requests === 1 && audioState.stream === stream && el("resumeAudio").hidden, "resume uses the existing input without another capture request");
    invalidSamples = true; sampleAudio(200);
    assert([audioState.level, audioState.left.rawRms, audioState.right.rawRms, audioState.features.pan].every(Number.isFinite), "non-finite device samples cannot poison visual geometry");
    invalidSamples = false;

    await connectAudio(); quiet();
    const replacement = audioState.stream;
    context.state = "closed"; context.dispatchEvent(new Event("statechange"));
    assert(audioState.stream === replacement, "a stale context event cannot disconnect a replacement input");
    applyPreset({ ...getPreset(), visualizerMode: "ascii", colorMode: "classic", quality: "low", glyphSize: "18", livePreview: false, fullscreenOnStart: false, recordingMode: false });
    start(); quiet();
    const frame = state.currentFrame;
    readsFail = true; badCleanup = true;
    sampleAudioSafely();
    assert(!audioState.stream && !audioState.context && !audioState.timer && stops >= 2 && closes >= 2, "analysis failure releases capture even if node cleanup throws");
    assert(state.running && state.currentFrame === frame && el("audioReadout").textContent.includes("analysis stopped"), "an audio failure leaves visual playback running");
    readsFail = false; badCleanup = false; stop(); quiet();
    await connectAudio(); quiet();
    const closedContext = audioState.context;
    closedContext.state = "closed"; closedContext.dispatchEvent(new Event("statechange"));
    assert(!audioState.stream && el("resumeAudio").hidden && el("audioReadout").textContent.includes("Reconnect"), "closed contexts release the stream and offer explicit reconnect");
    rejectResume = true; badStop = true;
    const previousCloses = closes;
    await connectAudio(); quiet();
    assert(!audioState.stream && !audioState.context && closes > previousCloses && !el("connectAudio").disabled,
      "failed connection cleanup survives a throwing track stop and leaves retry enabled");
    rejectResume = false; badStop = false;
    quiet();
    report = "PASS: audio suspend/resume without new capture, denied resume recovery, finite signal envelopes, stale-context isolation, exception-safe device cleanup, and uninterrupted visuals after analysis failure";
  } catch (error) {
    report = `FAIL: ${error.stack}`;
  } finally {
    readsFail = false; badCleanup = false; badStop = false; state.running = false;
    disconnectAudio(); quiet();
    window.AudioContext = originalContext;
    if (originalMedia) Object.defineProperty(navigator, "mediaDevices", originalMedia); else delete navigator.mediaDevices;
  }
  document.body.textContent = report;
})();
